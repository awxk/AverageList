# AverageList

A JavaScript script to automatically set scores for AniList entries on anime (`/animelist`) and manga (`/mangalist`) pages, skipping "Planning" entries unless scored, and applying average scores to other sections.

## Features
- Works on both anime and manga lists dynamically.
- Sets unscored entries in other sections to their `averageScore`, `meanScore`, or 50 if both are null.

## Requirements
- Modern web browser (e.g., Chrome).
- AniList account (logged in).

## How to Use

### 1. Open AniList Page
Navigate to your list:
- Anime: `https://anilist.co/user/yourusername/animelist`
- Manga: `https://anilist.co/user/yourusername/mangalist`

### 2. Run the Script
1. Open the browser console (F12 → Console).
2. Paste the script and press Enter.

### 3. What to Expect
The script will:
1. Scroll to load all entries.
2. Skip "Planning" unscored entries, zero scored ones.
3. Set scores for unscored entries in other sections.

## Troubleshooting
- **No Entries Updated**: Ensure you’re on the correct list page and logged in.
- **CORS Errors**: This will likely occur if you're being throttled. If you modify the default values to speed the script up, it's likely to happen. I will admit it's likely that the script can go a bit faster without being throttled, but it worked for my purposes, so I didn't bother further min/max testing. Otherwise, try a different browser or disable extensions blocking requests.

## Code Overview

### Main Functions
- **`autoScroll`**: Loads all entries by scrolling.
- **`fetchScore`**: Fetches `averageScore` or `meanScore` via GraphQL, defaults to 50.
- **`type`**: Simulates typing scores into inputs.
- **`click`**: Simulates button clicks.
- **`update`**: Updates entry scores with retries.

## Disclaimer
This script is intended for educational purposes and lawful testing only. Misuse of this script in violation of any applicable laws or terms of service is strictly prohibited. Use at your own risk.

## License
This source code is licensed under the BSD-style license found in the [LICENSE](https://github.com/awxk/AverageList/blob/main/LICENSE) file in the root directory of this source tree.

## Author
[Nic D.](https://github.com/awxk)
