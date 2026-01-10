// Service worker for Manipulation Radar extension

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Manipulation Radar extension installed');
  
  // Set default settings
  chrome.storage.sync.set({
    enabled: true,
    sensitivity: 'medium',
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['enabled', 'sensitivity'], (result) => {
      sendResponse(result);
    });
    return true; // Keep channel open for async response
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This is handled by the popup, but we can add logic here if needed
});
