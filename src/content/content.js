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
let selectedMessage = null;
let messageDataMap = new Map(); // Map message elements to their data

// Observer for chat messages
let messageObserver = null;
let inputObserver = null;
let promptSuggestionCard = null;
let typingTimeout = null;
let processedInputs = new WeakSet(); // Track inputs that already have listeners

// Helper function to get score color class
function getScoreColorClass(score) {
  if (score >= 90) return '#74c69d'; // green-400
  if (score >= 70) return '#facc15'; // yellow-400
  if (score >= 50) return '#fb923c'; // orange-400
  return '#f87171'; // red-400
}

// Helper function to get score background color
function getScoreBgColorClass(score) {
  if (score >= 90) return 'rgba(34, 197, 94, 0.2)'; // green-500/20
  if (score >= 70) return 'rgba(234, 179, 8, 0.2)'; // yellow-500/20
  if (score >= 50) return 'rgba(249, 115, 22, 0.2)'; // orange-500/20
  return 'rgba(239, 68, 68, 0.2)'; // red-500/20
}

// Inject score badge below AI message
function injectScoreBadge(messageEl, messageData) {
  // Check if badge already exists
  const existingBadge = messageEl.querySelector('.manipulation-radar-score-badge');
  if (existingBadge) {
    return; // Badge already exists
  }

  // Create badge container with glassmorphism
  const badge = document.createElement('div');
  badge.className = 'manipulation-radar-score-badge';
  
  // Apply glassmorphism background based on score
  const bgColor = getScoreBgColorClass(messageData.score);
  // Convert hex/rgb to rgba with transparency for glassmorphism
  let glassBg = 'rgba(31, 41, 55, 0.7)'; // Default dark glass
  let borderColor = 'rgba(255, 255, 255, 0.1)';
  let textColor = '#e5e7eb';
  
  if (messageData.score >= 90) {
    glassBg = 'rgba(34, 197, 94, 0.15)'; // Green tint
    borderColor = 'rgba(74, 222, 128, 0.3)';
    textColor = '#74c69d';
  } else if (messageData.score >= 70) {
    glassBg = 'rgba(234, 179, 8, 0.15)'; // Yellow tint
    borderColor = 'rgba(250, 204, 21, 0.3)';
    textColor = '#facc15';
  } else if (messageData.score >= 50) {
    glassBg = 'rgba(249, 115, 22, 0.15)'; // Orange tint
    borderColor = 'rgba(251, 146, 60, 0.3)';
    textColor = '#fb923c';
  } else {
    glassBg = 'rgba(239, 68, 68, 0.15)'; // Red tint
    borderColor = 'rgba(248, 113, 113, 0.3)';
    textColor = '#f87171';
  }
  
  badge.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    margin-top: 6px;
    margin-bottom: 6px;
    background: ${glassBg};
    backdrop-filter: blur(12px) saturate(180%);
    -webkit-backdrop-filter: blur(12px) saturate(180%);
    border: 1px solid ${borderColor};
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    z-index: 1000;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  `;
  
  // Add shield/radar icon
  const iconSpan = document.createElement('span');
  iconSpan.textContent = '🛡️';
  iconSpan.style.cssText = `
    font-size: 14px;
    line-height: 1;
  `;
  badge.appendChild(iconSpan);

  // Create score display
  const scoreSpan = document.createElement('span');
  scoreSpan.style.cssText = `
    font-size: 15px;
    font-weight: 700;
    color: ${textColor};
    line-height: 1;
  `;
  scoreSpan.textContent = messageData.score;
  badge.appendChild(scoreSpan);
  
  // Hover effects handled by CSS class, but add smooth transitions
  badge.onmouseenter = () => {
    badge.style.transform = 'translateY(-2px) scale(1.03)';
    badge.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)';
    badge.style.borderColor = borderColor.replace('0.3', '0.5');
  };
  badge.onmouseleave = () => {
    badge.style.transform = 'translateY(0) scale(1)';
    badge.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
    badge.style.borderColor = borderColor;
  };

  // Add flag count if any (with glassmorphism)
  if (messageData.flags && messageData.flags.length > 0) {
    const flagBadge = document.createElement('span');
    flagBadge.style.cssText = `
      font-size: 11px;
      padding: 2px 8px;
      background: rgba(239, 68, 68, 0.2);
      backdrop-filter: blur(8px) saturate(180%);
      -webkit-backdrop-filter: blur(8px) saturate(180%);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.4);
      border-radius: 12px;
      font-weight: 600;
      line-height: 1.2;
    `;
    flagBadge.textContent = `${messageData.flags.length} flag${messageData.flags.length > 1 ? 's' : ''}`;
    badge.appendChild(flagBadge);
  }

  // Add click handler
  badge.onclick = (e) => {
    e.stopPropagation();
    handleBadgeClick(messageData);
  };

  // Find the best place to insert the badge
  // Try to insert after the message content
  const messageContent = messageEl.querySelector('[data-message-content]') || 
                         messageEl.querySelector('.markdown') ||
                         messageEl.querySelector('.prose') ||
                         messageEl;
  
  // Insert after the message content or at the end of the message element
  if (messageContent && messageContent !== messageEl) {
    messageContent.parentNode.insertBefore(badge, messageContent.nextSibling);
  } else {
    messageEl.appendChild(badge);
  }

  // Store message data with unique ID
  const messageId = `msg-${messageData.timestamp}-${Date.now()}`;
  badge.setAttribute('data-message-id', messageId);
  messageDataMap.set(messageId, messageData);
}

// Handle badge click - open sidebar with message details
function handleBadgeClick(messageData) {
  selectedMessage = messageData;
  
  // Update sidebar with selected message
  // The sidebar component will auto-expand if collapsed (via useEffect)
  updateSidebar();
  
  // Scroll sidebar into view if needed
  if (sidebarContainer) {
    sidebarContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Inject "Improve Prompt" button below user message
function injectImprovePromptButton(messageEl, messageText) {
  // Check if button already exists
  const existingButton = messageEl.querySelector('.manipulation-radar-improve-prompt-btn');
  if (existingButton) {
    return;
  }

  const button = document.createElement('button');
  button.className = 'manipulation-radar-improve-prompt-btn';
  button.textContent = '✨ Improve Prompt';
  // Inline styles are minimal - CSS class handles most styling
  button.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
  `;
  // Hover effects are handled by CSS class
  button.onclick = (e) => {
    e.stopPropagation();
    alert('Prompt improvement feature coming soon! This will use backend AI to suggest better prompts.');
  };

  // Insert after message content
  const messageContent = messageEl.querySelector('[data-message-content]') ||
                         messageEl.querySelector('.markdown') ||
                         messageEl.querySelector('.prose') ||
                         messageEl;
  
  if (messageContent && messageContent !== messageEl) {
    messageContent.parentNode.insertBefore(button, messageContent.nextSibling);
  } else {
    messageEl.appendChild(button);
  }
}

// Show prompt suggestion while typing
function showPromptSuggestion(inputEl) {
  // Remove existing suggestion if any
  if (promptSuggestionCard) {
    // Only remove if it's not attached to the current input's container
    const currentContainer = inputEl.closest('form') || inputEl.parentElement;
    if (promptSuggestionCard.parentElement !== currentContainer) {
      promptSuggestionCard.remove();
      promptSuggestionCard = null;
    } else {
      // Already showing for this input, just reset the timeout
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        if (promptSuggestionCard) {
          promptSuggestionCard.remove();
          promptSuggestionCard = null;
        }
      }, 2000);
      return;
    }
  }

  // Check if input has enough characters
  const text = inputEl.value || inputEl.textContent || '';
  if (text.trim().length < 2) {
    return;
  }

  // Create suggestion card with glassmorphism
  const card = document.createElement('div');
  card.className = 'manipulation-radar-prompt-suggestion';
  card.textContent = '✨ Improve Prompt';
  // Minimal inline styles - CSS class handles glassmorphism styling
  card.style.cssText = `
    position: fixed;
    z-index: 10000;
    pointer-events: auto;
  `;
  
  // Calculate position relative to input element
  const updatePosition = () => {
    const rect = inputEl.getBoundingClientRect();
    card.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    card.style.right = `${window.innerWidth - rect.right}px`;
  };
  
  updatePosition();
  
  // Update position on scroll/resize
  const positionUpdater = () => {
    if (document.body.contains(card)) {
      updatePosition();
    }
  };
  
  window.addEventListener('scroll', positionUpdater, true);
  window.addEventListener('resize', positionUpdater);
  
  // Store cleanup function
  card._cleanup = () => {
    window.removeEventListener('scroll', positionUpdater, true);
    window.removeEventListener('resize', positionUpdater);
  };
  
  // Hover effects are handled by CSS class
  card.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    alert('Prompt improvement feature coming soon! This will use backend AI to suggest better prompts.');
    if (card._cleanup) card._cleanup();
    card.remove();
    promptSuggestionCard = null;
  };

  // Append to body to avoid DOM mutation issues
  document.body.appendChild(card);
  promptSuggestionCard = card;

  // Auto-hide after 2 seconds of no typing
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    if (promptSuggestionCard && promptSuggestionCard === card) {
      if (card._cleanup) card._cleanup();
      card.remove();
      promptSuggestionCard = null;
    }
  }, 2000);
}

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

          // Create message data object
          const messageData = {
            text: textContent,
            score,
            flags,
            timestamp: Date.now(),
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          };

          // Add to message history
          messageHistory.unshift(messageData);
          messageHistory = messageHistory.slice(0, 50); // Keep last 50 messages

          // Inject score badge
          injectScoreBadge(messageEl, messageData);

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

// Observe user messages to inject "Improve Prompt" buttons
function observeUserMessages() {
  const userSelectors = [
    '[data-message-author-role="user"]',
    '[data-author="user"]',
  ];

  const processedUserMessages = new Set();

  const checkForUserMessages = () => {
    for (const selector of userSelectors) {
      const messages = document.querySelectorAll(selector);
      
      messages.forEach((messageEl) => {
        const messageId = messageEl.getAttribute('data-mr-processed');
        if (messageId && processedUserMessages.has(messageId)) {
          return;
        }

        const textContent = messageEl.textContent || messageEl.innerText || '';
        if (textContent.trim().length > 0) {
          const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          messageEl.setAttribute('data-mr-processed', id);
          processedUserMessages.add(id);
          
          // Inject button after a short delay to ensure message is fully rendered
          setTimeout(() => {
            injectImprovePromptButton(messageEl, textContent);
          }, 500);
        }
      });
    }
  };

  checkForUserMessages();

  const userMessageObserver = new MutationObserver(() => {
    checkForUserMessages();
  });

  userMessageObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

// Observe input fields for typing detection
function observeInputFields() {
  const inputSelectors = [
    'textarea[data-id]',
    '#prompt-textarea',
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="message"]',
    'textarea[aria-label*="message" i]',
    'textarea[aria-label*="Message" i]',
  ];

  // Store handlers to properly remove them
  const inputHandlers = new WeakMap();

  const handleInput = (inputEl) => {
    if (!inputEl || processedInputs.has(inputEl)) return;
    
    // Mark as processed
    processedInputs.add(inputEl);

    const handleTyping = () => {
      const text = inputEl.value || inputEl.textContent || '';
      if (text.trim().length >= 2) {
        showPromptSuggestion(inputEl);
      } else {
        // Hide suggestion if input is too short
        if (promptSuggestionCard) {
          if (promptSuggestionCard._cleanup) promptSuggestionCard._cleanup();
          promptSuggestionCard.remove();
          promptSuggestionCard = null;
        }
      }
    };

    // Store handler for later removal
    inputHandlers.set(inputEl, handleTyping);
    
    // Add listeners with passive option for better performance
    inputEl.addEventListener('input', handleTyping, { passive: true });
    inputEl.addEventListener('keyup', handleTyping, { passive: true });
  };

  let checkTimeout = null;
  const checkForInputs = () => {
    // Debounce to avoid excessive checking
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(() => {
      for (const selector of inputSelectors) {
        const inputs = document.querySelectorAll(selector);
        inputs.forEach(handleInput);
      }

      // Also check for any textarea that might be an input field
      const allTextareas = document.querySelectorAll('textarea');
      allTextareas.forEach((textarea) => {
        // Skip if already processed
        if (processedInputs.has(textarea)) return;
        
        // Check if it's likely an input field (not a message display)
        const role = textarea.getAttribute('role');
        const isInput = !textarea.hasAttribute('readonly') && 
                       !textarea.disabled &&
                       (role !== 'textbox' || textarea.closest('[data-message-author-role]') === null);
        
        if (isInput) {
          handleInput(textarea);
        }
      });
    }, 100); // Debounce by 100ms
  };

  checkForInputs();

  // Use a more targeted observer to avoid excessive callbacks
  const inputObserver = new MutationObserver((mutations) => {
    // Only check if textareas were added/modified
    const hasTextareaChange = mutations.some(mutation => {
      return Array.from(mutation.addedNodes).some(node => 
        node.nodeType === 1 && (node.tagName === 'TEXTAREA' || node.querySelector('textarea'))
      );
    });
    
    if (hasTextareaChange) {
      checkForInputs();
    }
  });

  inputObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function updateSidebar() {
  if (sidebarRoot) {
    sidebarRoot.render(
      React.createElement(Sidebar, {
        trustScore: currentTrustScore,
        recentFlags: recentFlags,
        messageHistory: messageHistory,
        selectedMessage: selectedMessage,
        onBackToOverview: () => {
          selectedMessage = null;
          updateSidebar();
        },
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
      observeUserMessages();
      observeInputFields();
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
