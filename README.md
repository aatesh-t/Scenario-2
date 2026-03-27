# ReFocus

ReFocus is a Chrome browser extension that aims to help manage a user's time on distracting websites. It tracks how long you spend on chosen sites, blocks then when a time limit is reached, and allows for usage monitoring over time.

Built as a prototype for ENGF0034 Scenario 2 (Group 1)

Please note that Gen AI (Claude Sonnet) was used to help learn about developing a browser extension (e.g. the recommended file structure) and guidance on implementing some features. All code was written and understood by our group.

## Features

- **Time tracking** - monitors how long you spend on managed sites in the background
- **Hard blocking** - redirects to a block page when the daily limit is hit
- **Sub-path blocking** - blocks specific, more distracting, parts of a site (currently Youtube Shorts and Instagram Reels)
- **Override** - solve a quick maths problem to mindfully access 5 extra minutes
- **Usage data** - see today's usage per site through the pop-up or dashboard
- **Dashboard** - view all managed sites, edit time limits, remove sites
- **Quick add** - using the popup, add the current tab to the managed sites list directly

## Installation

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** in the top-right corner
3. Click **Load unpacked** and select the project folder ("refocus")
4. The ReFocus icon will appear in the Chrome toolbar

## File Structure
```
refocus/
    manifest.json        # Extension configuration
    background.js        # Time tracking and blocking logic
    storage.js           # Shared data layer
    contentScript.js     # Injected for sub-path blocking
    popup/
        popup.html       # Pop-up 
        popup.js
        popup.css
    blocked/
        blocked.html     # Page shown when a site is blocked
        blocked.js
        blocked.css
    dashboard/
        dashboard.html   # Dashboard page
        dashboard.js
        dashboard.css
    assets/
```

## Built with

- Chrome Extensions Manifest V3
- JavaScript
- HTML5
- CSS