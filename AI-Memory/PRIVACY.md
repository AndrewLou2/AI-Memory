# AI Memory Tracker — Privacy Policy

Effective date: 2025-08-19

AI Memory Tracker respects your privacy. This extension does not collect, transmit, sell, or share any personal data.

## What data is collected

- No user data is collected.
- No analytics, telemetry, or tracking is implemented.

## What runs locally

All processing happens locally in your browser. The extension analyzes the currently open ChatGPT page to estimate token usage and render a small UI. Page content is never sent off your device.

## Local storage usage

We store a few preferences in Chrome’s local storage so the UI behaves consistently:

- `cbt_settings` — per‑site extension settings (e.g., tokenizer mode)
- `cbt_position` — draggable panel position
- `cbt_highlights` — whether highlights are enabled
- `cbt_collapsed` — whether the panel is collapsed

These values remain on your device and can be cleared by removing site data or uninstalling the extension.

## Clipboard access

The extension can write text to your clipboard only when you click explicit copy buttons (e.g., “Copy Start of Context”). It never reads from the clipboard.

## Permissions and purposes

- `storage` — save the local preferences listed above
- `tabs` (and/or `activeTab`) — send commands from the toolbar/keyboard to the active tab’s content script; not used to read browsing history
- `clipboardWrite` — enable copy actions you trigger
- Host permissions `https://chatgpt.com/*` and `https://www.chatgpt.com/*` — inject the UI and read only the content needed to compute context usage; never transmitted

## Third parties

No third‑party services receive your data. No remote code is loaded at runtime.

## Children’s privacy

This extension is not directed to children under 13 and does not knowingly collect personal information.

## Changes to this policy

If we change this policy, we will update the Effective date above and publish the new version in this repository.

## Contact

For privacy questions or requests, contact: maintainer at your-email@example.com
