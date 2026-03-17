# MonitorLuna Browser Extension

Chrome/Edge extension for tracking active browser tab time by domain.

## Installation

1. Open Chrome/Edge and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select this `browser-extension` folder
5. Click the extension icon and configure:
   - WebSocket URL (e.g., `ws://127.0.0.1:5140/monitorluna`)
   - Token (same as Koishi config)
   - Device ID (same as agent config)

## How it works

- Only tracks time when tab is active and window is focused
- Aggregates time by domain (e.g., `github.com`, `youtube.com`)
- Reports accumulated time every 30 seconds via WebSocket
- Data is stored in Koishi and displayed in daily summaries

## Icons

Replace `icon16.png`, `icon48.png`, `icon128.png` with actual icons.
For now, create simple placeholder images or use any 16x16, 48x48, 128x128 PNG files.
