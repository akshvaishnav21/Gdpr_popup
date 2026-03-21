document.addEventListener('DOMContentLoaded', () => {
  const saveBtn = document.getElementById('save-btn');
  const statusMsg = document.getElementById('status-msg');
  const radios = document.querySelectorAll('input[name="preference"]');

  // Load saved preference and pre-select the matching radio
  chrome.storage.sync.get('preference', (data) => {
    const saved = data.preference || 'reject_all';
    const match = document.querySelector(`input[value="${saved}"]`);
    if (match) match.checked = true;
  });

  saveBtn.addEventListener('click', () => {
    const selected = document.querySelector('input[name="preference"]:checked');
    if (!selected) return;

    chrome.storage.sync.set({ preference: selected.value }, () => {
      showStatus('Preference saved!');
    });
  });

  function showStatus(message) {
    statusMsg.textContent = message;
    statusMsg.classList.add('visible');

    clearTimeout(showStatus._timer);
    showStatus._timer = setTimeout(() => {
      statusMsg.classList.remove('visible');
    }, 2000);
  }
});
