# AI Memory Tracker

Know exactly what ChatGPT remembers. AI Memory Tracker visualizes the current context window on chatgpt.com, shows the exact “Start of Context” and the first omitted message, and gives quick actions to navigate or copy the relevant text.

## Features

- Visual context bar with live token usage
- “Start of Context” and “First Omitted” markers
- Highlights for included vs. omitted messages
- One‑click copy (start or omitted range)
- Floating, draggable panel with compact UI
- Keyboard shortcuts: Alt+Shift+B (Jump to Start), Alt+Shift+N (Jump to First Omitted), Alt+Shift+H (Toggle Highlights)
- Local-only processing, no data collection

## Install (Developer Mode)

1. Open `chrome://extensions`
2. Enable “Developer mode”
3. Click “Load unpacked” and select this `AI-Memory` folder
4. Optional: Pin the toolbar icon

## Usage

1. Open `https://chatgpt.com`
2. Use the toolbar button or shortcuts to show the HUD
3. Drag the panel to reposition; click buttons to jump or copy

## Permissions

- `storage`: saves panel position and preferences locally
- `tabs` (and/or `activeTab`): sends commands from the toolbar/shortcuts to the active tab
- `clipboardWrite`: enables explicit copy actions
- Host permissions for `chatgpt.com`: inject the UI and compute context boundaries

## Privacy

All processing is local. No analytics, telemetry, or remote requests. See `PRIVACY.md` for details.
