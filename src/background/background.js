// Service worker for Manipulation Radar extension

/**
 * LockManager - Manages single-active-tab lock system
 * Ensures only one tab can run analysis at a time across all browser windows
 */
class LockManager {
  constructor() {
    this.lockQueue = Promise.resolve(); // Promise-based queue for mutex
    this.STALE_THRESHOLD = 90000; // 90 seconds
  }

  /**
   * Execute a lock operation in the queue (mutex)
   */
  async queueOperation(operation) {
    this.lockQueue = this.lockQueue.then(operation).catch(err => {
      console.error('LockManager: Queue operation error', err);
      throw err;
    });
    return this.lockQueue;
  }

  /**
   * Get current lock from storage
   */
  async getLock() {
    return new Promise((resolve) => {
      chrome.storage.session.get(['activeLock'], (result) => {
        resolve(result.activeLock || null);
      });
    });
  }

  /**
   * Set lock in storage
   */
  async setLock(lock) {
    return new Promise((resolve, reject) => {
      if (lock) {
        chrome.storage.session.set({ activeLock: lock }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } else {
        chrome.storage.session.remove(['activeLock'], () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      }
    });
  }

  /**
   * Check if lock is stale (no heartbeat for >90s)
   */
  isLockStale(lock) {
    if (!lock || !lock.since) return true;
    const age = Date.now() - lock.since;
    return age > this.STALE_THRESHOLD;
  }

  /**
   * Acquire lock for a tab
   * @param {number} tabId - Tab ID requesting the lock
   * @param {string} platform - "chatgpt" or "claude"
   * @param {string} url - URL of the tab
   * @returns {Promise<{granted: boolean, ownerTabId?: number, ownerUrl?: string, since?: number}>}
   */
  async acquireLock(tabId, platform, url) {
    return this.queueOperation(async () => {
      const currentLock = await this.getLock();

      // No lock exists - grant it
      if (!currentLock) {
        const newLock = {
          tabId,
          platform,
          url,
          since: Date.now(),
        };
        await this.setLock(newLock);
        console.log('LockManager: Lock acquired by tab', tabId);
        return { granted: true, ownerTabId: tabId };
      }

      // Lock exists and this tab already owns it
      if (currentLock.tabId === tabId) {
        // Update timestamp
        currentLock.since = Date.now();
        await this.setLock(currentLock);
        return { granted: true, ownerTabId: tabId };
      }

      // Lock exists but is stale - allow takeover
      if (this.isLockStale(currentLock)) {
        console.log('LockManager: Lock is stale, allowing takeover by tab', tabId);
        const newLock = {
          tabId,
          platform,
          url,
          since: Date.now(),
        };
        await this.setLock(newLock);
        return { granted: true, ownerTabId: tabId, tookOver: true };
      }

      // Lock exists and is active - deny
      console.log('LockManager: Lock denied for tab', tabId, '- owned by tab', currentLock.tabId);
      return {
        granted: false,
        ownerTabId: currentLock.tabId,
        ownerUrl: currentLock.url,
        since: currentLock.since,
      };
    });
  }

  /**
   * Release lock for a tab
   * @param {number} tabId - Tab ID releasing the lock
   * @returns {Promise<boolean>} - True if lock was released
   */
  async releaseLock(tabId) {
    return this.queueOperation(async () => {
      const currentLock = await this.getLock();
      if (currentLock && currentLock.tabId === tabId) {
        await this.setLock(null);
        console.log('LockManager: Lock released by tab', tabId);
        return true;
      }
      return false;
    });
  }

  /**
   * Takeover lock from another tab
   * @param {number} newTabId - Tab ID taking over
   * @param {string} platform - "chatgpt" or "claude"
   * @param {string} url - URL of the new tab
   * @returns {Promise<{granted: boolean, tookOver: boolean}>}
   */
  async takeoverLock(newTabId, platform, url) {
    return this.queueOperation(async () => {
      const currentLock = await this.getLock();

      // No lock exists - just grant it
      if (!currentLock) {
        const newLock = {
          tabId: newTabId,
          platform,
          url,
          since: Date.now(),
        };
        await this.setLock(newLock);
        return { granted: true, tookOver: false };
      }

      // This tab already owns the lock
      if (currentLock.tabId === newTabId) {
        currentLock.since = Date.now();
        await this.setLock(currentLock);
        return { granted: true, tookOver: false };
      }

      // Takeover from another tab
      const oldTabId = currentLock.tabId;
      const newLock = {
        tabId: newTabId,
        platform,
        url,
        since: Date.now(),
      };
      await this.setLock(newLock);

      // Notify old owner
      try {
        await chrome.tabs.sendMessage(oldTabId, { type: 'LOCK_REVOKED' });
        console.log('LockManager: Sent LOCK_REVOKED to tab', oldTabId);
      } catch (error) {
        // Tab might be closed or unreachable - that's okay
        console.log('LockManager: Could not notify old owner tab', oldTabId, error.message);
      }

      console.log('LockManager: Lock taken over by tab', newTabId, 'from tab', oldTabId);
      return { granted: true, tookOver: true };
    });
  }

  /**
   * Update heartbeat timestamp for active lock
   * @param {number} tabId - Tab ID sending heartbeat
   * @returns {Promise<boolean>} - True if heartbeat was accepted
   */
  async updateHeartbeat(tabId) {
    return this.queueOperation(async () => {
      const currentLock = await this.getLock();
      if (currentLock && currentLock.tabId === tabId) {
        currentLock.since = Date.now();
        await this.setLock(currentLock);
        return true;
      }
      return false;
    });
  }
}

// Initialize LockManager
const lockManager = new LockManager();

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
  // Handle lock-related messages
  if (request.type === 'LOCK_REQUEST') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ granted: false, error: 'No tab ID' });
      return true;
    }

    lockManager
      .acquireLock(tabId, request.platform, request.url)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        console.error('LockManager: LOCK_REQUEST error', error);
        sendResponse({ granted: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  if (request.type === 'LOCK_TAKEOVER') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ granted: false, error: 'No tab ID' });
      return true;
    }

    lockManager
      .takeoverLock(tabId, request.platform, request.url)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        console.error('LockManager: LOCK_TAKEOVER error', error);
        sendResponse({ granted: false, error: error.message });
      });
    return true;
  }

  if (request.type === 'LOCK_HEARTBEAT') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ accepted: false });
      return true;
    }

    lockManager
      .updateHeartbeat(tabId)
      .then((accepted) => {
        sendResponse({ accepted });
      })
      .catch((error) => {
        console.error('LockManager: LOCK_HEARTBEAT error', error);
        sendResponse({ accepted: false });
      });
    return true;
  }

  if (request.type === 'LOCK_RELEASE') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ released: false });
      return true;
    }

    lockManager
      .releaseLock(tabId)
      .then((released) => {
        sendResponse({ released });
      })
      .catch((error) => {
        console.error('LockManager: LOCK_RELEASE error', error);
        sendResponse({ released: false });
      });
    return true;
  }

  // Handle existing settings messages
  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['enabled', 'sensitivity'], (result) => {
      sendResponse(result);
    });
    return true; // Keep channel open for async response
  }
});

// Auto-release lock when owner tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  lockManager
    .getLock()
    .then((lock) => {
      if (lock && lock.tabId === tabId) {
        console.log('LockManager: Owner tab closed, releasing lock');
        return lockManager.setLock(null);
      }
    })
    .catch((error) => {
      console.error('LockManager: Error handling tab removal', error);
    });
});

// Auto-release lock when owner navigates away from supported sites
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) {
    return;
  }

  lockManager
    .getLock()
    .then((lock) => {
      if (lock && lock.tabId === tabId) {
        // Check if URL is still a supported site
        const isSupported =
          tab.url.includes('chat.openai.com') ||
          tab.url.includes('chatgpt.com') ||
          tab.url.includes('claude.ai');

        if (!isSupported) {
          console.log('LockManager: Owner tab navigated away, releasing lock');
          return lockManager.setLock(null);
        }
      }
    })
    .catch((error) => {
      console.error('LockManager: Error handling tab update', error);
    });
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // This is handled by the popup, but we can add logic here if needed
});
