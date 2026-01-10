import React from 'react';
import { createRoot } from 'react-dom/client';
import Sidebar from './Sidebar.jsx';
import { detectManipulation } from '../lib/detectors.js';
import { calculateTrustScore } from '../lib/scorer.js';
import '../styles.css';
import './content.css';

// Initialize the sidebar
let sidebarRoot = null;
let sidebarContainer = null;

function createSidebar() {
  // Remove existing sidebar if present
  if (sidebarContainer) {
    sidebarContainer.remove();
    sidebarRoot = null;
  }

  // Create sidebar container
  sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'manipulation-radar-sidebar';
  sidebarContainer.style.cssText = `
    position: fixed;
    right: 0;
    z-index: 999999;
    pointer-events: none;
  `;

  document.body.appendChild(sidebarContainer);

  try {
    console.log('Manipulation Radar: Creating sidebar...', {
      container: sidebarContainer,
      hasReact: typeof React !== 'undefined',
      hasCreateRoot: typeof createRoot !== 'undefined',
      hasSidebar: typeof Sidebar !== 'undefined'
    });
    
    // Create React root and render sidebar
    if (!sidebarRoot) {
      sidebarRoot = createRoot(sidebarContainer);
    }
    
    const sidebarElement = React.createElement(Sidebar, {
      trustScore: currentTrustScore,
      recentFlags: recentFlags,
      messageHistory: messageHistory,
    });
    
    sidebarRoot.render(sidebarElement);
    console.log('Manipulation Radar: Sidebar rendered successfully', {
      trustScore: currentTrustScore,
      flagsCount: recentFlags.length
    });
  } catch (error) {
    console.error('Manipulation Radar: Error creating sidebar', error);
    console.error('Error stack:', error.stack);
    // Fallback: show error message with visible styling
    sidebarContainer.style.pointerEvents = 'auto';
    sidebarContainer.style.backgroundColor = '#1f2937';
    sidebarContainer.style.color = 'white';
    sidebarContainer.style.padding = '20px';
    sidebarContainer.style.width = '320px';
    sidebarContainer.style.height = '100vh';
    sidebarContainer.innerHTML = `
      <div style="font-family: system-ui;">
        <h3 style="color: #ef4444; margin-bottom: 10px;">Manipulation Radar Error</h3>
        <p style="color: #fca5a5; margin-bottom: 5px;">${error.message}</p>
        <p style="color: #94a3b8; font-size: 12px;">Check console for details.</p>
        <pre style="background: #0f172a; padding: 10px; border-radius: 4px; font-size: 11px; overflow: auto; margin-top: 10px;">${error.stack}</pre>
      </div>
    `;
  }
}

// State management
let messageHistory = [];
let currentTrustScore = 100;
let recentFlags = [];

// Observer for chat messages
let messageObserver = null;

function observeMessages() {
  // Different selectors for ChatGPT and Claude
  const chatSelectors = [
    // ChatGPT selectors
    '[data-message-author-role="assistant"]',
    '.group.w-full',
    // Claude selectors
    '[data-author="assistant"]',
    '.message-content',
  ];

  let lastProcessedMessage = null;

  const checkForNewMessages = () => {
    for (const selector of chatSelectors) {
      const messages = document.querySelectorAll(selector);
      
      messages.forEach((messageEl) => {
        // Skip if already processed
        if (messageEl.dataset.processed === 'true') {
          return;
        }

        // Get text content
        const textContent = messageEl.textContent || messageEl.innerText || '';
        
        if (textContent.trim().length > 0 && textContent !== lastProcessedMessage) {
          lastProcessedMessage = textContent;
          messageEl.dataset.processed = 'true';

          // Analyze message
          const score = calculateTrustScore(textContent);
          const { flags } = detectManipulation(textContent);

          // Update state
          currentTrustScore = score;
          
          // Add new flags to recent flags (keep last 10)
          if (flags.length > 0) {
            flags.forEach(flag => {
              recentFlags.unshift({
                ...flag,
                timestamp: Date.now(),
                message: textContent.substring(0, 100) + '...',
              });
            });
            recentFlags = recentFlags.slice(0, 10);
          }

          // Add to message history
          messageHistory.unshift({
            text: textContent,
            score,
            flags,
            timestamp: Date.now(),
          });
          messageHistory = messageHistory.slice(0, 50); // Keep last 50 messages

          // Update sidebar
          updateSidebar();
        }
      });
    }
  };

  // Initial check
  checkForNewMessages();

  // Observe DOM changes
  messageObserver = new MutationObserver(() => {
    checkForNewMessages();
  });

  messageObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function updateSidebar() {
  if (sidebarRoot) {
    sidebarRoot.render(
      React.createElement(Sidebar, {
        trustScore: currentTrustScore,
        recentFlags: recentFlags,
        messageHistory: messageHistory,
      })
    );
  }
}

// Initialize when page loads
function init() {
  console.log('Manipulation Radar: Initializing...', {
    readyState: document.readyState,
    url: window.location.href
  });
  
  // Wait for page to be ready
  const initialize = () => {
    try {
      if (!document.body) {
        console.log('Manipulation Radar: Waiting for body...');
        setTimeout(initialize, 100);
        return;
      }
      console.log('Manipulation Radar: Body found, creating sidebar...');
      createSidebar();
      observeMessages();
    } catch (error) {
      console.error('Manipulation Radar: Initialization error', error);
      console.error('Error stack:', error.stack);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('Manipulation Radar: DOMContentLoaded fired');
      setTimeout(initialize, 500);
    });
  } else {
    console.log('Manipulation Radar: Document already ready');
    setTimeout(initialize, 500);
  }
}

// Start initialization
init();

// Re-initialize on navigation (for SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(() => {
      if (!sidebarContainer) {
        createSidebar();
        observeMessages();
      }
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });
