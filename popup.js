document.getElementById('frequencyInput').addEventListener('input', function() {
    document.getElementById('frequencyValue').textContent = this.value;
});

document.getElementById('startRegister').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url?.includes('horizon.mcgill.ca')) {
      updateStatus('Please open Minerva registration page first');
      return;
    }

    const crns = document.getElementById('crnInput').value
      .split('\n')
      .map(crn => crn.trim())
      .filter(crn => crn.length > 0);

    if (crns.length === 0) {
      updateStatus('Please enter at least one CRN');
      return;
    }

    const frequency = Math.max(5, Math.min(300, parseInt(document.getElementById('frequencyInput').value) || 30));

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch {} // Ignore if script is already loaded

    await chrome.tabs.sendMessage(tab.id, { 
      action: 'START_REGISTRATION',
      crns,
      frequency
    });
    updateStatus('Registration process started...');
  } catch (error) {
    console.error('Error:', error);
    updateStatus('Error: Please refresh the Minerva page and try again');
  }
});

document.getElementById('stopRegister').addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    await chrome.tabs.sendMessage(tab.id, { action: 'STOP_REGISTRATION' });
    updateStatus('Registration process stopped.');
  } catch {
    updateStatus('Registration process stopped.');
  }
});

function updateStatus(message) {
  document.getElementById('status').textContent = message;
} 