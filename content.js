// Helper function to wait for an element to appear
function waitForElement(selector) {
  return new Promise(resolve => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

let isRunning = false;
let targetCRNs = []; // Will be populated from popup
let checkFrequency = 30; // Default check frequency in seconds
let checkInterval = null;

// Initialize state from storage when the script loads
chrome.storage.local.get(['isRunning', 'targetCRNs', 'checkFrequency'], (result) => {
  if (result.isRunning && !checkInterval) {
    isRunning = result.isRunning;
    targetCRNs = result.targetCRNs || [];
    checkFrequency = result.checkFrequency || 30;

    // Optionally remove this immediate call if you do NOT want it to run right away:
    // startRegistrationProcess();

    checkInterval = setInterval(startRegistrationProcess, checkFrequency * 60000);
    console.log(`[Minerva] Restored registration process, retrying every ${checkFrequency} minutes`);
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_REGISTRATION') {
    isRunning = true;
    targetCRNs = message.crns || [];
    checkFrequency = message.frequency || 30;
    
    // Store state in chrome.storage
    chrome.storage.local.set({
      isRunning: true,
      targetCRNs: targetCRNs,
      checkFrequency: checkFrequency
    });

    startRegistrationProcess();
    
    // Clear existing interval if any
    if (checkInterval) {
      clearInterval(checkInterval);
    }
    
    // Set up new interval
    checkInterval = setInterval(startRegistrationProcess, checkFrequency * 60000);
  } else if (message.action === 'STOP_REGISTRATION') {
    isRunning = false;
    // Clear stored state
    chrome.storage.local.set({
      isRunning: false,
      targetCRNs: [],
      checkFrequency: 30
    });
    
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }
});

async function startRegistrationProcess() {
  if (!isRunning) {
    return;
  }

  // Check if we're on the registration page
  if (window.location.href.includes('P_AltPin') || window.location.href.includes('P_Regs')) {
    // Fill in the CRN fields
    const crnInputs = document.querySelectorAll('input[id^="crn_id"]');
    
    for (let i = 0; i < targetCRNs.length && i < crnInputs.length; i++) {
      crnInputs[i].value = targetCRNs[i];
    }

    // Click the Submit Changes button
    const submitButton = Array.from(document.querySelectorAll('input[type="submit"]'))
      .find(button => button.value === 'Submit Changes');
    
    if (submitButton) {
      submitButton.click();
    } else {
      console.log('[Minerva] Submit button not found!');
    }
  }
} 