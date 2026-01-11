import React from 'react';
import { createRoot } from 'react-dom/client';
import Sidebar from './Sidebar.jsx';
// Keep imports for future backend use, but don't call automatically
// import { detectManipulation } from '../lib/detectors.js';
// import { calculateTrustScore } from '../lib/scorer.js';
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
      verificationHistory: verificationHistory,
      lockState: lockState,
      onTakeover: handleTakeover,
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
let recentFlags = []; // Array of verification results/flags
let selectedMessage = null;
let verificationHistory = []; // Array of completed verifications
let messageDataMap = new Map(); // Map message elements to their data

// Lock state management
let lockState = {
  isActive: false,
  ownerTabId: null,
  ownerUrl: null,
  since: null,
};
let heartbeatInterval = null;
let userMessageObserver = null; // Track separately for cleanup

// Verification state management
let verificationStates = new Map(); // Track verification state per message: "not_verified" | "verifying" | "verified"
let verifiedMessages = new Map(); // Store verification results per message ID

// Import Supabase configuration (set at build time via environment variables)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';

// Supabase configuration (hardcoded at build time - these are public values)
const supabaseConfig = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
};

// Validate configuration
if (!supabaseConfig.url || !supabaseConfig.anonKey) {
  console.error(
    'Manipulation Radar: Supabase not configured. ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables and rebuild the extension.'
  );
}

// Track conversation context (user prompts and assistant responses)
let conversationContext = []; // Array of {role: 'user'|'assistant', content: string, messageId: string}

// Observer for chat messages
let messageObserver = null;
let inputObserver = null;
let promptSuggestionCard = null;
let typingTimeout = null;
let processedInputs = new WeakSet(); // Track inputs that already have listeners

/**
 * Detect platform from URL
 * @param {string} url - URL to check
 * @returns {string|null} - "chatgpt", "claude", or null
 */
function detectPlatform(url) {
  if (!url) url = window.location.href;
  if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
    return 'chatgpt';
  }
  if (url.includes('claude.ai')) {
    return 'claude';
  }
  return null;
}

/**
 * Request lock from background service worker
 * @returns {Promise<boolean>} - True if lock was granted
 */
async function requestLock() {
  const platform = detectPlatform();
  if (!platform) {
    console.warn('Manipulation Radar: Unsupported platform');
    return false;
  }

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'LOCK_REQUEST',
          platform,
          url: window.location.href,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });

    if (response.granted) {
      lockState.isActive = true;
      lockState.ownerTabId = response.ownerTabId;
      console.log('Manipulation Radar: Lock granted');
      return true;
    } else {
      lockState.isActive = false;
      lockState.ownerTabId = response.ownerTabId;
      lockState.ownerUrl = response.ownerUrl;
      lockState.since = response.since;
      console.log('Manipulation Radar: Lock denied - active in tab', response.ownerTabId);
      return false;
    }
  } catch (error) {
    console.error('Manipulation Radar: Error requesting lock', error);
    lockState.isActive = false;
    return false;
  }
}

/**
 * Start heartbeat to keep lock alive
 */
function startHeartbeat() {
  // Clear existing heartbeat if any
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  const platform = detectPlatform();
  if (!platform) return;

  heartbeatInterval = setInterval(() => {
    // Only send heartbeat if tab is visible
    if (document.visibilityState === 'visible' && lockState.isActive) {
      chrome.runtime.sendMessage(
        {
          type: 'LOCK_HEARTBEAT',
          platform,
          url: window.location.href,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('Manipulation Radar: Heartbeat error', chrome.runtime.lastError);
          } else if (response && !response.accepted) {
            // Lock was revoked
            console.log('Manipulation Radar: Heartbeat not accepted, lock may be revoked');
            handleLockRevoked();
          }
        }
      );
    }
  }, 30000); // 30 seconds
}

/**
 * Stop all analysis and observers
 */
function stopAnalysis() {
  console.log('Manipulation Radar: Stopping analysis');

  // Stop all observers
  if (messageObserver) {
    messageObserver.disconnect();
    messageObserver = null;
  }

  if (userMessageObserver) {
    userMessageObserver.disconnect();
    userMessageObserver = null;
  }

  if (inputObserver) {
    inputObserver.disconnect();
    inputObserver = null;
  }

  // Clear heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Clear typing timeout
  if (typingTimeout) {
    clearTimeout(typingTimeout);
    typingTimeout = null;
  }

  // Remove prompt suggestion card
  if (promptSuggestionCard) {
    if (promptSuggestionCard._cleanup) promptSuggestionCard._cleanup();
    promptSuggestionCard.remove();
    promptSuggestionCard = null;
  }

  // Update lock state
  lockState.isActive = false;

  // Update sidebar to show locked mode
  updateSidebar();
}

/**
 * Handle lock takeover request
 */
async function handleTakeover() {
  const platform = detectPlatform();
  if (!platform) {
    console.warn('Manipulation Radar: Cannot takeover - unsupported platform');
    return;
  }

  try {
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'LOCK_TAKEOVER',
          platform,
          url: window.location.href,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });

    if (response.granted) {
      // Update lock state
      lockState.isActive = true;
      lockState.ownerTabId = null; // We own it now
      lockState.ownerUrl = null;
      lockState.since = null;
      console.log('Manipulation Radar: Lock taken over successfully');
      
      // Update sidebar to show active state
      updateSidebar();
      
      // Start analysis (this will check lockState.isActive internally)
      startAnalysis();
    } else {
      console.error('Manipulation Radar: Takeover failed', response.error);
      // Re-request lock to get updated state
      await requestLock();
      // Update sidebar to show current state
      updateSidebar();
    }
  } catch (error) {
    console.error('Manipulation Radar: Error during takeover', error);
    // On error, try to refresh lock state
    try {
      await requestLock();
      updateSidebar();
    } catch (refreshError) {
      console.error('Manipulation Radar: Error refreshing lock state', refreshError);
    }
  }
}

/**
 * Handle lock revoked message
 */
function handleLockRevoked() {
  console.log('Manipulation Radar: Lock revoked');
  // Update lock state to reflect revoked status
  lockState.isActive = false;
  lockState.ownerTabId = null;
  lockState.ownerUrl = null;
  lockState.since = null;
  stopAnalysis();
  // Sidebar will be updated by stopAnalysis() which calls updateSidebar()
}

/**
 * Start analysis (observers and heartbeat)
 */
function startAnalysis() {
  if (!lockState.isActive) {
    console.warn('Manipulation Radar: Cannot start analysis - lock not active');
    return;
  }

  console.log('Manipulation Radar: Starting analysis');
  
  // Stop any existing observers first to avoid duplicates
  if (messageObserver) {
    messageObserver.disconnect();
    messageObserver = null;
  }
  if (userMessageObserver) {
    userMessageObserver.disconnect();
    userMessageObserver = null;
  }
  if (inputObserver) {
    inputObserver.disconnect();
    inputObserver = null;
  }
  
  // Start observers
  observeMessages();
  observeUserMessages();
  observeInputFields();
  
  // Start heartbeat
  startHeartbeat();
}

// Helper function to get score color class
function getScoreColorClass(score) {
  if (score >= 90) return '#74c69d'; // green-400
  if (score >= 70) return '#facc15'; // yellow-400
  if (score >= 50) return '#fb923c'; // orange-400
  return '#f87171'; // red-400
}

// Helper function to get score background color (kept for potential future use)
function getScoreBgColorClass(score) {
  if (score >= 90) return 'rgba(34, 197, 94, 0.2)'; // green-500/20
  if (score >= 70) return 'rgba(234, 179, 8, 0.2)'; // yellow-500/20
  if (score >= 50) return 'rgba(249, 115, 22, 0.2)'; // orange-500/20
  return 'rgba(239, 68, 68, 0.2)'; // red-500/20
}

// Authentication removed - no token required

/**
 * Get user prompt for a given assistant message
 * @param {string} messageId - Assistant message ID
 * @returns {string|null} User prompt or null
 */
function getUserPromptForMessage(messageId) {
  // Find the user message that precedes this assistant message
  const messageIndex = conversationContext.findIndex(msg => msg.messageId === messageId);
  if (messageIndex > 0) {
    const prevMessage = conversationContext[messageIndex - 1];
    if (prevMessage.role === 'user') {
      return prevMessage.content;
    }
  }
  // Try to find the most recent user message
  for (let i = conversationContext.length - 1; i >= 0; i--) {
    if (conversationContext[i].role === 'user') {
      return conversationContext[i].content;
    }
  }
  return null;
}

/**
 * Get conversation context (last 4 turns)
 * @param {string} messageId - Current message ID
 * @returns {Array} Context array
 */
function getConversationContext(messageId) {
  const messageIndex = conversationContext.findIndex(msg => msg.messageId === messageId);
  if (messageIndex === -1) return [];
  
  // Get last 4 turns (8 messages max: 4 user + 4 assistant)
  const startIndex = Math.max(0, messageIndex - 7);
  return conversationContext.slice(startIndex, messageIndex + 1).map(msg => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Call Supabase Edge Function to verify message
 * @param {string} messageId - Unique message ID
 * @param {string} messageText - Message text to verify
 * @returns {Promise<Object>} Verification result
 */
async function verifyMessage(messageId, messageText) {
  // Check if Supabase is configured
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    throw new Error(
      'Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
      'environment variables and rebuild the extension.'
    );
  }

  // Get user prompt and context
  const userPrompt = getUserPromptForMessage(messageId);
  const context = getConversationContext(messageId);
  const platform = detectPlatform();

  // Prepare request
  const requestBody = {
    message_id: messageId,
    platform: platform || 'other',
    assistant_response: messageText,
    options: {
      sensitivity: 'medium',
      return_spans: true,
      max_suggestions: 5,
      store_event: false, // Set to true if you want to log events
    },
  };

  if (userPrompt) {
    requestBody.user_prompt = userPrompt;
  }

  if (context.length > 0) {
    requestBody.context = context;
  }

  // Call Supabase Edge Function
  // Note: Supabase requires Authorization header, but we use anon key for anonymous access
  // Ensure URL doesn't have trailing slash
  const baseUrl = supabaseConfig.url.replace(/\/$/, '');
  const functionUrl = `${baseUrl}/functions/v1/verify-manipulation`;
  
  console.log('Manipulation Radar: Calling verify-manipulation', {
    messageId,
    messageTextPreview: messageText.substring(0, 50) + '...',
    messageTextLength: messageText.length,
    hasUserPrompt: !!userPrompt,
    contextLength: context.length,
    urlPreview: functionUrl.substring(0, 50) + '...',
  });
  
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60';
        throw new Error(`Rate limit exceeded. Please try again in ${retryAfter} seconds.`);
      } else {
        throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`);
      }
    }

    const data = await response.json();
    
    // Transform backend response to frontend format
    return {
      success: true,
      message: data.manipulation.risk_score === 0 
        ? 'No issues found - You can trust this response'
        : `Risk score: ${data.manipulation.risk_score}/100 (${data.manipulation.risk_level})`,
      riskScore: data.manipulation.risk_score,
      riskLevel: data.manipulation.risk_level,
      reliabilityScore: data.reliability.score,
      reliabilityLevel: data.reliability.level,
      detections: data.manipulation.detections || [],
      countsByType: data.manipulation.counts_by_type || {},
      topIssues: data.reliability.top_issues || [],
      suggestions: data.suggestions || [],
      meta: data.meta,
    };
  } catch (error) {
    console.error('Manipulation Radar: Verification error', error);
    console.error('Manipulation Radar: Error details', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      config: {
        hasUrl: !!supabaseConfig.url,
        urlPreview: supabaseConfig.url ? `${supabaseConfig.url.substring(0, 30)}...` : 'MISSING',
        hasKey: !!supabaseConfig.anonKey,
      }
    });
    
    // Provide more helpful error messages
    if (error instanceof TypeError && error.message.includes('fetch')) {
      if (!supabaseConfig.url || !supabaseConfig.anonKey) {
        throw new Error(
          'Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
          'environment variables and rebuild the extension.'
        );
      }
      
      // Check for CORS or network issues
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error(
          `Network error: Unable to reach Supabase. ` +
          `This could be a CORS issue or network problem. ` +
          `Check the browser console for details. ` +
          `URL: ${supabaseConfig.url.substring(0, 50)}...`
        );
      }
      
      throw new Error(
        `Network error: ${error.message}. ` +
        `Check that your Supabase URL is correct and the function is deployed.`
      );
    }
    
    throw error;
  }
}

/**
 * Call improve-prompt Edge Function
 * @param {string} promptText - Original prompt text
 * @returns {Promise<Object>} Improvement result
 */
async function improvePrompt(promptText) {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    throw new Error(
      'Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
      'environment variables and rebuild the extension.'
    );
  }

  const baseUrl = supabaseConfig.url.replace(/\/$/, '');
  const functionUrl = `${baseUrl}/functions/v1/improve-prompt`;
  
  console.log('Manipulation Radar: Calling improve-prompt', {
    promptLength: promptText.length,
  });
  
  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
      },
      body: JSON.stringify({
        prompt: promptText,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      rewritten_prompt: data.rewritten_prompt || promptText,
      response_requirements: data.response_requirements || [],
      why_this_is_better: data.why_this_is_better || [],
      meta: data.meta,
    };
  } catch (error) {
    console.error('Manipulation Radar: Improvement error', error);
    throw error;
  }
}

/**
 * Show improvement process for a prompt
 * @param {string} promptText - Original prompt text
 * @param {HTMLElement} messageEl - Message element (for user messages) or input element
 */
async function showImprovementProcess(promptText, messageEl) {
  // Check if already improving
  const existingProcess = messageEl.querySelector('.manipulation-radar-improvement-process');
  if (existingProcess) {
    return; // Already processing
  }

  // Create improvement container
  const improvementContainer = document.createElement('div');
  improvementContainer.className = 'manipulation-radar-improvement-process';
  improvementContainer.setAttribute('data-prompt-text', promptText);

  const stepDisplay = document.createElement('div');
  stepDisplay.className = 'manipulation-radar-improvement-step';
  stepDisplay.textContent = 'Generating...';

  const spinner = document.createElement('div');
  spinner.className = 'manipulation-radar-improvement-spinner';
  improvementContainer.appendChild(spinner);
  improvementContainer.appendChild(stepDisplay);

  // Insert after the message or button
  const button = messageEl.querySelector('.manipulation-radar-improve-prompt-btn');
  if (button) {
    button.style.display = 'none'; // Hide button while processing
    button.parentNode.insertBefore(improvementContainer, button.nextSibling);
  } else {
    messageEl.appendChild(improvementContainer);
  }

  try {
    // Call improve-prompt function
    const result = await improvePrompt(promptText);
    
    // Remove loading UI
    spinner.remove();
    stepDisplay.remove();
    
    // Show result
    showImprovementResult(promptText, messageEl, result, improvementContainer);
  } catch (error) {
    console.error('Manipulation Radar: Improvement error', error);
    
    // Remove loading UI
    spinner.remove();
    stepDisplay.remove();
    
    // Show error
    const errorDiv = document.createElement('div');
    errorDiv.className = 'manipulation-radar-improvement-error';
    errorDiv.textContent = `Error: ${error.message || 'Failed to improve prompt'}`;
    improvementContainer.appendChild(errorDiv);
    
    // Show button again
    if (button) {
      button.style.display = 'inline-flex';
    }
  }
}

/**
 * Show improvement process for input field (while typing)
 * @param {string} promptText - Original prompt text
 * @param {HTMLElement} inputEl - Input element
 */
async function showImprovementProcessForInput(promptText, inputEl) {
  // Create a modal/overlay for input improvements
  const modal = document.createElement('div');
  modal.className = 'manipulation-radar-improvement-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    z-index: 100000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: #1f2937;
    border-radius: 16px;
    padding: 24px;
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  `;

  const stepDisplay = document.createElement('div');
  stepDisplay.className = 'manipulation-radar-improvement-step';
  stepDisplay.textContent = 'Generating improved prompt...';
  stepDisplay.style.cssText = `
    color: #60a5fa;
    font-size: 16px;
    margin-bottom: 20px;
    text-align: center;
  `;

  const spinner = document.createElement('div');
  spinner.className = 'manipulation-radar-improvement-spinner';
  spinner.style.cssText = `
    width: 40px;
    height: 40px;
    margin: 0 auto 20px;
  `;

  content.appendChild(spinner);
  content.appendChild(stepDisplay);
  modal.appendChild(content);
  document.body.appendChild(modal);

  try {
    const result = await improvePrompt(promptText);
    
    // Remove loading UI
    spinner.remove();
    stepDisplay.remove();
    
    // Show result in modal
    showImprovementResultInModal(result, content, modal, inputEl);
  } catch (error) {
    console.error('Manipulation Radar: Improvement error', error);
    
    spinner.remove();
    stepDisplay.remove();
    
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      color: #ef4444;
      padding: 16px;
      background: rgba(239, 68, 68, 0.1);
      border-radius: 8px;
      margin-top: 16px;
    `;
    errorDiv.textContent = `Error: ${error.message || 'Failed to improve prompt'}`;
    content.appendChild(errorDiv);
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
      margin-top: 16px;
      padding: 8px 16px;
      background: #374151;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    `;
    closeBtn.onclick = () => modal.remove();
    content.appendChild(closeBtn);
  }
}

/**
 * Show improvement result below message
 * @param {string} originalPrompt - Original prompt text
 * @param {HTMLElement} messageEl - Message element
 * @param {Object} result - Improvement result
 * @param {HTMLElement} container - Container element
 */
function showImprovementResult(originalPrompt, messageEl, result, container) {
  const resultDiv = document.createElement('div');
  resultDiv.className = 'manipulation-radar-improvement-result';
  resultDiv.style.cssText = `
    margin-top: 12px;
    padding: 16px;
    background: rgba(34, 197, 94, 0.1);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 12px;
    color: #86efac;
  `;

  const title = document.createElement('div');
  title.style.cssText = 'font-weight: 600; margin-bottom: 12px; font-size: 14px;';
  title.textContent = '✨ Improved Prompt:';
  resultDiv.appendChild(title);

  const improvedPrompt = document.createElement('div');
  improvedPrompt.style.cssText = `
    background: rgba(0, 0, 0, 0.3);
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 12px;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-wrap: break-word;
  `;
  improvedPrompt.textContent = result.rewritten_prompt;
  resultDiv.appendChild(improvedPrompt);

  // Add copy button
  const copyBtn = document.createElement('button');
  copyBtn.textContent = '📋 Copy Improved Prompt';
  copyBtn.style.cssText = `
    padding: 6px 12px;
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid rgba(34, 197, 94, 0.4);
    border-radius: 8px;
    color: #86efac;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    margin-right: 8px;
  `;
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(result.rewritten_prompt);
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => {
      copyBtn.textContent = '📋 Copy Improved Prompt';
    }, 2000);
  };
  resultDiv.appendChild(copyBtn);

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Close';
  closeBtn.style.cssText = `
    padding: 6px 12px;
    background: rgba(107, 114, 128, 0.2);
    border: 1px solid rgba(107, 114, 128, 0.4);
    border-radius: 8px;
    color: #9ca3af;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
  `;
  closeBtn.onclick = () => {
    container.remove();
    const button = messageEl.querySelector('.manipulation-radar-improve-prompt-btn');
    if (button) {
      button.style.display = 'inline-flex';
    }
  };
  resultDiv.appendChild(closeBtn);

  container.appendChild(resultDiv);
}

/**
 * Show improvement result in modal (for input field)
 * @param {Object} result - Improvement result
 * @param {HTMLElement} content - Modal content element
 * @param {HTMLElement} modal - Modal element
 * @param {HTMLElement} inputEl - Input element
 */
function showImprovementResultInModal(result, content, modal, inputEl) {
  const title = document.createElement('h3');
  title.textContent = '✨ Improved Prompt';
  title.style.cssText = `
    color: #86efac;
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 16px;
  `;
  content.appendChild(title);

  const improvedPrompt = document.createElement('div');
  improvedPrompt.style.cssText = `
    background: rgba(0, 0, 0, 0.3);
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    font-size: 14px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-wrap: break-word;
    color: #e5e7eb;
    max-height: 300px;
    overflow-y: auto;
  `;
  improvedPrompt.textContent = result.rewritten_prompt;
  content.appendChild(improvedPrompt);

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  `;

  // Insert into input button
  const insertBtn = document.createElement('button');
  insertBtn.textContent = '📝 Insert into Input';
  insertBtn.style.cssText = `
    padding: 10px 20px;
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid rgba(34, 197, 94, 0.4);
    border-radius: 8px;
    color: #86efac;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    flex: 1;
  `;
  insertBtn.onclick = () => {
    if (inputEl.value !== undefined) {
      inputEl.value = result.rewritten_prompt;
    } else {
      inputEl.textContent = result.rewritten_prompt;
    }
    // Trigger input event
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    modal.remove();
  };
  buttonContainer.appendChild(insertBtn);

  // Copy button
  const copyBtn = document.createElement('button');
  copyBtn.textContent = '📋 Copy';
  copyBtn.style.cssText = `
    padding: 10px 20px;
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.4);
    border-radius: 8px;
    color: #60a5fa;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    flex: 1;
  `;
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(result.rewritten_prompt);
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => {
      copyBtn.textContent = '📋 Copy';
    }, 2000);
  };
  buttonContainer.appendChild(copyBtn);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Close';
  closeBtn.style.cssText = `
    padding: 10px 20px;
    background: rgba(107, 114, 128, 0.2);
    border: 1px solid rgba(107, 114, 128, 0.4);
    border-radius: 8px;
    color: #9ca3af;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    flex: 1;
  `;
  closeBtn.onclick = () => modal.remove();
  buttonContainer.appendChild(closeBtn);

  content.appendChild(buttonContainer);
}

/**
 * Inject "Verify Response" button below AI message
 * @param {HTMLElement} messageEl - Message element
 * @param {string} messageText - Message text
 * @param {string} messageId - Unique message ID
 */
function injectVerifyButton(messageEl, messageText, messageId) {
  // Check if button already exists
  const existingButton = messageEl.querySelector('.manipulation-radar-verify-btn');
  if (existingButton) {
    return; // Button already exists
  }

  // Check if verification UI already exists
  const existingVerification = messageEl.querySelector('.manipulation-radar-verification-process');
  if (existingVerification) {
    return; // Verification already in progress or completed
  }

  // Create button element
  const button = document.createElement('button');
  button.className = 'manipulation-radar-verify-btn';
  button.textContent = '🔍 Verify Response';
  button.setAttribute('data-message-id', messageId);
  
  // Click handler
  button.onclick = (e) => {
    e.stopPropagation();
    const state = verificationStates.get(messageId);
    if (state === 'verifying') {
      return; // Already verifying
    }
    showVerificationProcess(messageId, messageText, messageEl);
  };

  // Find the best place to insert the button
  const messageContent = messageEl.querySelector('[data-message-content]') || 
                         messageEl.querySelector('.markdown') ||
                         messageEl.querySelector('.prose') ||
                         messageEl;
  
  // Insert after the message content or at the end of the message element
  if (messageContent && messageContent !== messageEl) {
    messageContent.parentNode.insertBefore(button, messageContent.nextSibling);
  } else {
    messageEl.appendChild(button);
  }
}

/**
 * Show verification process with streaming animation
 * @param {string} messageId - Unique message ID
 * @param {string} messageText - Message text to verify
 * @param {HTMLElement} messageEl - Message element
 */
async function showVerificationProcess(messageId, messageText, messageEl) {
  // Check if already verifying or verified
  const currentState = verificationStates.get(messageId);
  if (currentState === 'verifying') {
    return; // Already verifying
  }

  // Check if already verified - show cached result
  if (currentState === 'verified' && verifiedMessages.has(messageId)) {
    const result = verifiedMessages.get(messageId);
    showVerificationResult(messageId, messageText, messageEl, result);
    return;
  }

  // Set state to verifying
  verificationStates.set(messageId, 'verifying');

  // Find button to update
  const button = messageEl.querySelector(`.manipulation-radar-verify-btn[data-message-id="${messageId}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = '⏳ Verifying...';
  }

  // Create verification UI container
  const verificationContainer = document.createElement('div');
  verificationContainer.className = 'manipulation-radar-verification-process';
  verificationContainer.setAttribute('data-message-id', messageId);

  // Create single step display (replaces previous line)
  const stepDisplay = document.createElement('div');
  stepDisplay.className = 'manipulation-radar-verification-step';

  // Create spinner
  const spinner = document.createElement('div');
  spinner.className = 'manipulation-radar-verification-spinner';
  verificationContainer.appendChild(spinner);
  verificationContainer.appendChild(stepDisplay);

  // Insert verification UI after button
  if (button && button.nextSibling) {
    button.parentNode.insertBefore(verificationContainer, button.nextSibling);
  } else if (button) {
    button.parentNode.appendChild(verificationContainer);
  } else {
    // Fallback: insert after message content
    const messageContent = messageEl.querySelector('[data-message-content]') || 
                           messageEl.querySelector('.markdown') ||
                           messageEl.querySelector('.prose') ||
                           messageEl;
    if (messageContent && messageContent !== messageEl) {
      messageContent.parentNode.insertBefore(verificationContainer, messageContent.nextSibling);
    } else {
      messageEl.appendChild(verificationContainer);
    }
  }

  // Verification steps
  const verificationSteps = [
    "Checking for manipulation patterns...",
    "Analyzing language for sycophancy...",
    "Checking for flattery and persuasion...",
    "Scanning for emotional manipulation...",
    "Verifying factual accuracy...",
    "Finalizing analysis..."
  ];

  // Stream steps one at a time (replacing previous line)
  for (let i = 0; i < verificationSteps.length; i++) {
    await new Promise(resolve => setTimeout(resolve, i === 0 ? 500 : 600 + (i * 100)));
    
    // Update the single step display (replaces previous text)
    stepDisplay.textContent = verificationSteps[i];
  }

  // Call verification function
  let result;
  try {
    result = await verifyMessage(messageId, messageText);
    
    // Store result
    verifiedMessages.set(messageId, result);
    verificationStates.set(messageId, 'verified');
    
    // Add to verification history
    const verificationEntry = {
      messageId,
      messageText: messageText.substring(0, 200), // Truncate for display
      timestamp: Date.now(),
      riskScore: result.riskScore || 0,
      riskLevel: result.riskLevel || 'Low',
      reliabilityScore: result.reliabilityScore || 100,
      reliabilityLevel: result.reliabilityLevel || 'High',
      detections: result.detections || [],
      topIssues: result.topIssues || [],
    };
    
    verificationHistory.unshift(verificationEntry);
    verificationHistory = verificationHistory.slice(0, 20); // Keep last 20 verifications
    
    // Update recentFlags for sidebar display
    if (result.detections && result.detections.length > 0) {
      result.detections.forEach((detection) => {
        recentFlags.unshift({
          type: detection.type,
          severity: detection.severity >= 7 ? 'high' : detection.severity >= 4 ? 'medium' : 'low',
          message: detection.rationale || `${detection.type} detected`,
          timestamp: Date.now(),
          matchedText: detection.spans ? 'See spans' : undefined,
        });
      });
      recentFlags = recentFlags.slice(0, 50); // Keep last 50 flags
    } else {
      // Add a "no issues" entry
      recentFlags.unshift({
        type: 'none',
        severity: 'low',
        message: 'No manipulation detected',
        timestamp: Date.now(),
      });
      recentFlags = recentFlags.slice(0, 50);
    }
    
    // Update sidebar
    updateSidebar();
  } catch (error) {
    console.error('Manipulation Radar: Verification failed', error);
    
    // Show error message
    stepDisplay.textContent = `Error: ${error.message}`;
    stepDisplay.style.color = '#ef4444';
    
    // Reset button state
    if (button) {
      button.disabled = false;
      button.textContent = '🔍 Verify Response';
    }
    
    // Reset verification state
    verificationStates.set(messageId, 'not_verified');
    
    // Remove UI after 5 seconds
    setTimeout(() => {
      spinner.remove();
      stepDisplay.remove();
      verificationContainer.remove();
    }, 5000);
    
    return;
  }

  // Remove spinner and step display, show result
  spinner.remove();
  stepDisplay.remove();
  
  // Show result
  showVerificationResult(messageId, messageText, messageEl, result, verificationContainer);
}

/**
 * Show verification result
 * @param {string} messageId - Unique message ID
 * @param {string} messageText - Message text
 * @param {HTMLElement} messageEl - Message element
 * @param {Object} result - Verification result
 * @param {HTMLElement} container - Existing container or null
 */
/**
 * Insert suggestion prompt into input field
 * @param {string} promptText - Prompt text to insert
 */
function insertSuggestionPrompt(promptText) {
  // Find the input field (ChatGPT or Claude)
  const inputSelectors = [
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="message"]',
    'textarea[data-id="root"]',
    '#prompt-textarea',
    'textarea',
  ];

  let inputEl = null;
  for (const selector of inputSelectors) {
    inputEl = document.querySelector(selector);
    if (inputEl && inputEl.offsetParent !== null) { // Check if visible
      break;
    }
  }

  if (!inputEl) {
    console.warn('Manipulation Radar: Could not find input field');
    return;
  }

  // Insert the prompt text
  const currentValue = inputEl.value || '';
  inputEl.value = promptText;
  inputEl.focus();

  // Trigger input event for ChatGPT/Claude to recognize the change
  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  inputEl.dispatchEvent(new Event('change', { bubbles: true }));

  // Scroll input into view
  inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showVerificationResult(messageId, messageText, messageEl, result, container = null) {
  // Remove existing result if any
  const existingResult = messageEl.querySelector(`.manipulation-radar-verification-result[data-message-id="${messageId}"]`);
  if (existingResult) {
    existingResult.remove();
  }

  // Use existing container or create new one
  if (!container) {
    container = messageEl.querySelector(`.manipulation-radar-verification-process[data-message-id="${messageId}"]`);
    if (!container) {
      container = document.createElement('div');
      container.className = 'manipulation-radar-verification-process';
      container.setAttribute('data-message-id', messageId);
      
      const button = messageEl.querySelector(`.manipulation-radar-verify-btn[data-message-id="${messageId}"]`);
      if (button && button.nextSibling) {
        button.parentNode.insertBefore(container, button.nextSibling);
      } else if (button) {
        button.parentNode.appendChild(container);
      }
    }
  }

  // Create result element
  const resultEl = document.createElement('div');
  resultEl.className = 'manipulation-radar-verification-result';
  resultEl.setAttribute('data-message-id', messageId);
  resultEl.style.cssText = `
    background: rgba(31, 41, 55, 0.95);
    backdrop-filter: blur(12px) saturate(180%);
    -webkit-backdrop-filter: blur(12px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 16px;
    margin-top: 12px;
    color: #e5e7eb;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  `;

  // Create result header
  const header = document.createElement('div');
  header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;';
  
  const headerLeft = document.createElement('div');
  headerLeft.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  
  const checkmark = document.createElement('span');
  checkmark.textContent = result.riskScore === 0 ? '✓' : '⚠';
  checkmark.style.cssText = `
    font-size: 20px;
    color: ${result.riskScore === 0 ? '#10b981' : result.riskScore < 50 ? '#f59e0b' : '#ef4444'};
  `;
  
  const title = document.createElement('span');
  title.textContent = 'Verification Complete';
  title.style.cssText = 'font-weight: 600; font-size: 14px; color: #e5e7eb;';
  
  headerLeft.appendChild(checkmark);
  headerLeft.appendChild(title);
  header.appendChild(headerLeft);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  `;
  closeBtn.onmouseover = () => {
    closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    closeBtn.style.color = '#e5e7eb';
  };
  closeBtn.onmouseout = () => {
    closeBtn.style.backgroundColor = 'transparent';
    closeBtn.style.color = '#9ca3af';
  };
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    container.remove();
    // Reset button state
    const button = messageEl.querySelector(`.manipulation-radar-verify-btn[data-message-id="${messageId}"]`);
    if (button) {
      button.disabled = false;
      button.textContent = '🔍 Verify Response';
    }
  };
  header.appendChild(closeBtn);
  resultEl.appendChild(header);

  // Scores section
  const scoresSection = document.createElement('div');
  scoresSection.style.cssText = 'display: flex; gap: 12px; margin-bottom: 12px;';
  
  // Risk score
  const riskScoreEl = document.createElement('div');
  riskScoreEl.style.cssText = `
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 8px;
    text-align: center;
  `;
  const riskLabel = document.createElement('div');
  riskLabel.textContent = 'Risk Score (Lower is better)';
  riskLabel.style.cssText = 'font-size: 11px; color: #9ca3af; margin-bottom: 4px;';
  const riskValue = document.createElement('div');
  riskValue.textContent = `${result.riskScore || 0}/100`;
  riskValue.style.cssText = `
    font-size: 18px;
    font-weight: 700;
    color: ${result.riskScore === 0 ? '#10b981' : result.riskScore < 50 ? '#f59e0b' : '#ef4444'};
  `;
  const riskLevel = document.createElement('div');
  riskLevel.textContent = result.riskLevel || 'Low';
  riskLevel.style.cssText = 'font-size: 10px; color: #9ca3af; margin-top: 2px;';
  riskScoreEl.appendChild(riskLabel);
  riskScoreEl.appendChild(riskValue);
  riskScoreEl.appendChild(riskLevel);
  
  // Reliability score
  const reliabilityScoreEl = document.createElement('div');
  reliabilityScoreEl.style.cssText = `
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 8px;
    text-align: center;
  `;
  const reliabilityLabel = document.createElement('div');
  reliabilityLabel.textContent = 'Reliability (Higher is better)';
  reliabilityLabel.style.cssText = 'font-size: 11px; color: #9ca3af; margin-bottom: 4px;';
  const reliabilityValue = document.createElement('div');
  reliabilityValue.textContent = `${result.reliabilityScore || 100}/100`;
  reliabilityValue.style.cssText = `
    font-size: 18px;
    font-weight: 700;
    color: ${result.reliabilityScore >= 90 ? '#10b981' : result.reliabilityScore >= 70 ? '#f59e0b' : '#ef4444'};
  `;
  const reliabilityLevel = document.createElement('div');
  reliabilityLevel.textContent = result.reliabilityLevel || 'High';
  reliabilityLevel.style.cssText = 'font-size: 10px; color: #9ca3af; margin-top: 2px;';
  reliabilityScoreEl.appendChild(reliabilityLabel);
  reliabilityScoreEl.appendChild(reliabilityValue);
  reliabilityScoreEl.appendChild(reliabilityLevel);
  
  scoresSection.appendChild(riskScoreEl);
  scoresSection.appendChild(reliabilityScoreEl);
  resultEl.appendChild(scoresSection);

  // Detections section (if any)
  if (result.detections && result.detections.length > 0) {
    const detectionsSection = document.createElement('div');
    detectionsSection.style.cssText = 'margin-bottom: 12px;';
    const detectionsTitle = document.createElement('div');
    detectionsTitle.textContent = `Detected Issues (${result.detections.length})`;
    detectionsTitle.style.cssText = 'font-size: 12px; font-weight: 600; color: #e5e7eb; margin-bottom: 8px;';
    detectionsSection.appendChild(detectionsTitle);
    
    result.detections.slice(0, 3).forEach(detection => {
      const detectionEl = document.createElement('div');
      detectionEl.style.cssText = `
        background: rgba(239, 68, 68, 0.1);
        border-left: 3px solid rgba(239, 68, 68, 0.5);
        border-radius: 4px;
        padding: 8px;
        margin-bottom: 6px;
        font-size: 12px;
      `;
      const detectionType = document.createElement('div');
      detectionType.textContent = `${detection.type} (Severity: ${detection.severity}/10)`;
      detectionType.style.cssText = 'font-weight: 600; color: #fca5a5; margin-bottom: 4px;';
      const detectionRationale = document.createElement('div');
      detectionRationale.textContent = detection.rationale || '';
      detectionRationale.style.cssText = 'color: #d1d5db; font-size: 11px;';
      detectionEl.appendChild(detectionType);
      detectionEl.appendChild(detectionRationale);
      detectionsSection.appendChild(detectionEl);
    });
    
    resultEl.appendChild(detectionsSection);
  }

  // Top issues section (if any)
  if (result.topIssues && result.topIssues.length > 0) {
    const issuesSection = document.createElement('div');
    issuesSection.style.cssText = 'margin-bottom: 12px;';
    const issuesTitle = document.createElement('div');
    issuesTitle.textContent = 'Reliability Concerns';
    issuesTitle.style.cssText = 'font-size: 12px; font-weight: 600; color: #e5e7eb; margin-bottom: 8px;';
    issuesSection.appendChild(issuesTitle);
    
    const issuesList = document.createElement('ul');
    issuesList.style.cssText = 'list-style: none; padding: 0; margin: 0;';
    result.topIssues.slice(0, 3).forEach(issue => {
      const issueEl = document.createElement('li');
      issueEl.textContent = `• ${issue}`;
      issueEl.style.cssText = 'font-size: 11px; color: #d1d5db; margin-bottom: 4px; padding-left: 8px;';
      issuesList.appendChild(issueEl);
    });
    issuesSection.appendChild(issuesList);
    resultEl.appendChild(issuesSection);
  }

  // Suggestions section
  if (result.suggestions && result.suggestions.length > 0) {
    const suggestionsSection = document.createElement('div');
    suggestionsSection.style.cssText = 'margin-top: 12px;';
    const suggestionsTitle = document.createElement('div');
    suggestionsTitle.textContent = 'Suggested Follow-ups';
    suggestionsTitle.style.cssText = 'font-size: 12px; font-weight: 600; color: #e5e7eb; margin-bottom: 8px;';
    suggestionsSection.appendChild(suggestionsTitle);
    
    const suggestionsList = document.createElement('div');
    suggestionsList.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
    
    result.suggestions.forEach((suggestion, index) => {
      const suggestionBtn = document.createElement('button');
      suggestionBtn.textContent = suggestion.label || `Suggestion ${index + 1}`;
      suggestionBtn.style.cssText = `
        background: rgba(59, 130, 246, 0.15);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(96, 165, 250, 0.3);
        border-radius: 12px;
        padding: 8px 12px;
        color: #60a5fa;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s;
      `;
      suggestionBtn.onmouseover = () => {
        suggestionBtn.style.background = 'rgba(59, 130, 246, 0.25)';
        suggestionBtn.style.borderColor = 'rgba(96, 165, 250, 0.5)';
        suggestionBtn.style.transform = 'translateY(-1px)';
      };
      suggestionBtn.onmouseout = () => {
        suggestionBtn.style.background = 'rgba(59, 130, 246, 0.15)';
        suggestionBtn.style.borderColor = 'rgba(96, 165, 250, 0.3)';
        suggestionBtn.style.transform = 'translateY(0)';
      };
      suggestionBtn.onclick = (e) => {
        e.stopPropagation();
        if (suggestion.prompt_to_insert) {
          insertSuggestionPrompt(suggestion.prompt_to_insert);
        }
      };
      suggestionsList.appendChild(suggestionBtn);
    });
    
    suggestionsSection.appendChild(suggestionsList);
    resultEl.appendChild(suggestionsSection);
  }

  container.appendChild(resultEl);

  // Update button state
  const button = messageEl.querySelector(`.manipulation-radar-verify-btn[data-message-id="${messageId}"]`);
  if (button) {
    button.disabled = false;
    button.textContent = '✓ Verified';
    button.style.opacity = '0.7';
  }
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

// Handle badge click - open sidebar with message details (DEPRECATED - kept for reference)
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

  // Check if improvement UI already exists
  const existingImprovement = messageEl.querySelector('.manipulation-radar-improvement-process');
  if (existingImprovement) {
    return; // Improvement already in progress or completed
  }

  const button = document.createElement('button');
  button.className = 'manipulation-radar-improve-prompt-btn';
  button.textContent = '✨ Improve Prompt';
  button.setAttribute('data-prompt-text', messageText);
  // Inline styles are minimal - CSS class handles most styling
  button.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
  `;
  // Hover effects are handled by CSS class
  button.onclick = (e) => {
    e.stopPropagation();
    showImprovementProcess(messageText, messageEl);
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
  card.onclick = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Get the current input text
    const currentText = inputEl.value || inputEl.textContent || '';
    if (currentText.trim().length < 2) {
      return;
    }
    
    // Show improvement process
    showImprovementProcessForInput(currentText, inputEl);
    
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
  // Only observe if lock is active
  if (!lockState.isActive) {
    console.log('Manipulation Radar: Skipping observeMessages - lock not active');
    return;
  }

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

          // Create unique message ID based on content hash + timestamp to ensure uniqueness
          // This ensures same content gets same ID (for caching), but different messages get different IDs
          const contentHash = textContent.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          const messageId = `msg-${Date.now()}-${contentHash}-${Math.random().toString(36).substr(2, 9)}`;
          
          console.log('Manipulation Radar: New message detected', {
            messageId,
            textPreview: textContent.substring(0, 50) + '...',
            textLength: textContent.length,
          });
          
          // Create message data object (without analysis)
          const messageData = {
            text: textContent,
            timestamp: Date.now(),
            id: messageId,
          };

          // Add to message history (without scores/flags)
          messageHistory.unshift(messageData);
          messageHistory = messageHistory.slice(0, 50); // Keep last 50 messages

          // Initialize verification state
          verificationStates.set(messageId, 'not_verified');

          // Inject verify button instead of score badge
          injectVerifyButton(messageEl, textContent, messageId);
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
          
          // Add to conversation context
          conversationContext.unshift({
            role: 'user',
            content: textContent,
            messageId: id,
          });
          conversationContext = conversationContext.slice(0, 20); // Keep last 20 messages
          
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
  // Only observe if lock is active
  if (!lockState.isActive) {
    console.log('Manipulation Radar: Skipping observeInputFields - lock not active');
    return;
  }
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
        verificationHistory: verificationHistory,
        selectedMessage: selectedMessage,
        onBackToOverview: () => {
          selectedMessage = null;
          updateSidebar();
        },
        lockState: lockState,
        onTakeover: handleTakeover,
      })
    );
  }
}

// Initialize when page loads
// Listen for lock revocation messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOCK_REVOKED') {
    console.log('Manipulation Radar: Received LOCK_REVOKED message');
    handleLockRevoked();
    sendResponse({ received: true });
  }
  return true;
});

function init() {
  console.log('Manipulation Radar: Initializing...', {
    readyState: document.readyState,
    url: window.location.href
  });
  
  // Wait for page to be ready
  const initialize = async () => {
    try {
      if (!document.body) {
        console.log('Manipulation Radar: Waiting for body...');
        setTimeout(initialize, 100);
        return;
      }
      console.log('Manipulation Radar: Body found, creating sidebar...');
      
      // Request lock before creating sidebar
      const lockGranted = await requestLock();
      
      // Create sidebar with correct lock state
      createSidebar();
      
      if (lockGranted) {
        // Lock granted - start analysis
        startAnalysis();
      } else {
        // Lock denied - show locked mode UI
        console.log('Manipulation Radar: Lock denied, showing locked mode');
        // Sidebar already created with lock state, just ensure it's updated
        updateSidebar();
      }
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
    setTimeout(async () => {
      if (!sidebarContainer) {
        createSidebar();
        // Re-request lock on navigation (lock persists if still on supported site)
        const platform = detectPlatform();
        if (platform) {
          const lockGranted = await requestLock();
          if (lockGranted) {
            startAnalysis();
          } else {
            updateSidebar();
          }
        }
      }
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });
