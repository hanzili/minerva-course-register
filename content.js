// Helper function to wait for an element to appear
function waitForElement(selector) {
  return new Promise(resolve => {
    // If the element is already there, resolve immediately
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    // Otherwise, wait for mutations
    const observer = new MutationObserver(() => {
      const elem = document.querySelector(selector);
      if (elem) {
        observer.disconnect();
        resolve(elem);
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
let checkFrequency = 30; // Default check frequency in minutes
let checkInterval = null;

// Initialize state from storage when the script loads
chrome.storage.local.get(['isRunning', 'targetCRNs', 'checkFrequency', 'waitlistSubmitted'], (result) => {
  isRunning = result.isRunning || false;
  targetCRNs = result.targetCRNs || [];
  checkFrequency = result.checkFrequency || 30;

  if (isRunning) {
    // Handle waitlist options immediately after page load
    handleWaitlistOptions();

    // Set up interval to attempt registration if not already set
    if (!checkInterval) {
      checkInterval = setInterval(startRegistrationProcess, checkFrequency * 60000);
      console.log(`[Minerva] Restored registration process, retrying every ${checkFrequency} minutes`);
    }
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
      checkFrequency: checkFrequency,
      waitlistSubmitted: false
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
      checkFrequency: 30,
      waitlistSubmitted: false
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

  if (window.location.href.includes('P_AltPin') || window.location.href.includes('P_Regs')) {
    console.log('[Minerva] Starting normal registration process...');

    // Before starting, reset the waitlistSubmitted flag
    chrome.storage.local.set({ waitlistSubmitted: false });

    // 1) Fill in CRNs for normal registration
    const crnInputs = document.querySelectorAll('input[id^="crn_id"]');
    for (let i = 0; i < targetCRNs.length && i < crnInputs.length; i++) {
      crnInputs[i].value = targetCRNs[i];
    }

    // 2) Click the "Submit Changes" button for a normal submit
    const submitButton = Array.from(document.querySelectorAll('input[type="submit"]'))
      .find(button => button.value === 'Submit Changes');

    if (submitButton) {
      console.log('[Minerva] Submitting normal registration...');
      submitButton.click();
      // After this point, the page will reload, and our script will restart
      // The waitlist handling will occur in handleWaitlistOptions upon script load
    } else {
      console.log('[Minerva] "Submit Changes" button not found.');
      return;
    }
  } else {
    console.log('[Minerva] Not on registration page.');
  }
}

async function handleWaitlistOptions() {
  if (!isRunning) {
    return;
  }

  // Check if we have just submitted waitlist options
  chrome.storage.local.get(['waitlistSubmitted'], async (result) => {
    if (result.waitlistSubmitted) {
      console.log('[Minerva] Waitlist options already submitted, no action needed');
      // Reset the flag for the next cycle
      chrome.storage.local.set({ waitlistSubmitted: false });
      return;
    } else {
      // Proceed to check for waitlist options
      await processWaitlistOptions();
    }
  });
}

async function processWaitlistOptions() {
  if (window.location.href.includes('P_AltPin') || window.location.href.includes('P_Regs')) {
    // Wait for the results table to appear
    console.log('[Minerva] Waiting for results table...');
    const resultTable = await waitForElement('table.datadisplaytable');

    if (resultTable) {
      console.log('[Minerva] Results table found. Checking for waitlist options...');
      const waitlistSelects = document.querySelectorAll('select[name="RSTS_IN"]');
      let waitlistFound = false;

      waitlistSelects.forEach(select => {
        // If there's an option to join waitlist, select it
        const waitlistOption = Array.from(select.options).find(option => option.value === 'LW');
        if (waitlistOption) {
          select.value = 'LW';
          waitlistFound = true;
          console.log('[Minerva] Waitlist option selected for one of the courses.');
        }
      });

      if (waitlistFound) {
        // Submit the form
        const submitButton = Array.from(document.querySelectorAll('input[type="submit"]'))
          .find(button => button.value === 'Submit Changes');

        if (submitButton) {
          console.log('[Minerva] Submitting waitlist registration...');
          // Set a flag indicating we've just submitted waitlist options
          chrome.storage.local.set({ waitlistSubmitted: true });
          submitButton.click();
          // The page will refresh again after this
        } else {
          console.log('[Minerva] Submit button not found for waitlist submission');
        }
      } else {
        console.log('[Minerva] No waitlist options found.');
      }
    } else {
      console.log('[Minerva] Results table not found, cannot check for waitlist options.');
    }
  } else {
    console.log('[Minerva] Not on registration page.');
  }
} 