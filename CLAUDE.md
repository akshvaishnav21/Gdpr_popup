# CLAUDE.md — GDPR Cookie Consent Handler

This file provides context for AI assistants working in this repository.

## Project Overview

A **Chrome Extension (Manifest V3)** that automatically detects and dismisses GDPR cookie consent popups on websites. Written in vanilla JavaScript with zero external dependencies. The extension respects user privacy by defaulting to "Reject All" cookies.

## Repository Structure

```
Gdpr_popup/
├── manifest.json       # Extension manifest (Manifest V3)
├── background.js       # Service worker — sets default preference on install
├── content.js          # Core engine — detects and clicks cookie consent buttons
├── popup.html          # Settings UI markup
├── popup.css           # Settings UI styles
├── popup.js            # Settings UI logic — loads/saves preferences
├── icons/
│   ├── icon16.svg      # Toolbar icon (16×16)
│   ├── icon48.svg      # Extension management icon (48×48)
│   └── icon128.svg     # Chrome Web Store icon (128×128)
└── README.md           # User-facing documentation
```

No `package.json`, no build system, no test runner — all files load directly as a Chrome extension.

## Architecture

### Data Flow

```
User sets preference in popup.html
  → popup.js saves to chrome.storage.sync

Page loads in browser tab
  → content.js runs at document_idle
  → Reads preference from chrome.storage.sync
  → Runs layered detection strategy
  → Clicks the matching cookie button
```

### content.js Detection Layers (in order)

1. **Framework-specific selectors** — Named CMP selectors (OneTrust, Cookiebot, Didomi, Quantcast, Borlabs, TrustArc, Cookieyes, Iubenda, Complianz, GDPR Legal, Osano)
2. **Generic container + text matching** — 27 CSS container selectors, then text search in 5+ languages
3. **Shadow DOM traversal** — Usercentrics components behind `#usercentrics-root`
4. **MutationObserver** — Watches for dynamically injected banners
5. **Timed retries** — Retries at 500ms, 1500ms, and 3000ms after page load

### User Preferences

Three valid values, stored in `chrome.storage.sync`:

| Value | Description |
|---|---|
| `reject_all` | Clicks "Reject All" button (default) |
| `necessary_only` | Clicks "Necessary Only" button |
| `accept_all` | Clicks "Accept All" button |

Default is `reject_all`, set on install in `background.js`.

## Key Conventions

### Naming

- **Functions**: camelCase — `handleConsent()`, `initObserver()`, `findButtonByText()`
- **Constants**: SCREAMING_SNAKE_CASE — `FRAMEWORK_SELECTORS`, `TEXT_MATCHERS`, `GENERIC_CONTAINER_SELECTORS`, `FLAG_KEY`, `VALID_PREFS`

### content.js Section Layout

The file is organized into 8 labeled sections (comments mark each):
1. Framework-specific selectors array (`FRAMEWORK_SELECTORS`)
2. Text matchers object (`TEXT_MATCHERS`)
3. Generic container selectors array (`GENERIC_CONTAINER_SELECTORS`)
4. Utility functions (`isVisible`, `normalizeText`, `findButtonByText`, `clickElement`)
5. Main handler (`handleConsent`)
6. Shadow DOM handler (`handleShadowDOM`)
7. MutationObserver setup (`initObserver`)
8. Entry point (reads storage, validates preference, runs detection)

### Security Rules

These must be maintained in all changes:

- **Whitelist validation**: Always validate user preferences against `VALID_PREFS` before use
- **Namespaced session flag**: Use `gdpr_handler_done_${chrome.runtime.id}` as the `sessionStorage` key (prevents websites from pre-setting the flag to suppress the extension)
- **Content Security Policy**: `script-src 'self'; object-src 'none';` must remain in `manifest.json`
- **No external requests**: The extension must never make network requests

### Adding a New CMP Framework

Append an object to `FRAMEWORK_SELECTORS` in `content.js`:

```javascript
{
  name: 'FrameworkName',
  container: '#container-id',          // CSS selector for the banner container
  accept: '#accept-btn-id',            // CSS selector for "accept all" button
  reject: '#reject-btn-id',            // CSS selector for "reject all" button (or null)
  necessary_only: '#necessary-btn-id', // CSS selector for "necessary only" button (or null)
}
```

Keys map directly to the preference values. Use `null` for unavailable actions on a given CMP.

### Adding New Text Matchers

Add phrases to `TEXT_MATCHERS` in `content.js`:

```javascript
TEXT_MATCHERS = {
  accept_all: ['accept all', 'allow all', /* add new phrases here */],
  reject_all: ['reject all', 'decline', /* add new phrases here */],
  necessary_only: ['necessary only', /* add new phrases here */],
};
```

Text matching is case-insensitive via `normalizeText()`. Add multi-language phrases directly to the arrays.

## Development Workflow

### Loading the Extension

1. Open `chrome://extensions` in Chrome
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked" and select this repository directory
4. The extension icon appears in the toolbar

### Reloading After Changes

- **content.js / popup files**: Click the refresh icon on the extension card in `chrome://extensions`, then reload the target page
- **background.js**: Same — reload extension, then close/reopen the service worker
- **manifest.json**: Must reload the extension

### Testing a Change

There is no automated test suite. Manual testing steps:

1. Load the extension as unpacked
2. Open a site with a cookie banner (e.g., any GDPR-affected news site)
3. Verify the banner is dismissed according to the selected preference
4. Open the popup, change the preference, reload the page, verify behavior changes

## Chrome Extension APIs Used

| API | File | Purpose |
|---|---|---|
| `chrome.runtime.onInstalled` | `background.js` | Set default preference on install |
| `chrome.storage.sync.get/set` | `background.js`, `content.js`, `popup.js` | Persist and retrieve user preference |
| `chrome.runtime.id` | `content.js` | Namespaced sessionStorage key |
| `chrome.runtime.sendMessage` | Not currently used | Available for future background communication |

## Permissions

Declared in `manifest.json`:

- `storage` — required for `chrome.storage.sync`
- `<all_urls>` (host permission) — required to inject `content.js` on all websites

Do not add new permissions without clear justification. Each permission increases the extension's trust scope and Chrome Web Store review scrutiny.

## Style Guidelines

- **No external dependencies** — keep the extension dependency-free
- **No build step** — all JS/HTML/CSS must run directly in the browser without compilation
- **Visibility checks** — always call `isVisible(el)` before attempting to click a detected element
- **Early returns** — `handleConsent` returns `true` on first successful click; avoid redundant work
- **Defensive DOM access** — use try-catch around `.click()` calls (see `clickElement()`)
- **Observer cleanup** — disconnect `MutationObserver` after success or the 30-second timeout

## Known Limitations

- Does not handle CMPs that require JavaScript interaction beyond a simple `.click()` (e.g., multi-step flows)
- Shadow DOM support is limited to Usercentrics; other shadow-DOM CMPs may need additional entries
- No automated tests — all verification is manual
- Not published to the Chrome Web Store (manual unpacked loading only)
