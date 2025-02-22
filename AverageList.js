(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const isAnime = location.pathname.includes('animelist');
    const t = isAnime ? 'ANIME' : 'MANGA';
    const p = isAnime ? '/anime/' : '/manga/';

    async function autoScroll() {
        let h = 0, c = document.body.scrollHeight;
        while (h !== c) {
            h = c;
            window.scrollTo(0, c);
            await wait(1000);
            c = document.body.scrollHeight;
        }
    }

    async function fetchScore(id, a = 1) {
        const q = `query($id:Int){Media(id:$id,type:${t}){averageScore meanScore}}`;
        const v = { id: parseInt(id) };
        const d = Math.min(100 * 2 ** (a - 1), 5000);
        try {
            await wait(d);
            const r = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ query: q, variables: v })
            });
            if (r.status === 429) return await fetchScore(id, a + 1);
            const j = await r.json();
            return j.data?.Media?.averageScore ?? j.data?.Media?.meanScore ?? 50;
        } catch {
            return a < 3 ? await fetchScore(id, a + 1) : 50;
        }
    }

    async function type(i, v) {
        i.focus();
        i.value = '';
        for (const c of v.toString()) {
            i.value += c;
            i.dispatchEvent(new Event('input', { bubbles: true }));
            await wait(50);
        }
        i.dispatchEvent(new Event('change', { bubbles: true }));
        i.blur();
    }

    async function click(e) {
        e.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        e.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        e.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    }

    async function update(e, s, a = 1) {
        const l = Array.from(e.querySelectorAll('.title a')).find(a => a.getAttribute('href').startsWith(p));
        if (!l) return;
        const i = l.href.match(new RegExp(`${p}(\\d+)/`))?.[1];
        if (!i) return;

        const d = Math.min(1000 * 2 ** (a - 1), 2000);
        const edit = e.querySelector('.cover .edit');
        if (!edit) return;
        await click(edit);
        await wait(d);

        const inp = document.querySelector('.el-input-number input');
        if (!inp) return a < 3 ? update(e, s, a + 1) : null;
        await type(inp, s);
        await wait(1000);

        const save = document.querySelector('.save-btn');
        if (!save) return a < 3 ? update(e, s, a + 1) : null;
        await click(save);
        await wait(d);
    }

    await autoScroll();
    const sects = Array.from(document.querySelectorAll('.list-wrap'));
    if (!sects.length) return;

    for (const s of sects) {
        const n = s.querySelector('.section-name')?.textContent.trim();
        const es = Array.from(s.querySelectorAll('.entry.row')).filter(e => !e.querySelector('.release-status.NOT_YET_RELEASED'));
        if (!es.length) continue;

        for (const e of es) {
            const l = Array.from(e.querySelectorAll('.title a')).find(a => a.getAttribute('href').startsWith(p));
            if (!l) continue;
            const i = l.href.match(new RegExp(`${p}(\\d+)/`))?.[1];
            if (!i) continue;

            const sc = e.querySelector('.score');
            const txt = sc?.textContent.trim();
            const attr = sc?.getAttribute('score');

            if (n?.includes('Planning')) {
                if (!txt || txt === '' || attr === '0') continue;
                if (parseInt(txt) === 0) continue;
                await update(e, 0);
                continue;
            }
            if (txt && txt !== '' && attr !== '0') continue;
            await update(e, await fetchScore(i));
        }
    }
})();
