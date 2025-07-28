(async () => {
  const CONFIG = {
    API_URL: 'https://graphql.anilist.co',
    BASE_DELAY: 100,
    MAX_DELAY: 5000,
    UPDATE_MAX_DELAY: 2000,
    TYPE_DELAY: 50,
    SCROLL_DELAY: 1000,
    DEFAULT_SCORE: 50,
    MAX_RETRIES: 3,
    PATH_REGEX: (type) => new RegExp(`/${type}/(\\d+)/`),
    RATE_LIMIT_PER_MINUTE: 90,
    RATE_LIMIT_WINDOW: 60000,
    STORAGE_KEY: 'anilist_score_updater_state'
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const isAnime = location.pathname.includes('animelist');
  const mediaType = isAnime ? 'ANIME' : 'MANGA';
  const mediaPath = isAnime ? '/anime/' : '/manga/';
  const scoreCache = new Map();
  const requestQueue = [];
  let requestCount = 0;
  let windowStart = Date.now();

  const state = {
    load() {
      try {
        const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
        return saved ? JSON.parse(saved) : { processedEntries: [], currentSection: 0, currentEntry: 0 };
      } catch {
        return { processedEntries: [], currentSection: 0, currentEntry: 0 };
      }
    },
    save(data) {
      try {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        console.error('Failed to save state:', error);
      }
    },
    clear() {
      try {
        localStorage.removeItem(CONFIG.STORAGE_KEY);
      } catch (error) {
        console.error('Failed to clear state:', error);
      }
    }
  };

  const rateLimiter = {
    async enqueueRequest(requestFn) {
      if (requestCount >= CONFIG.RATE_LIMIT_PER_MINUTE) {
        const elapsed = Date.now() - windowStart;
        if (elapsed < CONFIG.RATE_LIMIT_WINDOW) {
          await wait(CONFIG.RATE_LIMIT_WINDOW - elapsed);
        }
        requestCount = 0;
        windowStart = Date.now();
      }
      requestQueue.push(requestFn);
      requestCount++;
      if (requestQueue.length === 1) {
        return await rateLimiter.processQueue();
      }
      return await new Promise((resolve) => setTimeout(() => resolve(rateLimiter.processQueue()), 0));
    },
    async processQueue() {
      if (!requestQueue.length) return;
      const fn = requestQueue.shift();
      return await fn();
    }
  };

  const scroller = {
    async autoScroll() {
      let prevHeight = 0;
      let currHeight = document.body.scrollHeight;
      while (prevHeight !== currHeight) {
        prevHeight = currHeight;
        window.scrollTo(0, currHeight);
        await wait(CONFIG.SCROLL_DELAY);
        currHeight = document.body.scrollHeight;
      }
    }
  };

  const api = {
    async fetchScore(id, attempt = 1) {
      if (scoreCache.has(id)) return scoreCache.get(id);
      return await rateLimiter.enqueueRequest(async () => {
        const query = `query($id:Int){Media(id:$id,type:${mediaType}){averageScore meanScore}}`;
        const variables = { id: parseInt(id) };
        const delay = Math.min(CONFIG.BASE_DELAY * 2 ** (attempt - 1), CONFIG.MAX_DELAY);
        try {
          await wait(delay);
          const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query, variables })
          });
          if (response.status === 429) return await api.fetchScore(id, attempt + 1);
          const json = await response.json();
          if (!json.data?.Media) {
            console.error(`Invalid API response for media ID ${id}:`, json);
            return CONFIG.DEFAULT_SCORE;
          }
          const score = json.data.Media.averageScore ?? json.data.Media.meanScore ?? CONFIG.DEFAULT_SCORE;
          scoreCache.set(id, score);
          return score;
        } catch (error) {
          console.error(`Fetch failed for media ID ${id}:`, error);
          return attempt < CONFIG.MAX_RETRIES ? await api.fetchScore(id, attempt + 1) : CONFIG.DEFAULT_SCORE;
        }
      });
    }
  };

  const dom = {
    async clickElement(element) {
      element.dispatchEvent(new Event('click', { bubbles: true }));
    },
    async typeInput(input, value) {
      const sanitizedValue = Math.max(0, Math.min(100, parseInt(value) || 0));
      input.focus();
      input.value = '';
      for (const char of sanitizedValue.toString()) {
        input.value += char;
        input.dispatchEvent(new CustomEvent('input', { bubbles: true }));
        await wait(CONFIG.TYPE_DELAY);
      }
      input.dispatchEvent(new CustomEvent('change', { bubbles: true }));
      input.blur();
    },
    getMediaId(entry) {
      const link = Array.from(entry.querySelectorAll('.title a')).find((a) =>
        a.getAttribute('href').startsWith(mediaPath)
      );
      if (!link) return null;
      const match = link.href.match(CONFIG.PATH_REGEX(isAnime ? 'anime' : 'manga'));
      return match ? match[1] : null;
    }
  };

  async function update(entry, score, attempt = 1) {
    if (attempt > CONFIG.MAX_RETRIES) {
      console.error(`Failed to update entry after ${CONFIG.MAX_RETRIES} attempts.`);
      return;
    }
    const mediaId = dom.getMediaId(entry);
    if (!mediaId) {
      console.warn('No valid media ID found for entry.');
      return;
    }
    const editButton = entry.querySelector('.cover .edit');
    if (!editButton) {
      console.warn(`Edit button not found for entry ${mediaId}.`);
      return;
    }
    await dom.clickElement(editButton);
    await wait(Math.min(1000 * 2 ** (attempt - 1), CONFIG.UPDATE_MAX_DELAY));

    const input = document.querySelector('.el-input-number input');
    if (!input) {
      console.warn(`Score input not found for entry ${mediaId}.`);
      return attempt < CONFIG.MAX_RETRIES ? update(entry, score, attempt + 1) : null;
    }
    await dom.typeInput(input, score);
    await wait(CONFIG.SCROLL_DELAY);

    const saveButton = document.querySelector('.save-btn');
    if (!saveButton) {
      console.warn(`Save button not found for entry ${mediaId}.`);
      return attempt < CONFIG.MAX_RETRIES ? update(entry, score, attempt + 1) : null;
    }
    await dom.clickElement(saveButton);
    await wait(CONFIG.SCROLL_DELAY);

    const currentState = state.load();
    currentState.processedEntries.push(mediaId);
    state.save(currentState);
  }

  async function processEntries() {
    await scroller.autoScroll();
    const sections = Array.from(document.querySelectorAll('.list-wrap'));
    if (!sections.length) {
      console.warn('No list sections found on the page.');
      return;
    }

    const savedState = state.load();
    let { currentSection, currentEntry, processedEntries } = savedState;

    for (let i = currentSection; i < sections.length; i++) {
      const section = sections[i];
      const sectionName = section.querySelector('.section-name')?.textContent.trim();
      const entries = Array.from(section.querySelectorAll('.entry.row')).filter(
        (entry) => !entry.querySelector('.release-status.NOT_YET_RELEASED')
      );
      if (!entries.length) continue;

      for (let j = i === currentSection ? currentEntry : 0; j < entries.length; j++) {
        const entry = entries[j];
        const mediaId = dom.getMediaId(entry);
        if (!mediaId || processedEntries.includes(mediaId)) continue;

        const scoreElement = entry.querySelector('.score');
        const scoreText = scoreElement?.textContent.trim();
        const scoreAttr = scoreElement?.getAttribute('score');

        if (sectionName?.includes('Planning')) {
          if (!scoreText || scoreText === '' || scoreAttr === '0' || parseInt(scoreText) === 0) continue;
          await update(entry, 0);
        } else if (!scoreText || scoreText === '' || scoreAttr === '0') {
          await update(entry, await api.fetchScore(mediaId));
        }

        savedState.currentSection = i;
        savedState.currentEntry = j + 1;
        state.save(savedState);
      }
      savedState.currentEntry = 0;
      state.save(savedState);
    }

    state.clear();
  }

  window.addEventListener('beforeunload', () => {
    const savedState = state.load();
    state.save(savedState);
  });

  await processEntries();
})();
