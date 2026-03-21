// Service worker: sets a privacy-safe default preference on first install.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.get('preference', (data) => {
      if (!data.preference) {
        chrome.storage.sync.set({ preference: 'reject_all' });
      }
    });
  }
});
