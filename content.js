// UvoCorp Order Bot - Content Script

// Configuration - will be updated from storage/popup
let BOT_CONFIG = {
  // Only take orders for these languages (case insensitive)
  acceptedLanguages: [
    'java', 'python', 'r', 'r studio', 'spss', 'php', 'tableau', 'tabeleau', 'power bi',
    'adobe', 'html', 'dart', 'flutter', 'react', 'web', 'sql', 'database',
    'golang', 'laravel', 'c#', 'networking', 'cisco', 'packet tracer', 'assembly',
    'check instructions', 'excel', 'computer science', 'verilog'
  ],
  // Don't take orders with deadlines shorter than this (in hours) - NOT USED for filtering anymore
  minimumDeadlineHours: 5,
  // Refresh intervals
  softRefreshInterval: 1000, // 1 second (for background checks)
  hardRefreshInterval: 6000, // 6 seconds (for full page refresh)
  // Log and storage configuration
  maxOrdersToShow: 200,
  // Notification settings
  soundEnabled: true,
  desktopNotifications: true,
  // Auto refresh setting
  autoRefresh: true,
  // Processing method
  useDirectProcessing: true, // Set to true to use direct processing without opening tabs
  // Open in new tab/window for potentially faster loading
  openInNewTab: true
};

// Global state
let state = {
  active: false,
  newOrdersFound: 0,
  rejectedOrders: [],
  takenOrders: [],
  availableOrders: [],
  allVisitedOrders: [],
  lastOrderIds: new Set(),
  processingOrder: false,
  lastScanTime: 0,
  wakeLock: null,
  currentTabId: null,
  scanningInProgress: false,
  isOriginalTab: false,
  lastHardRefreshTime: 0,
  backgroundScanInterval: null,
  hardRefreshInterval: null
};

// Initialize the extension
(function() {
  console.log("UvoCorp Order Bot: Initializing");
  
  // Get current tab ID
  chrome.runtime.sendMessage({ action: "getCurrentTabId" }, function(response) {
    if (response && response.tabId) {
      state.currentTabId = response.tabId;
      state.isOriginalTab = true;
    }
  });
  
  // Check if we're on the available orders page or an order detail page
  const path = window.location.pathname;
  
  if (path === "/orders/available.html") {
    // Available orders page
    initializeAvailableOrdersPage();
  } else if (path.includes("/order/") && path.includes(".html")) {
    // Order detail page
    initializeOrderDetailPage();
  }

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("Message received:", request);
    
    if (request.action === "getState") {
      sendResponse({
        state: {
          active: state.active,
          newOrdersFound: state.newOrdersFound,
          rejectedOrders: state.rejectedOrders,
          takenOrders: state.takenOrders,
          availableOrders: state.availableOrders,
          allVisitedOrders: state.allVisitedOrders
        }
      });
    } else if (request.action === "toggleActive") {
      state.active = request.active;
      sendResponse({
        success: true,
        active: state.active
      });
      
      if (state.active && window.location.pathname === "/orders/available.html") {
        startMonitoring();
      } else {
        stopMonitoring();
      }
      
      // Save active state
      chrome.storage.local.set({ uvoBotEnabled: state.active });
    } else if (request.action === "updateConfig") {
      // Update config
      if (request.config) {
        updateConfig(request.config);
        
        // Restart monitoring if active
        if (state.active && window.location.pathname === "/orders/available.html") {
          stopMonitoring();
          startMonitoring();
        }
      }
      
      sendResponse({ success: true });
    } else if (request.action === "clearStats") {
      clearStats();
      sendResponse({ success: true });
    } else if (request.action === "refreshPage") {
      // Force refresh the page
      window.location.reload();
      sendResponse({ success: true });
    } else if (request.action === "playSound") {
      // Play sound sent from background
      if (request.soundUrl && request.soundName) {
        try {
          const audio = new Audio(request.soundUrl);
          audio.volume = 1.0;
          audio.play().catch(e => console.error("Error playing sound via message:", e));
        } catch (e) {
          console.error("Error creating audio via message:", e);
        }
      }
      sendResponse({ success: true });
    }
    
    return true; // Keep the message channel open for async response
  });
  
  // Apply theme based on user's system preference
  applyTheme();
  
  // Listen for theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
})();

// Apply theme based on user's system preference
function applyTheme() {
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Apply theme to the status panel
  const panel = document.getElementById('uvo-bot-indicator');
  if (panel) {
    if (isDarkMode) {
      panel.classList.add('dark-theme');
    } else {
      panel.classList.remove('dark-theme');
    }
  }
  
  // Create or update theme styles
  let themeStyles = document.getElementById('uvo-bot-theme-styles');
  if (!themeStyles) {
    themeStyles = document.createElement('style');
    themeStyles.id = 'uvo-bot-theme-styles';
    document.head.appendChild(themeStyles);
  }
  
  if (isDarkMode) {
    themeStyles.textContent = `
      .uvo-bot-indicator {
        background-color: rgba(45, 55, 72, 0.95) !important;
        color: #f7fafc !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
      }
      .uvo-bot-indicator.inactive {
        background-color: rgba(176, 42, 55, 0.95) !important;
      }
      .uvo-bot-stats {
        background-color: rgba(255, 255, 255, 0.15) !important;
      }
    `;
  } else {
    themeStyles.textContent = `
      .uvo-bot-indicator {
        background-color: rgba(67, 97, 238, 0.95);
        color: white;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
      }
      .uvo-bot-indicator.inactive {
        background-color: rgba(230, 57, 70, 0.95);
      }
      .uvo-bot-stats {
        background-color: rgba(255, 255, 255, 0.2);
      }
    `;
  }
}

// Update configuration
function updateConfig(config) {
  if (config.acceptedLanguages) BOT_CONFIG.acceptedLanguages = config.acceptedLanguages;
  if (config.minimumDeadlineHours !== undefined) BOT_CONFIG.minimumDeadlineHours = config.minimumDeadlineHours;
  if (config.softRefreshInterval) BOT_CONFIG.softRefreshInterval = config.softRefreshInterval;
  if (config.hardRefreshInterval) BOT_CONFIG.hardRefreshInterval = config.hardRefreshInterval;
  if (config.soundEnabled !== undefined) BOT_CONFIG.soundEnabled = config.soundEnabled;
  if (config.desktopNotifications !== undefined) BOT_CONFIG.desktopNotifications = config.desktopNotifications;
  if (config.autoRefresh !== undefined) BOT_CONFIG.autoRefresh = config.autoRefresh;
  if (config.useDirectProcessing !== undefined) BOT_CONFIG.useDirectProcessing = config.useDirectProcessing;
  if (config.openInNewTab !== undefined) BOT_CONFIG.openInNewTab = config.openInNewTab;
}

// Initialize the available orders page
function initializeAvailableOrdersPage() {
  console.log("UvoCorp Order Bot: On available orders page");
  
  // Inject the status panel
  injectStatusPanel();
  
  // Check if we should be active (from previous state)
  chrome.storage.local.get([
    'uvoBotEnabled', 
    'uvoUseDirectProcessing',
    'uvoOpenInNewTab',
    'uvoAcceptedLanguages'
  ], function(result) {
    state.active = result.uvoBotEnabled === true;
    
    // Update direct processing setting if it exists
    if (result.uvoUseDirectProcessing !== undefined) {
      BOT_CONFIG.useDirectProcessing = result.uvoUseDirectProcessing;
    }
    
    // Update open in new tab setting if it exists
    if (result.uvoOpenInNewTab !== undefined) {
      BOT_CONFIG.openInNewTab = result.uvoOpenInNewTab;
    }
    
    // Update accepted languages if they exist
    if (result.uvoAcceptedLanguages !== undefined) {
      BOT_CONFIG.acceptedLanguages = result.uvoAcceptedLanguages;
    }
    
    if (state.active) {
      startMonitoring();
    }
    
    updateStatusPanel();
  });
  
  // Load previous state data
  loadStateFromStorage();
  
  // Start simulating user activity (prevent screen sleep)
  preventScreenSleep();
  
  // Initialize mutation observer
  setupMutationObserver();
}

// Prevent screen from sleeping
function preventScreenSleep() {
  // Set up multiple methods to keep screen awake
  requestWakeLock();
  setupNoSleepBackup();
}

// Keep screen active using Wake Lock API
async function requestWakeLock() {
  try {
    // Only attempt to use Wake Lock API when document is visible
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      // First release any existing wake lock
      if (state.wakeLock) {
        try {
          await state.wakeLock.release();
          state.wakeLock = null;
        } catch (err) {
          console.log("Error releasing existing wake lock:", err);
        }
      }
      
      // Request a screen wake lock
      state.wakeLock = await navigator.wakeLock.request('screen');
      console.log('Wake Lock activated successfully');
      
      // Listen for visibility change to reacquire lock when page becomes visible again
      document.removeEventListener('visibilitychange', handleVisibilityChange); // Remove any existing listener
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Listen for wake lock release
      state.wakeLock.addEventListener('release', () => {
        console.log('Wake Lock released - attempting to reacquire');
        // Try to reacquire the wake lock if we're still active
        if (state.active && document.visibilityState === 'visible') {
          setTimeout(() => requestWakeLock(), 1000);
        } else {
          console.log('Not reacquiring wake lock - page not visible or bot inactive');
        }
      });
    } else {
      // Wake Lock API not available or page not visible
      if (!('wakeLock' in navigator)) {
        console.log('Wake Lock API not supported, using fallback methods');
      } else {
        console.log('Page not visible, using fallback methods');
      }
      simulateUserActivity();
    }
  } catch (err) {
    console.error(`Wake Lock request failed: ${err.message}`);
    // Use fallback methods
    simulateUserActivity();
  }
}

// Handle visibility change events for wake lock
function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && state.active) {
    console.log('Page became visible, attempting to acquire wake lock');
    // Page is visible again, try to reacquire wake lock
    if (!state.wakeLock) {
      requestWakeLock();
    }
  } else if (document.visibilityState === 'hidden' && state.wakeLock) {
    console.log('Page hidden, wake lock will be released automatically');
    // No need to explicitly release the wake lock, the browser will do it
    // Just set our reference to null to avoid confusion
    state.wakeLock = null;
  }
}

// Set up backup methods to prevent sleep
function setupNoSleepBackup() {
  try {
    // Create a video element that plays silently in the background
    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.setAttribute('loop', '');
    video.muted = true; // Ensure muted
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.position = 'fixed';
    video.style.opacity = '0.01';
    video.style.pointerEvents = 'none';
    video.style.zIndex = '-1';
    
    // Set up a small video source with minimal traffic
    const source = document.createElement('source');
    source.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAFttZGF0AAAAMmWIhD///8PAnFAAFPf3333331111111111111111111111111111111111111111114AAAABUGaOeDKAAAABkGaVHgygAAAMgZpjB8ygAAAcMgzMDEAAAEBAAABQMCYvkAAANQMy8REY';
    source.type = 'video/mp4';
    
    video.appendChild(source);
    document.body.appendChild(video);
    
    // Create a user interaction hook to start the video when user interacts
    const startVideoOnInteraction = function() {
      video.play().then(() => {
        console.log('Video playing successfully after user interaction');
      }).catch(err => {
        console.log("Silent video play failed after interaction:", err);
      });
      
      // Remove the event listeners once successfully played
      document.removeEventListener('mousedown', startVideoOnInteraction);
      document.removeEventListener('keydown', startVideoOnInteraction);
      document.removeEventListener('touchstart', startVideoOnInteraction);
    };
    
    // Add event listeners for user interaction
    document.addEventListener('mousedown', startVideoOnInteraction, { once: true });
    document.addEventListener('keydown', startVideoOnInteraction, { once: true });
    document.addEventListener('touchstart', startVideoOnInteraction, { once: true });
    
    // Try to play the video silently
    video.play().then(() => {
      console.log('Silent video playing successfully');
    }).catch(err => {
      console.log("Silent video play failed, waiting for user interaction:", err);
      // The event listeners added above will handle playing after interaction
    });
    
    // Regular checks to ensure video is playing
    if (state.active) {
      const videoCheckInterval = setInterval(() => {
        if (state.active) {
          if (video.paused) {
            console.log('Video was paused, attempting to restart');
            video.play().catch(() => {
              console.log('Failed to restart video automatically');
            });
          }
        } else {
          // Bot is inactive, clear the interval
          clearInterval(videoCheckInterval);
        }
      }, 30000); // Every 30 seconds
      
      // Clean up when stopping
      window.addEventListener('beforeunload', () => {
        clearInterval(videoCheckInterval);
      });
    }
  } catch (e) {
    console.log("Silent video method failed:", e);
  }
}

// Simulate user activity to prevent screen sleep (fallback method)
function simulateUserActivity() {
  // Create an invisible element to perform minimal mouse movement
  const activityElement = document.createElement('div');
  activityElement.style.position = 'fixed';
  activityElement.style.top = '0';
  activityElement.style.left = '0';
  activityElement.style.width = '1px';
  activityElement.style.height = '1px';
  activityElement.style.pointerEvents = 'none';
  document.body.appendChild(activityElement);
  
  // Perform minimal movements periodically
  const activityInterval = setInterval(() => {
    if (state.active) {
      // Simulate minimal mouse movement
      activityElement.style.top = Math.random() > 0.5 ? '0' : '1px';
      
      // Request animation frame to keep browser active
      window.requestAnimationFrame(() => {
        // Minimal DOM operation to keep browser active
        activityElement.dataset.timestamp = Date.now();
      });
      
      // Create and play a silent audio element to prevent mobile devices from sleeping
      try {
        const silentAudio = new Audio();
        silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        silentAudio.volume = 0.01;
        silentAudio.play().catch(() => {
          // Ignore errors, as this is just a fallback
        });
      } catch (e) {
        // Ignore errors in audio playback
      }
    } else {
      // Bot is inactive, clear the interval
      clearInterval(activityInterval);
    }
  }, 10000); // Every 10 seconds
  
  // Clean up when stopping
  window.addEventListener('beforeunload', () => {
    clearInterval(activityInterval);
  });
}

// Initialize the order detail page
function initializeOrderDetailPage() {
  console.log("UvoCorp Order Bot: On order detail page");
  
  // Initialize state
  loadStateFromStorage();
  
  // Extract order information
  const orderInfo = extractOrderInfo();
  
  // Process the order if it meets our criteria
  if (orderInfo) {
    processOrderDetail(orderInfo);
    
    // Save detailed order information
    saveOrderDetail(orderInfo);
  }
}

// Load state from Chrome's local storage
function loadStateFromStorage() {
  chrome.storage.local.get([
    'uvoBotEnabled',
    'uvoAcceptedLanguages',
    'uvoMinimumDeadlineHours',
    'uvoRefreshInterval',
    'uvoSoundEnabled',
    'uvoDesktopNotifications',
    'uvoAutoRefresh',
    'uvoUseDirectProcessing',
    'uvoOpenInNewTab',
    'uvoRejectedOrders',
    'uvoTakenOrders',
    'uvoAvailableOrders',
    'uvoAllVisitedOrders'
  ], function(result) {
    // Update config
    state.active = result.uvoBotEnabled !== undefined ? result.uvoBotEnabled : false;
    
    // Update config
    if (result.uvoAcceptedLanguages) BOT_CONFIG.acceptedLanguages = result.uvoAcceptedLanguages;
    if (result.uvoMinimumDeadlineHours) BOT_CONFIG.minimumDeadlineHours = result.uvoMinimumDeadlineHours;
    if (result.uvoRefreshInterval) BOT_CONFIG.hardRefreshInterval = result.uvoRefreshInterval * 1000;
    if (result.uvoSoundEnabled !== undefined) BOT_CONFIG.soundEnabled = result.uvoSoundEnabled;
    if (result.uvoDesktopNotifications !== undefined) BOT_CONFIG.desktopNotifications = result.uvoDesktopNotifications;
    if (result.uvoAutoRefresh !== undefined) BOT_CONFIG.autoRefresh = result.uvoAutoRefresh;
    if (result.uvoUseDirectProcessing !== undefined) BOT_CONFIG.useDirectProcessing = result.uvoUseDirectProcessing;
    if (result.uvoOpenInNewTab !== undefined) BOT_CONFIG.openInNewTab = result.uvoOpenInNewTab;
    
    // Load state data with proper validation
    state.rejectedOrders = Array.isArray(result.uvoRejectedOrders) ? result.uvoRejectedOrders : [];
    state.takenOrders = Array.isArray(result.uvoTakenOrders) ? result.uvoTakenOrders : [];
    state.availableOrders = Array.isArray(result.uvoAvailableOrders) ? result.uvoAvailableOrders : [];
    state.allVisitedOrders = Array.isArray(result.uvoAllVisitedOrders) ? result.uvoAllVisitedOrders : [];
    
    // Update last seen order IDs
    state.lastOrderIds = new Set(state.allVisitedOrders.map(order => order.id));
    
    updateStatusPanel();
  });
}

// Save state to Chrome's local storage
function saveStateToStorage() {
  // Ensure no duplicate orders in different categories
  // Taken orders have priority
  const takenIds = new Set(state.takenOrders.map(order => order.id));
  state.rejectedOrders = state.rejectedOrders.filter(order => !takenIds.has(order.id));
  
  // Rejected orders have priority over available
  const rejectedIds = new Set(state.rejectedOrders.map(order => order.id));
  state.availableOrders = state.availableOrders.filter(order => 
    !takenIds.has(order.id) && !rejectedIds.has(order.id)
  );
  
  // Limit the number of orders we store
  const limitArray = arr => arr.slice(0, BOT_CONFIG.maxOrdersToShow);
  
  // Save to storage
  chrome.storage.local.set({
    uvoBotEnabled: state.active,
    uvoRejectedOrders: limitArray(state.rejectedOrders),
    uvoTakenOrders: limitArray(state.takenOrders),
    uvoAvailableOrders: limitArray(state.availableOrders),
    uvoAllVisitedOrders: limitArray(state.allVisitedOrders)
  });
  
  // Update badge count with available orders
  chrome.runtime.sendMessage({
    action: 'updateBadge',
    count: state.availableOrders.length
  });
}

// Clear all statistics
function clearStats() {
  state.rejectedOrders = [];
  state.takenOrders = [];
  state.availableOrders = [];
  state.allVisitedOrders = [];
  state.lastOrderIds = new Set();
  state.newOrdersFound = 0;
  
  saveStateToStorage();
  updateStatusPanel();
}

// Monitor the available orders page
function startMonitoring() {
  console.log("UvoCorp Order Bot: Starting monitoring");
  state.active = true;
  chrome.storage.local.set({uvoBotEnabled: true});
  
  // Request wake lock to keep screen active
  requestWakeLock();
  
  // Initial scan
  if (BOT_CONFIG.useDirectProcessing) {
    processOrdersDirectly();
  } else {
    scanAvailableOrders();
  }
  
  // Setup background scan interval
  if (!state.backgroundScanInterval) {
    state.backgroundScanInterval = setInterval(() => {
      backgroundOrderScan();
    }, BOT_CONFIG.softRefreshInterval);
  }
  
  // Setup hard refresh interval
  if (BOT_CONFIG.autoRefresh && !state.hardRefreshInterval) {
    state.hardRefreshInterval = setInterval(() => {
      hardRefreshPage();
    }, BOT_CONFIG.hardRefreshInterval);
  }
  
  updateStatusPanel();
}

function stopMonitoring() {
  console.log("UvoCorp Order Bot: Stopping monitoring");
  state.active = false;
  chrome.storage.local.set({uvoBotEnabled: false});
  
  // Release wake lock if we have one
  if (state.wakeLock) {
    state.wakeLock.release().catch((err) => {
      console.error(`Error releasing wake lock: ${err.message}`);
    });
    state.wakeLock = null;
  }
  
  // Clear intervals
  if (state.backgroundScanInterval) {
    clearInterval(state.backgroundScanInterval);
    state.backgroundScanInterval = null;
  }
  
  if (state.hardRefreshInterval) {
    clearInterval(state.hardRefreshInterval);
    state.hardRefreshInterval = null;
  }
  
  updateStatusPanel();
}

// Background scan for orders (without refreshing page)
function backgroundOrderScan() {
  if (!state.active || state.processingOrder || state.scanningInProgress) return;
  
  try {
    state.scanningInProgress = true;
    
    // Scan for new orders by looking at the table rows
    const orderRows = document.querySelectorAll('.order-link');
    
    if (!orderRows || orderRows.length === 0) {
      state.scanningInProgress = false;
      return;
    }
    
    // Track current order IDs to detect disappeared orders
    const currentOrderIds = new Set();
    
    // Process each order row
    for (const orderRow of orderRows) {
      // Extract order info from row
      const orderInfo = extractOrderInfoFromRow(orderRow);
      
      if (!orderInfo || !orderInfo.id) {
        continue;
      }
      
      // Add to current order IDs
      currentOrderIds.add(orderInfo.id);
      
      // Check if this is a new order we haven't seen yet
      if (!state.lastOrderIds.has(orderInfo.id)) {
        console.log("UvoCorp Order Bot: New order found in background scan", orderInfo);
        
        // Add to our tracking
        state.lastOrderIds.add(orderInfo.id);
        state.allVisitedOrders.unshift(orderInfo);
        
        // Check if the row is marked as new
        if (orderRow.querySelector('.row.new') || orderRow.querySelector('.row-take-order')) {
          // This is a new order - process it immediately
          // Increase new orders count
          state.newOrdersFound++;
          
          // Add to available orders
          state.availableOrders.unshift(orderInfo);
          
          // Play notification sound for new order
          playSound('new-order');
          
          // Open order detail in a separate tab
          openOrderDetail(orderInfo.link);
          
          // Save state
          saveStateToStorage();
          updateStatusPanel();
          
          // Only process one order at a time
          state.scanningInProgress = false;
          break;
        }
      }
    }
    
    // Update available orders that may have disappeared
    state.availableOrders = state.availableOrders.filter(order => 
      currentOrderIds.has(order.id) && !state.takenOrders.some(taken => taken.id === order.id)
    );
    
    // Update extension badge with count of available orders
    chrome.runtime.sendMessage({
      action: 'updateBadge',
      count: state.availableOrders.length
    });
    
    saveStateToStorage();
    updateStatusPanel();
    state.scanningInProgress = false;
  } catch (error) {
    console.error("UvoCorp Order Bot: Error in background scan", error);
    state.scanningInProgress = false;
  }
}

// Hard refresh the page
function hardRefreshPage() {
  if (state.active && !state.processingOrder && BOT_CONFIG.autoRefresh) {
    // Make sure we haven't refreshed too recently
    const now = Date.now();
    if (now - state.lastHardRefreshTime >= BOT_CONFIG.hardRefreshInterval) {
      console.log("UvoCorp Order Bot: Performing hard refresh");
      state.lastHardRefreshTime = now;
      window.location.reload();
    }
  }
}

// Save detailed order information
function saveOrderDetail(orderInfo) {
  if (!orderInfo || !orderInfo.id) return;
  
  // Get additional order details if available
  const fullOrderDetails = {
    ...orderInfo,
    instructionsText: extractOrderInstructions(),
    attachedFiles: extractAttachedFiles(),
    orderId: orderInfo.id,
    processedAt: new Date().toISOString()
  };
  
  // Send to background script for storage
  chrome.runtime.sendMessage({
    action: "saveOrderDetail",
    orderId: orderInfo.id,
    details: fullOrderDetails
  });
}

// Extract order instructions
function extractOrderInstructions() {
  const instructionsElement = document.getElementById('paperinstraction__text');
  return instructionsElement ? instructionsElement.textContent.trim() : '';
}

// Extract attached files information
function extractAttachedFiles() {
  const files = [];
  const fileElements = document.querySelectorAll('.order--files li');
  
  fileElements.forEach(fileElement => {
    const fileLink = fileElement.querySelector('.order--files__link');
    const fileDescription = fileElement.querySelector('.order--files__info-description');
    const fileDate = fileElement.querySelector('.order--files__info-date');
    
    if (fileLink) {
      files.push({
        name: fileLink.textContent.trim(),
        description: fileDescription ? fileDescription.textContent.trim() : '',
        date: fileDate ? fileDate.textContent.trim() : '',
        link: fileLink.parentElement ? fileLink.parentElement.getAttribute('href') : null
      });
    }
  });
  
  return files;
}

// Function to check if a page contains any accepted language
function pageContainsAcceptedLanguage() {
  try {
    // Get the entire page content
    const pageContent = document.body.textContent.toLowerCase();
    
    // Check if any accepted language is found in the entire page
    for (const language of BOT_CONFIG.acceptedLanguages) {
      if (pageContent.includes(language.toLowerCase())) {
        console.log(`Found accepted language in page content: ${language}`);
        return true;
      }
    }
  } catch (error) {
    console.error("Error checking if page contains accepted language:", error);
  }
  
  return false;
}

// Check if the programming language matches any of our accepted languages
function isAcceptedLanguage(language) {
  if (!language) return false;
  
  // Convert to lowercase for case-insensitive comparison
  const lowerCaseLanguage = language.toLowerCase();
  
  // Check if any of our accepted languages is a substring of the provided language
  return BOT_CONFIG.acceptedLanguages.some(acceptedLang => 
    lowerCaseLanguage.includes(acceptedLang.toLowerCase())
  );
}

// Function to process orders directly without opening new tabs
function processOrdersDirectly() {
  if (!state.active || state.processingOrder || state.scanningInProgress) return;
  
  try {
    state.scanningInProgress = true;
    
    // Rate limit scanning to avoid excessive CPU usage
    const now = Date.now();
    if (now - state.lastScanTime < 500) {
      state.scanningInProgress = false;
      return;
    }
    state.lastScanTime = now;
    
    console.log("UvoCorp Order Bot: Processing orders directly");
    
    // Get all order rows
    const orderRows = document.querySelectorAll('.order-link');
    
    if (!orderRows || orderRows.length === 0) {
      console.log("UvoCorp Order Bot: No order rows found");
      state.scanningInProgress = false;
      return;
    }
    
    // Track current order IDs to detect disappeared orders
    const currentOrderIds = new Set();
    
    // Process each order row
    for (const orderRow of orderRows) {
      // Extract order info from row
      const orderInfo = extractOrderInfoFromRow(orderRow);
      
      if (!orderInfo || !orderInfo.id) {
        continue;
      }
      
      // Add to current order IDs
      currentOrderIds.add(orderInfo.id);
      
      // Check if this is a new order we haven't seen yet
      if (!state.lastOrderIds.has(orderInfo.id)) {
        console.log("UvoCorp Order Bot: New order found for direct processing", orderInfo);
        
        // Add to our tracking
        state.lastOrderIds.add(orderInfo.id);
        state.allVisitedOrders.unshift(orderInfo);
        
        // Check if language matches our accepted languages
        const languageMatch = isAcceptedLanguage(orderInfo.language);
        
        // Check if this is a "Take Order" (not a "Place Bid")
        const isTakeOrderRow = orderRow.querySelector('.row-take-order') !== null;
        
        if (!languageMatch) {
          // Language doesn't match our list - reject
          const rejectedOrder = {
            ...orderInfo,
            status: 'rejected',
            reason: `Language not in accepted list: ${orderInfo.language}`,
            processedAt: new Date().toISOString()
          };
          
          state.rejectedOrders.unshift(rejectedOrder);
          
          // Play rejected sound
          playSound('rejected-order');
          
          // Notify popup about rejected order
          chrome.runtime.sendMessage({
            action: 'orderRejected',
            order: rejectedOrder
          });
          
          // Save state and continue to next order
          saveStateToStorage();
          updateStatusPanel();
          continue;
        }
        
        if (!isTakeOrderRow) {
          // This is a "Place Bid" order, not a "Take Order" - reject
          const rejectedOrder = {
            ...orderInfo,
            status: 'rejected',
            reason: `This is a bid order, not a take order`,
            processedAt: new Date().toISOString()
          };
          
          state.rejectedOrders.unshift(rejectedOrder);
          
          // Play rejected sound
          playSound('rejected-order');
          
          // Notify popup about rejected order
          chrome.runtime.sendMessage({
            action: 'orderRejected',
            order: rejectedOrder
          });
          
          // Save state and continue to next order
          saveStateToStorage();
          updateStatusPanel();
          continue;
        }
        
        // This is a valid order that matches our criteria - process it
        // Increase new orders count
        state.newOrdersFound++;
        
        // Add to available orders
        state.availableOrders.unshift(orderInfo);
        
        // Play notification sound
        playSound('new-order');
        
        // Open in a separate tab
        openOrderDetail(orderInfo.link);
        
        // Save state
        saveStateToStorage();
        updateStatusPanel();
        
        // Only process one order at a time
        state.scanningInProgress = false;
        break;
      }
    }
    
    // Update available orders that may have disappeared
    state.availableOrders = state.availableOrders.filter(order => 
      currentOrderIds.has(order.id) && !state.takenOrders.some(taken => taken.id === order.id)
    );
    
    // Update extension badge with count of available orders
    chrome.runtime.sendMessage({
      action: 'updateBadge',
      count: state.availableOrders.length
    });
    
    saveStateToStorage();
    updateStatusPanel();
    state.scanningInProgress = false;
  } catch (error) {
    console.error("UvoCorp Order Bot: Error processing orders directly", error);
    state.processingOrder = false;
    state.scanningInProgress = false;
    
    // Notify popup about error
    chrome.runtime.sendMessage({
      action: 'error',
      message: `Error processing orders: ${error.message}`
    });
  }
}

// Play a sound notification
function playSound(soundName) {
  if (!BOT_CONFIG.soundEnabled) return;
  
  console.log(`UvoCorp Order Bot: Playing sound ${soundName}`);
  
  // First try to play sound locally
  try {
    const audio = new Audio(chrome.runtime.getURL(`sounds/${soundName}.mp3`));
    audio.volume = 1.0;
    
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.then(() => {
        console.log(`Sound ${soundName} played successfully`);
      }).catch(error => {
        console.log(`Local audio playback failed: ${error}, trying background script`);
        // Fallback to background script
        sendSoundMessageToBackground(soundName);
      });
    }
  } catch (e) {
    console.log(`Error creating audio: ${e}, trying background script`);
    sendSoundMessageToBackground(soundName);
  }
}

// Send message to background script to play sound
function sendSoundMessageToBackground(soundName) {
  // Send message to background script to play sound
  chrome.runtime.sendMessage({
    action: "playSound",
    sound: soundName
  });
}

// Extract order information from a row in the orders list
function extractOrderInfoFromRow(orderRow) {
  try {
    // First check if it's a take order or bid order
    const isTakeOrder = orderRow.querySelector('.row-take-order') !== null;
    
    // Extract order ID
    const idElement = orderRow.querySelector('.id-number-order');
    if (!idElement) return null;
    
    const id = idElement.textContent.trim().replace('#', '');
    
    // Extract programming language
    const languageLabel = orderRow.querySelector('.title-order-label');
    const languageDescription = orderRow.querySelector('.title-order-description');
    
    let language = '';
    
    if (languageLabel) {
      language = languageLabel.textContent.trim();
    }
    
    if (languageDescription) {
      language += (language ? ' - ' : '') + languageDescription.textContent.trim();
    }
    
    // Extract deadline 
    const deadlineElement = orderRow.querySelector('.time-order span');
    const deadlineText = deadlineElement ? deadlineElement.textContent.trim() : '';
    
    // Parse deadline hours with improved parsing
    let deadlineHours = 0;
    if (deadlineText) {
      if (deadlineText.includes('d')) {
        // Extract days and convert to hours
        const dayMatch = deadlineText.match(/(\d+)d/);
        const days = dayMatch ? parseInt(dayMatch[1], 10) : 0;
        deadlineHours += days * 24;
        
        // Also check for hours
        const hourMatch = deadlineText.match(/(\d+)h/);
        if (hourMatch) {
          deadlineHours += parseInt(hourMatch[1], 10);
        }
      } else if (deadlineText.includes('h')) {
        // Only hours
        const hourMatch = deadlineText.match(/(\d+)h/);
        if (hourMatch) {
          deadlineHours = parseInt(hourMatch[1], 10);
        }
      } else if (deadlineText.includes('m')) {
        // Minutes (convert to fraction of an hour)
        const minuteMatch = deadlineText.match(/(\d+)m/);
        if (minuteMatch) {
          deadlineHours = parseInt(minuteMatch[1], 10) / 60;
        }
      }
    }
    
    // Ensure we have a valid deadline hours
    if (isNaN(deadlineHours) || deadlineHours < 0) {
      deadlineHours = 0;
    }
    
    // Extract price
    const priceElement = orderRow.querySelector('.cost-order');
    const priceText = priceElement ? priceElement.textContent.trim().replace('$', '') : '0';
    const price = parseFloat(priceText);
    
    // Extract discipline
    const disciplineElement = orderRow.querySelector('.discipline-order');
    const discipline = disciplineElement ? disciplineElement.textContent.trim() : '';
    
    // Extract academic level
    const academicLevelElement = orderRow.querySelector('.academic-level-order');
    const academicLevel = academicLevelElement ? academicLevelElement.textContent.trim() : '';
    
    // Extract order link - ensure it's the full URL path
    let link = orderRow.getAttribute('href');
    
    // Ensure link starts with https://www.uvocorp.com if it's a relative path
    if (link && link.startsWith('/')) {
      link = `https://www.uvocorp.com${link}`;
    }
    
    // Check if order is new (has class 'new' in the row element)
    const rowElement = orderRow.querySelector('.row');
    const isNew = rowElement && (rowElement.classList.contains('new') || rowElement.classList.contains('row-take-order'));
    
    console.log(`Extracted order info from row - ID: ${id}, Language: ${language}, Deadline: ${deadlineText} (${deadlineHours}h), Discipline: ${discipline}, IsTakeOrder: ${isTakeOrder}`);
    
    return {
      id,
      language,
      deadline: deadlineText,
      deadlineHours,
      price,
      discipline,
      academicLevel,
      link,
      isNew,
      isTakeOrder,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("UvoCorp Order Bot: Error extracting order info from row", error);
    return null;
  }
}

// Extract order information from the order detail page
function extractOrderInfo() {
  try {
    // Extract order ID
    const orderIdElement = document.querySelector('.order--header__name-number');
    if (!orderIdElement) return null;
    
    const id = orderIdElement.textContent.trim().replace('#', '');
    
    // Check if this is a "Take Order" or "Place Bid" page
    // Look for the take order button
    const takeOrderButton = document.querySelector('input[value="Take Order"]');
    const isTakeOrder = takeOrderButton !== null;
    
    // If bid button exists, this is a bid order
    const bidButton = document.querySelector('input[value="Place Bid"]');
    const isBidOrder = bidButton !== null;
    
    // Extract programming language explicitly
    let language = '';
    const programmingLanguageSection = document.querySelector('.order--tabs__content-instraction-table, .order--tabscontent-instraction-table');
    
    if (programmingLanguageSection) {
      const items = programmingLanguageSection.querySelectorAll('li');
      for (const item of items) {
        const label = item.querySelector('.order--tabs__content-instraction-table-label, .order--tabscontent-instraction-table-label');
        const value = item.querySelector('.order--tabs__content-instraction-table-value, .order--tabscontent-instraction-table-value');
        
        if (label && value && label.textContent.trim().includes('Programming language')) {
          language = value.textContent.trim();
          console.log(`Found programming language: ${language}`);
          break;
        }
      }
    }
    
    // If no language was found via direct label, check for the page content
    const pageContainsLanguage = pageContainsAcceptedLanguage();
    if (!language && pageContainsLanguage) {
      const pageContent = document.body.textContent.toLowerCase();
      for (const acceptedLang of BOT_CONFIG.acceptedLanguages) {
        if (pageContent.includes(acceptedLang.toLowerCase())) {
          language = acceptedLang;
          break;
        }
      }
    }
    
    // Extract deadline text and hours
    let deadlineText = '';
    let deadlineHours = 0;
    
    // Look for deadline in the instruction table
    const deadlineElement = document.querySelector('.order--tabs__content-instraction-table-deadline .order--tabs__content-instraction-table-value strong, .order--tabscontent-instraction-table-deadline .order--tabs__content-instraction-table-value strong');
    if (deadlineElement) {
      deadlineText = deadlineElement.textContent.trim();
    }
    
    // Try to extract hours from the green text
    const deadlineHoursElement = document.querySelector('.order--tabs__content-instraction-table-deadline .green, .order--tabscontent-instraction-table-deadline .green');
    if (deadlineHoursElement) {
      const hoursText = deadlineHoursElement.textContent.trim();
      console.log(`Found deadline hours text: ${hoursText}`);
      
      if (hoursText.includes('h')) {
        const hoursMatch = hoursText.match(/\((\d+)\s*h\)/);
        if (hoursMatch) {
          deadlineHours = parseInt(hoursMatch[1], 10);
        }
      } else if (hoursText.includes('d')) {
        const daysMatch = hoursText.match(/\((\d+)\s*d\)/);
        if (daysMatch) {
          deadlineHours = parseInt(daysMatch[1], 10) * 24;
        }
      }
    }
    
    // Extract price
    const priceElement = document.querySelector('.order--header__info-price');
    const priceText = priceElement ? priceElement.textContent.trim().replace('$', '') : '0';
    const price = parseFloat(priceText);
    
    // Extract discipline
    let discipline = '';
    const disciplineElements = document.querySelectorAll('.order--tabs__content-instraction-table li, .order--tabscontent-instraction-table li');
    
    // Find the discipline field
    for (const element of disciplineElements) {
      const labelElement = element.querySelector('.order--tabs__content-instraction-table-label, .order--tabscontent-instraction-table-label');
      const valueElement = element.querySelector('.order--tabs__content-instraction-table-value, .order--tabscontent-instraction-table-value');
      
      if (labelElement && valueElement && 
          labelElement.textContent.trim().includes('Discipline')) {
        discipline = valueElement.textContent.trim();
        break;
      }
    }
    
    console.log(`Extracted Order Info - ID: ${id}, Language: ${language || 'Not specified'}, Deadline: ${deadlineHours}h, Discipline: ${discipline}, Is Take Order: ${isTakeOrder}, Is Bid Order: ${isBidOrder}`);
    
    return {
      id,
      language,
      deadline: deadlineText,
      deadlineHours,
      price,
      discipline,
      link: window.location.href,
      isTakeOrder,
      isBidOrder,
      pageContainsLanguage,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("UvoCorp Order Bot: Error extracting order info", error);
    return null;
  }
}

// Process an order detail page
function processOrderDetail(orderInfo) {
  console.log("UvoCorp Order Bot: Processing order detail", orderInfo);
  
  state.processingOrder = true;
  
  // Save the order details first
  saveOrderDetail(orderInfo);
  
  // Check if language matches
  const languageMatch = isAcceptedLanguage(orderInfo.language) || orderInfo.pageContainsLanguage;
  
  if (!languageMatch) {
    // Reject order - language doesn't match
    const rejectedOrder = {
      ...orderInfo,
      status: 'rejected',
      reason: `Language not in accepted list: ${orderInfo.language}`,
      processedAt: new Date().toISOString()
    };
    
    // Add to rejected orders array
    state.rejectedOrders.unshift(rejectedOrder);
    
    // Explicitly remove from available orders if it exists there
    state.availableOrders = state.availableOrders.filter(order => order.id !== orderInfo.id);
    
    // Save state to ensure consistency
    saveStateToStorage();
    
    // Play rejected sound
    playSound('rejected-order');
    
    // Notify popup about rejected order
    chrome.runtime.sendMessage({
      action: 'orderRejected',
      order: rejectedOrder
    });
    
    // Close the tab and go back to available orders
    closeTabAfterDelay(1000);
    return;
  }
  
  // Check if it's a Take Order or Bid Order
  if (orderInfo.isBidOrder && !orderInfo.isTakeOrder) {
    // Reject - this is a bid order, not a take order
    const rejectedOrder = {
      ...orderInfo,
      status: 'rejected',
      reason: `This is a bid order, not a take order`,
      processedAt: new Date().toISOString()
    };
    
    // Add to rejected orders array
    state.rejectedOrders.unshift(rejectedOrder);
    
    // Explicitly remove from available orders if it exists there
    state.availableOrders = state.availableOrders.filter(order => order.id !== orderInfo.id);
    
    // Save state to ensure consistency
    saveStateToStorage();
    
    // Play rejected sound
    playSound('rejected-order');
    
    // Notify popup about rejected order
    chrome.runtime.sendMessage({
      action: 'orderRejected',
      order: rejectedOrder
    });
    
    // Close the tab and go back to available orders
    closeTabAfterDelay(1000);
    return;
  }
  
  // If we reach here, this is a take order with a matching language - take it
  if (orderInfo.isTakeOrder) {
    // It's a "Take Order" button - we can take it directly
    takeOrder(orderInfo);
  } else {
    // Neither take nor bid button found - something is wrong
    const rejectedOrder = {
      ...orderInfo,
      status: 'rejected',
      reason: "No take order button found",
      processedAt: new Date().toISOString()
    };
    
    // Add to rejected orders array
    state.rejectedOrders.unshift(rejectedOrder);
    
    // Explicitly remove from available orders if it exists there
    state.availableOrders = state.availableOrders.filter(order => order.id !== orderInfo.id);
    
    // Save state to ensure consistency
    saveStateToStorage();
    
    // Play rejected sound
    playSound('rejected-order');
    
    // Notify popup about rejected order
    chrome.runtime.sendMessage({
      action: 'orderRejected',
      order: rejectedOrder
    });
    
    // Close the tab
    closeTabAfterDelay(1000);
  }
}

// Take an order
function takeOrder(orderInfo) {
  try {
    console.log("UvoCorp Order Bot: Taking order");
    
    // Find the Take Order button
    const takeOrderButton = document.querySelector('input[value="Take Order"]');
    
    if (takeOrderButton) {
      console.log("Found Take Order button, clicking immediately");
      
      // Extract order info before taking
      const updatedOrderInfo = orderInfo || extractOrderInfo();
      
      // Process the taken order
      if (updatedOrderInfo) {
        // Add to taken orders
        const takenOrder = {
          ...updatedOrderInfo,
          status: 'taken',
          processedAt: new Date().toISOString()
        };
        
        state.takenOrders.unshift(takenOrder);
        
        // Remove from available orders
        state.availableOrders = state.availableOrders.filter(order => order.id !== updatedOrderInfo.id);
        
        // Add to all visited orders with 'taken' status if not already there
        const existingIndex = state.allVisitedOrders.findIndex(order => order.id === updatedOrderInfo.id);
        if (existingIndex >= 0) {
          // Update existing entry
          state.allVisitedOrders[existingIndex] = {
            ...state.allVisitedOrders[existingIndex],
            status: 'taken',
            processedAt: new Date().toISOString()
          };
        } else {
          // Add new entry
          state.allVisitedOrders.unshift(takenOrder);
        }
        
        // Save state to ensure consistency
        saveStateToStorage();
        
        // Play taken sound
        playSound('order-taken');
        
        // Send notification
        if (BOT_CONFIG.desktopNotifications) {
          sendNotification(
            'Order Taken!',
            `${updatedOrderInfo.language || 'Order'} - $${updatedOrderInfo.price}`
          );
        }
        
        // Notify popup about taken order
        chrome.runtime.sendMessage({
          action: 'orderTaken',
          order: takenOrder
        });
      }
      
      // Click the Take Order button
      takeOrderButton.click();
      
      // Also dispatch a click event for redundancy
      takeOrderButton.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      }));
      
      // Also try submitting the form directly
      const form = takeOrderButton.closest('form');
      if (form) {
        try {
          console.log("Found form, submitting directly");
          form.submit();
        } catch (e) {
          console.log("Form submit failed:", e);
        }
      }
      
      // Close the tab after a delay
      closeTabAfterDelay(2000);
    } else {
      console.log("UvoCorp Order Bot: Take Order button not found");
      
      // Notify popup about error
      chrome.runtime.sendMessage({
        action: 'error',
        message: 'Take Order button not found'
      });
      
      closeTabAfterDelay(1000);
    }
  } catch (error) {
    console.error("UvoCorp Order Bot: Error taking order", error);
    
    // Notify popup about error
    chrome.runtime.sendMessage({
      action: 'error',
      message: `Error taking order: ${error.message}`
    });
    
    closeTabAfterDelay(1000);
  }
}

// Close the current tab after a delay
function closeTabAfterDelay(delay) {
  setTimeout(() => {
    state.processingOrder = false;
    
    // Send message to background script to close the tab
    chrome.runtime.sendMessage({
      action: "closeCurrentTab"
    });
  }, delay);
}

// Open an order detail in a new tab
function openOrderDetail(link) {
  state.processingOrder = true;
  
  // Fix the URL if it's just a relative path
  let fullUrl = link;
  
  // Check if link is a relative path
  if (link && link.startsWith('/')) {
    fullUrl = `https://www.uvocorp.com${link}`;
  }
  
  // Log the URL we're opening
  console.log("UvoCorp Order Bot: Opening order details at", fullUrl);
  
  // Send message to background script to open the link in a new tab
  chrome.runtime.sendMessage({
    action: "openTab",
    url: fullUrl
  }, function(response) {
    if (response && response.success) {
      console.log("Tab opened successfully with ID:", response.tabId);
    } else {
      console.error("Failed to open tab");
      state.processingOrder = false;
    }
  });
}

// Send a notification
function sendNotification(title, message) {
  // Send message to background script to show notification
  chrome.runtime.sendMessage({
    action: "showNotification",
    title: title,
    message: message
  });
}

// Inject a status panel into the page
function injectStatusPanel() {
  // Create panel element if it doesn't exist
  if (!document.getElementById('uvo-bot-indicator')) {
    const panel = document.createElement('div');
    panel.id = 'uvo-bot-indicator';
    panel.className = 'uvo-bot-indicator';
    panel.innerHTML = `
      <div class="uvo-bot-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      </div>
      <div class="uvo-bot-text">UvoCorp Bot Active</div>
      <div class="uvo-bot-stats">Processed: 0</div>
    `;
    
    // Add styles
    const styles = document.createElement('style');
    styles.textContent = `
      .uvo-bot-indicator {
        position: fixed;
        bottom: 20px;
        left: 20px;
        display: flex;
        align-items: center;
        background-color: rgba(67, 97, 238, 0.95);
        color: white;
        padding: 10px 16px;
        border-radius: 30px;
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        z-index: 9999;
        transition: all 0.3s ease;
        cursor: pointer;
      }
      
      .uvo-bot-indicator.inactive {
        background-color: rgba(230, 57, 70, 0.95);
      }
      
      .uvo-bot-indicator.dark-theme {
        background-color: rgba(45, 55, 72, 0.95);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }
      
      .uvo-bot-indicator.dark-theme.inactive {
        background-color: rgba(176, 42, 55, 0.95);
      }
      
      .uvo-bot-icon {
        width: 20px;
        height: 20px;
        margin-right: 8px;
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
      
      .uvo-bot-indicator.inactive .uvo-bot-icon {
        animation: none;
      }
      
      .uvo-bot-text {
        font-weight: 500;
        margin-right: 8px;
      }
      
      .uvo-bot-stats {
        background-color: rgba(255, 255, 255, 0.2);
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 12px;
      }
      
      .uvo-bot-indicator.dark-theme .uvo-bot-stats {
        background-color: rgba(255, 255, 255, 0.15);
      }
      
      /* Add animation for when new orders are found */
      @keyframes highlight {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3); }
        100% { transform: scale(1); }
      }
      
      .uvo-bot-highlight {
        animation: highlight 0.5s ease-in-out;
      }
    `;
    
    // Add to page
    document.body.appendChild(styles);
    document.body.appendChild(panel);
    
    // Add click event to toggle active state
    panel.addEventListener('click', function() {
      state.active = !state.active;
      updateStatusPanel();
      
      // Save active state
      chrome.storage.local.set({ uvoBotEnabled: state.active });
      
      // Start or stop monitoring
      if (state.active) {
        startMonitoring();
      } else {
        stopMonitoring();
      }
      
      // Notify popup about state change
      chrome.runtime.sendMessage({
        action: 'updateState',
        state: {
          active: state.active,
          newOrdersFound: state.newOrdersFound,
          rejectedOrders: state.rejectedOrders,
          takenOrders: state.takenOrders,
          availableOrders: state.availableOrders,
          allVisitedOrders: state.allVisitedOrders
        }
      });
    });
    
    // Apply theme
    applyTheme();
  }
}

// Update the status panel based on current state
function updateStatusPanel() {
  const panel = document.getElementById('uvo-bot-indicator');
  if (!panel) return;
  
  if (state.active) {
    panel.classList.remove('inactive');
    panel.querySelector('.uvo-bot-text').textContent = 'UvoCorp Bot Active';
  } else {
    panel.classList.add('inactive');
    panel.querySelector('.uvo-bot-text').textContent = 'UvoCorp Bot Paused';
  }
  
  // Update stats
  const processedCount = state.takenOrders.length + state.rejectedOrders.length;
  panel.querySelector('.uvo-bot-stats').textContent = `Processed: ${processedCount}`;
  
  // Add highlight animation when new orders are found
  if (processedCount > 0) {
    panel.classList.add('uvo-bot-highlight');
    
    // Remove the class after animation completes
    setTimeout(() => {
      panel.classList.remove('uvo-bot-highlight');
    }, 500);
  }
}

// Mutation observer to detect DOM changes and quickly react to new orders
function setupMutationObserver() {
  // Create a new observer
  const observer = new MutationObserver((mutations) => {
    // Check if we should process these mutations
    if (!state.active || state.processingOrder || state.scanningInProgress) return;
    
    // Check for added nodes containing order rows
    let newOrdersDetected = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if any of the added nodes contain order rows
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Look for new order rows in this node
            const newOrderRows = node.querySelectorAll ? 
              node.querySelectorAll('.row.new, .row-take-order') : [];
            
            if (newOrderRows.length > 0) {
              // New orders detected
              newOrdersDetected = true;
              break;
            } else {
              // Even without '.new' class, check if there are any new rows we haven't seen
              const allOrderRows = node.querySelectorAll ? 
                node.querySelectorAll('.order-link') : [];
              
              for (const row of allOrderRows) {
                const idElement = row.querySelector('.id-number-order');
                if (idElement) {
                  const id = idElement.textContent.trim().replace('#', '');
                  
                  if (!state.lastOrderIds.has(id)) {
                    // Found a new order we haven't seen
                    newOrdersDetected = true;
                    break;
                  }
                }
              }
            }
            
            if (newOrdersDetected) break;
          }
        }
      }
      
      if (newOrdersDetected) break;
    }
    
    if (newOrdersDetected) {
      console.log("UvoCorp Order Bot: New orders detected via mutation observer");
      // Trigger background scan immediately
      backgroundOrderScan();
    }
  });
  
  // Start observing with a more comprehensive configuration
  observer.observe(document.body, {
    childList: true,    // Watch for child element additions/removals
    subtree: true,      // Watch the entire subtree for changes
    attributes: false,  // Don't watch for attribute changes (unnecessary for our case)
    characterData: false // Don't watch for text content changes (unnecessary for our case)
  });
  
  return observer;
}

// Placeholder for scanAvailableOrders - needed for compatibility with existing code
function scanAvailableOrders() {
  console.log("Function scanAvailableOrders is not defined but was called. Using backgroundOrderScan instead.");
  backgroundOrderScan();
}