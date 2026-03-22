/**
 * GDPR Cookie Consent Handler - Content Script
 *
 * Detects cookie consent popups and automatically clicks the appropriate
 * button based on the user's stored preference.
 *
 * Detection layers:
 *  1. Framework-specific selectors (Cookiebot, OneTrust, Didomi, etc.)
 *  2. Generic CSS selectors matching cookie-related containers
 *  3. Text-based button matching within identified containers
 *  4. MutationObserver for dynamically injected popups
 */

// ---------------------------------------------------------------------------
// Section 1: Framework-specific selectors
// Each entry maps CMP name -> { container, accept, reject, necessary }
// Values are CSS selector strings. null means use text matching fallback.
// ---------------------------------------------------------------------------
const FRAMEWORK_SELECTORS = [
  {
    name: 'Cookiebot',
    container: '#CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay',
    accept: '#CybotCookiebotDialogBodyButtonAccept, #CybotCookiebotDialogBodyLevelButtonAccept',
    reject: '#CybotCookiebotDialogBodyButtonDecline',
    necessary: '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll, #CybotCookiebotDialogBodyButtonAccept',
  },
  {
    name: 'OneTrust',
    container: '#onetrust-banner-sdk, #onetrust-consent-sdk, .onetrust-pc-dark-filter',
    accept: '#onetrust-accept-btn-handler',
    reject: '#onetrust-reject-all-handler, .ot-pc-refuse-all-handler',
    necessary: '.save-preference-btn-handler, #accept-recommended-btn-handler',
  },
  {
    name: 'Didomi',
    container: '#didomi-host, #didomi-popup, .didomi-popup-container',
    accept: '#didomi-notice-agree-button',
    reject: '.didomi-continue-without-agreeing, #didomi-notice-disagree-button',
    necessary: '.didomi-continue-without-agreeing',
  },
  {
    name: 'Quantcast',
    container: '[id^="qc-cmp2-ui"], .qc-cmp2-summary-buttons',
    accept: '[id^="qc-cmp2-ui"] button.css-1litn2c, [id^="qc-cmp2-ui"] button[mode="primary"]',
    reject: '[id^="qc-cmp2-ui"] button[mode="secondary"]',
    necessary: '[id^="qc-cmp2-ui"] button[mode="secondary"]',
  },
  {
    name: 'Borlabs Cookie',
    container: '#BorlabsCookieBox',
    accept: '._brlbs-accept-all, .borlabs-cookie-btn-accept-all',
    reject: '._brlbs-refuse, .borlabs-cookie-btn-reject-all',
    necessary: '._brlbs-refuse, .borlabs-cookie-btn-reject-all',
  },
  {
    name: 'Cookie Information',
    container: '#cookie-information-template-wrapper, .cookie-information-popup-v2',
    accept: '#coiAcceptBtn',
    reject: '#coiRejectBtn',
    necessary: '#coiRejectBtn',
  },
  {
    name: 'TrustArc',
    container: '#truste-consent-track, .truste_overlay, #trustarc-banner-overlay',
    accept: '.trustarc-agree-btn, .pdynamicbutton .call',
    reject: '.trustarc-deny-btn, #truste-consent-required',
    necessary: '#truste-consent-required',
  },
  {
    name: 'Cookieyes / Cookie Law Info',
    container: '.cky-consent-container, #cookie-law-info-bar, .cli-bar-container',
    accept: '.cky-btn-accept, #cookie_action_close_header',
    reject: '.cky-btn-reject, #cookie_action_close_header_reject',
    necessary: '.cky-btn-reject',
  },
  {
    name: 'GDPR Legal (WordPress)',
    container: '#gdpr-cookie-notice, .gdpr-cookie-notice-modal',
    accept: '#gdpr-cookie-accept',
    reject: '#gdpr-cookie-decline',
    necessary: '#gdpr-cookie-decline',
  },
  {
    name: 'CookieConsent (Osano)',
    container: '.cc-window, .cc-banner',
    accept: '.cc-accept-all, .cc-btn.cc-allow',
    reject: '.cc-deny, .cc-dismiss',
    necessary: '.cc-deny',
  },
  {
    name: 'Iubenda',
    container: '#iubenda-cs-banner, .iubenda-cs-container',
    accept: '.iubenda-cs-accept-btn, #iubenda-cs-accept-btn',
    reject: '.iubenda-cs-reject-btn, #iubenda-cs-reject-btn',
    necessary: '.iubenda-cs-reject-btn',
  },
  {
    name: 'Complianz',
    container: '#cmplz-cookiebanner, .cmplz-cookiebanner',
    accept: '.cmplz-accept',
    reject: '.cmplz-deny',
    necessary: '.cmplz-deny',
  },
];

// ---------------------------------------------------------------------------
// Section 2: Text matchers for preference-based button detection
// ---------------------------------------------------------------------------
const TEXT_MATCHERS = {
  accept_all: [
    'accept all', 'accept all cookies', 'allow all', 'allow all cookies',
    'agree to all', 'i agree', 'agree and continue', 'agree & continue',
    'accept cookies', 'accept & continue', 'yes, i accept', 'yes i accept',
    'got it', 'ok, got it', 'ok!', 'allow cookies', 'enable all',
    'consent to all', 'alle akzeptieren', 'tout accepter', 'aceitar todos',
    'aceptar todo', 'alle cookies akzeptieren',
  ],
  reject_all: [
    'reject all', 'reject all cookies', 'decline all', 'deny all', 'refuse all',
    'decline', 'deny', 'refuse', 'no thanks', "i don't agree", 'i disagree',
    'do not accept', 'reject cookies', 'opt out', 'opt-out',
    'alles ablehnen', 'tout refuser', 'rejeitar tudo', 'rechazar todo',
    'не принимать', 'refuse all',
  ],
  necessary_only: [
    'necessary only', 'only necessary', 'accept necessary only',
    'essential only', 'only essential', 'accept essential only',
    'reject non-essential', 'use necessary cookies only',
    'accept only necessary', 'use only necessary', 'necessary cookies only',
    'save preferences', 'confirm my choices', 'save my preferences',
    'use necessary', 'continue without accepting', 'continue without agreeing',
    'nur notwendige', 'seulement nécessaires', 'apenas necessários',
  ],
};

// ---------------------------------------------------------------------------
// Section 3: Generic container selectors (used when no framework matches)
// ---------------------------------------------------------------------------
const GENERIC_CONTAINER_SELECTORS = [
  '[id*="cookie-banner"]', '[id*="cookiebanner"]',
  '[id*="cookie-consent"]', '[id*="cookieconsent"]',
  '[id*="cookie-notice"]', '[id*="cookienotice"]',
  '[id*="cookie-bar"]', '[id*="cookiebar"]',
  '[id*="gdpr-banner"]', '[id*="gdprbanner"]',
  '[id*="gdpr-popup"]', '[id*="gdprpopup"]',
  '[id*="consent-banner"]', '[id*="consentbanner"]',
  '[id*="consent-modal"]', '[id*="consentmodal"]',
  '[id*="privacy-banner"]',
  '[class*="cookie-banner"]', '[class*="cookiebanner"]',
  '[class*="cookie-consent"]', '[class*="cookieconsent"]',
  '[class*="cookie-notice"]', '[class*="cookienotice"]',
  '[class*="cookie-bar"]', '[class*="cookiebar"]',
  '[class*="cookie-popup"]', '[class*="cookiepopup"]',
  '[class*="gdpr-banner"]', '[class*="gdpr-notice"]',
  '[class*="consent-banner"]', '[class*="consent-popup"]',
  '[class*="consent-modal"]',
  '[role="dialog"][aria-label*="cookie" i]',
  '[role="dialog"][aria-label*="consent" i]',
  '[role="dialog"][aria-label*="privacy" i]',
  '[role="alertdialog"]',
];

// ---------------------------------------------------------------------------
// Section 4: Utility functions
// ---------------------------------------------------------------------------

function isVisible(el) {
  if (!el) return false;
  const style = getComputedStyle(el);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    el.offsetWidth > 0 &&
    el.offsetHeight > 0
  );
}

function normalizeText(str) {
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

function findButtonByText(container, textList) {
  const candidates = container.querySelectorAll(
    'button, [role="button"], input[type="button"], input[type="submit"], a.btn, a.button, a[class*="btn"]'
  );

  for (const el of candidates) {
    if (!isVisible(el)) continue;

    const text = normalizeText(el.innerText || el.textContent || '');
    const ariaLabel = normalizeText(el.getAttribute('aria-label') || '');
    const value = normalizeText(el.getAttribute('value') || '');

    for (const matcher of textList) {
      if (text === matcher || text.includes(matcher) ||
          ariaLabel === matcher || ariaLabel.includes(matcher) ||
          value === matcher || value.includes(matcher)) {
        return el;
      }
    }
  }
  return null;
}

function clickElement(el) {
  if (!el) return false;
  try {
    el.click();
    return true;
  } catch (e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Section 5: Main consent handler
// ---------------------------------------------------------------------------

function handleConsent(preference) {
  if (!preference) return false;
  const textMatchers = TEXT_MATCHERS[preference];
  if (!textMatchers) return false;

  // --- Layer 1: Framework-specific selectors ---
  for (const framework of FRAMEWORK_SELECTORS) {
    const container = document.querySelector(framework.container);
    if (!container || !isVisible(container)) continue;

    const selectorKey = preference; // 'accept_all', 'reject_all', 'necessary_only'
    const btnSelector = framework[selectorKey];

    if (btnSelector) {
      const btn = container.querySelector(btnSelector) || document.querySelector(btnSelector);
      if (btn && isVisible(btn)) {
        if (clickElement(btn)) return true;
      }
    }

    // Fallback to text matching within this framework's container
    const textBtn = findButtonByText(container, textMatchers);
    if (textBtn && clickElement(textBtn)) return true;
  }

  // --- Layer 2 & 3: Generic containers + text matching ---
  for (const selector of GENERIC_CONTAINER_SELECTORS) {
    let containers;
    try {
      containers = document.querySelectorAll(selector);
    } catch (e) {
      continue;
    }

    for (const container of containers) {
      if (!isVisible(container)) continue;
      const btn = findButtonByText(container, textMatchers);
      if (btn && clickElement(btn)) return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Section 6: Shadow DOM handling (Usercentrics and similar)
// ---------------------------------------------------------------------------

function handleShadowDOM(preference) {
  const textMatchers = TEXT_MATCHERS[preference];
  if (!textMatchers) return false;

  const shadowHosts = [
    '#usercentrics-root',
    'uc-privacy-shield',
    '#usercentrics-cmp-ui',
  ];

  for (const hostSelector of shadowHosts) {
    const host = document.querySelector(hostSelector);
    if (!host || !host.shadowRoot) continue;

    const btn = findButtonByText(host.shadowRoot, textMatchers);
    if (btn && clickElement(btn)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Section 7: MutationObserver for dynamically injected popups
// ---------------------------------------------------------------------------

function initObserver(preference) {
  let handled = false;
  let debounceTimer = null;
  let safetyTimer = null;
  let observer = null;

  function tryHandle() {
    if (handled) return;
    const success = handleConsent(preference) || handleShadowDOM(preference);
    if (success) {
      handled = true;
      cleanup();
    }
  }

  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (safetyTimer) clearTimeout(safetyTimer);
    if (debounceTimer) clearTimeout(debounceTimer);
  }

  observer = new MutationObserver(() => {
    if (handled) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(tryHandle, 100);
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Safety disconnect after 30 seconds
  safetyTimer = setTimeout(cleanup, 30000);
}

// ---------------------------------------------------------------------------
// Section 8: Entry point
// ---------------------------------------------------------------------------

// Avoid re-running if we already handled consent in this page session.
// Key is namespaced with the extension ID so a page cannot pre-set it to
// suppress the extension (S4).
const FLAG_KEY = `gdpr_handler_done_${chrome.runtime.id}`;
const VALID_PREFS = ['reject_all', 'necessary_only', 'accept_all'];

if (!sessionStorage.getItem(FLAG_KEY)) {
  chrome.storage.sync.get('preference', (data) => {
    // Validate preference against the allowed enum before using it (S3).
    const preference = VALID_PREFS.includes(data.preference) ? data.preference : 'reject_all';

    // Mark as handled to prevent duplicate runs
    const markHandled = () => sessionStorage.setItem(FLAG_KEY, '1');

    // Try immediately (for synchronously rendered banners)
    const handled = handleConsent(preference) || handleShadowDOM(preference);
    if (handled) {
      markHandled();
      return;
    }

    // Watch for dynamically injected banners
    initObserver(preference);

    // Re-check after short delays to catch late-loading banners.
    // Guard each timer with the session flag so they stop firing after
    // the observer or an earlier timer already succeeded (S5).
    [500, 1500, 3000].forEach((delay) => {
      setTimeout(() => {
        if (sessionStorage.getItem(FLAG_KEY)) return;
        const success = handleConsent(preference) || handleShadowDOM(preference);
        if (success) markHandled();
      }, delay);
    });
  });
}
