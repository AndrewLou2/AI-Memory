# Context Boundary Tracker

Context Boundary Tracker is a Manifest V3 Chrome Extension that tracks the most recent contiguous set of messages fitting within a model's context window on chatgpt.com. It identifies the Start of Context and First Omitted messages, displays counts, and provides navigation and copy tools. All processing is client-side with no external requests.

## Features

- High-fidelity and heuristic tokenization via a Web Worker
- Per-site model profiles with configurable window, overhead, reply budget, tokenizer mode/type, and custom selectors
- Accurate boundary computation and live updates via MutationObserver
- HUD with counts, previews, navigation, highlights, and copy actions
- Keyboard shortcuts: Alt+Shift+B, Alt+Shift+N, Alt+Shift+H
- Options page with test harness and per-site settings
- No telemetry or network calls

## Privacy

All computation occurs locally in the browser. No telemetry, analytics, or external network requests are made. Clipboard actions are user-initiated and local.

## Installation

1. Open chrome://extensions
2. Enable Developer Mode
3. Click Load unpacked and select the extension directory

## Usage

Open a supported chat site. The HUD appears in the bottom-right. Use the buttons or shortcuts to jump to boundary messages, toggle highlights, copy omitted range, or recompute. Adjust settings in the Options page.

## Notes

- High-fidelity tokenizers are lightweight BPE-based approximations suitable for boundary tracking.
- If a site's history is virtualized, the extension attempts incremental scroll to load and recompute.
