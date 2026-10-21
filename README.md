# Light Browser 🌐

A minimalist, distraction-free web browser that runs directly in your browser. Designed for high speed, zero telemetry, and simple bookmark management.

## Features

- **Lightweight Chrome**: Minimal 48px top bar with Back, Forward, Reload, Home, and clean Omnibox.
- **Bypass Frame Restrictions**: Node.js/Express reverse-proxy strips `X-Frame-Options` and `Content-Security-Policy` headers to let you view external websites inside an isolated viewport.
- **Smart Omnibox**: Automatically detects valid web addresses (e.g. `example.com`, `news.ycombinator.com`) vs search queries (defaults to privacy-respecting search).
- **One-Click Bookmarks**:
  - Star toggle button (⭐) in the omnibox.
  - Quick Bookmarks Bar under the address bar for single-click access.
  - Full Bookmarks Manager Modal with instant search/filter and delete actions.
  - **Export to JSON** / **Import from JSON** for easy backup and sync across devices.
  - Stored purely in browser `localStorage` with zero database overhead.

## Keyboard Shortcuts

- <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>D</kbd>: Toggle bookmark for current page.
- <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>B</kbd>: Open/close Bookmarks Manager.
- <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>L</kbd>: Focus the address bar.
- <kbd>Enter</kbd>: Navigate to entered URL or search term.
- <kbd>Esc</kbd>: Close open modals.

## Quick Start

```bash
cd ~/antigravity-projects/lightweight-browser
npm install
node server.js
```

Open `http://localhost:8080` in your browser (or use Cloud Shell Web Preview on port 8080).
