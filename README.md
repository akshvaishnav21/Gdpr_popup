# GDPR Cookie Consent Handler

A Chrome extension that automatically dismisses GDPR cookie consent popups based on your chosen preference — no more clicking "Reject All" on every website you visit.

## How it works

1. Click the extension icon and choose your default preference
2. Save it once — the extension remembers it permanently
3. Every time a cookie consent popup appears on any website, the extension auto-clicks the matching button for you

## Preference options

| Option | Description |
|--------|-------------|
| **Reject All** *(default)* | Blocks all non-essential cookies. Best for privacy. |
| **Necessary Only** | Allows only cookies required for the site to function. |
| **Accept All** | Allows all cookies including tracking and analytics. |

## Supported consent platforms

The extension includes specific support for the most common Consent Management Platforms (CMPs):

- Cookiebot
- OneTrust
- Didomi
- Quantcast
- TrustArc
- Borlabs Cookie
- Cookie Information
- Iubenda
- Complianz
- CookieConsent (Osano)

For all other sites, it falls back to text-based button matching (supports English, German, French, Spanish, Portuguese) and generic CSS pattern matching.

## Installation

This extension is not published to the Chrome Web Store. Load it manually as an unpacked extension:

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the project folder
5. The extension appears in your toolbar — click it to set your preference

## Project structure

```
├── manifest.json      # Extension config (Manifest V3)
├── background.js      # Service worker — sets default preference on install
├── content.js         # Injected into every page — detects and dismisses popups
├── popup.html         # Settings UI
├── popup.css          # Settings UI styles
├── popup.js           # Settings UI logic (reads/writes Chrome storage)
└── icons/             # Extension icons (SVG, 16/48/128px)
```

## Technical notes

- Built with **Manifest V3** and plain vanilla JS/HTML/CSS — no build step required
- Preferences are stored in `chrome.storage.sync` and sync across your Chrome profile
- Uses a `MutationObserver` to catch popups that are injected dynamically after page load
- Runs in all frames (`all_frames: true`) to handle CMPs that render inside iframes
- Includes Shadow DOM traversal for CMPs like Usercentrics
- Privacy-first default: installs with **Reject All** pre-selected
