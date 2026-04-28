// UvoCorp Order Bot - Background Script

// Initialize extension state when installed
chrome.runtime.onInstalled.addListener(function() {
  console.log("UvoCorp Order Bot installed");
  
  // Initialize default configuration
  const defaultConfig = {
    botEnabled: true,
    acceptedLanguages: [
      'java', 'python', 'r', 'r studio', 'spss', 'php', 'tableau', 'tabeleau', 'power bi',
      'adobe', 'html', 'dart', 'flutter', 'react', 'web', 'sql', 'database',
      'golang', 'laravel', 'c#', 'networking', 'cisco', 'packet tracer', 'assembly',
      'check instructions', 'excel', 'computer science', 'verilog'
    ],
    minimumDeadlineHours: 5,
    refreshInterval: 6, // seconds
    soundEnabled: true,
    desktopNotifications: true,
    autoRefresh: true,
    useDirectProcessing: true,
    openInNewTab: true
  };
  
  // Initialize storage
  chrome.storage.local.set({
    uvoBotEnabled: defaultConfig.botEnabled,
    uvoAcceptedLanguages: defaultConfig.acceptedLanguages,
    uvoMinimumDeadlineHours: defaultConfig.minimumDeadlineHours,
    uvoRefreshInterval: defaultConfig.refreshInterval,
    uvoSoundEnabled: defaultConfig.soundEnabled,
    uvoDesktopNotifications: defaultConfig.desktopNotifications,
    uvoAutoRefresh: defaultConfig.autoRefresh,
    uvoUseDirectProcessing: defaultConfig.useDirectProcessing,
    uvoOpenInNewTab: defaultConfig.openInNewTab,
    uvoRejectedOrders: [],
    uvoTakenOrders: [],
    uvoAvailableOrders: [],
    uvoAllVisitedOrders: [],
    uvoLogs: [],
    uvoOrderDetails: {}
  });
});

// Track active tab information
let activeTabInfo = {
  tabId: null,
  url: null,
  isMonitoring: false
};

// Sound library - note URLs will be populated at runtime
const soundLibrary = {
  'new-order': {
    url: null,
    description: 'Bright chime notification for new available orders'
  },
  'order-taken': {
    url: null,
    description: 'Success sound with fanfare for taken orders'
  },
  'rejected-order': {
    url: null,
    description: 'Alert sound for rejected orders'
  },
  'notification': {
    url: null,
    description: 'Generic notification sound'
  }
};

// Initialize sound library with actual URLs
function initSoundLibrary() {
  soundLibrary['new-order'].url = chrome.runtime.getURL('sounds/new-order.mp3');
  soundLibrary['order-taken'].url = chrome.runtime.getURL('sounds/order-taken.mp3');
  soundLibrary['rejected-order'].url = chrome.runtime.getURL('sounds/rejected-order.mp3');
  soundLibrary['notification'].url = chrome.runtime.getURL('sounds/notification.mp3');
  console.log("Sound URLs initialized:", soundLibrary);
}

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log("Background received message:", request);
  
  if (request.action === "openTab") {
    // Open a new tab with the specified URL
    chrome.tabs.create({ url: request.url, active: true }, function(tab) {
      console.log("Opened tab:", tab.id);
      sendResponse({ success: true, tabId: tab.id });
    });
    return true; // Keep the message channel open for async response
  } else if (request.action === "closeCurrentTab") {
    // Close the current tab
    if (sender.tab) {
      chrome.tabs.remove(sender.tab.id, function() {
        console.log("Closed tab:", sender.tab.id);
        sendResponse({ success: true });
      });
      return true; // Keep the message channel open for async response
    }
  } else if (request.action === "playSound") {
    // Play a notification sound in the content script
    playSound(request.sound, sender.tab ? sender.tab.id : null);
    sendResponse({ success: true });
  } else if (request.action === "showNotification") {
    // Show a notification
    showNotification(request.title, request.message);
    sendResponse({ success: true });
  } else if (request.action === "saveOrderDetail") {
    // Save order details
    saveOrderDetail(request.orderId, request.details);
    sendResponse({ success: true });
  } else if (request.action === "updateBadge") {
    // Update extension badge
    updateBadge(request.count);
    sendResponse({ success: true });
  } else if (request.action === "getCurrentTabId") {
    // Return the current tab ID
    sendResponse({ 
      tabId: sender.tab ? sender.tab.id : null,
      isMonitoringTab: sender.tab && sender.tab.id === activeTabInfo.tabId
    });
  }
  
  return true; // Keep the message channel open for async response
});

// Initialize the extension when the browser starts
chrome.runtime.onStartup.addListener(function() {
  // Initialize sound library
  initSoundLibrary();
});

// Make sure sounds are initialized when extension is loaded
initSoundLibrary();

// Play a notification sound by injecting a content script
function playSound(soundName, tabId) {
  try {
    // Check if we have a valid sound name
    if (!soundLibrary[soundName]) {
      soundName = 'notification'; // Fallback to default notification sound
    }
    
    console.log(`Attempting to play sound: ${soundName} from URL: ${soundLibrary[soundName].url}`);
    
    // Get the URL for the sound
    const soundUrl = soundLibrary[soundName].url;
    
    // Try to find a tab to play the sound in
    if (tabId) {
      // If we have a tab ID, use it
      playSoundInTab(soundName, soundUrl, tabId);
    } else {
      // Otherwise find an active UvoCorp tab
      chrome.tabs.query({ active: true, url: "https://www.uvocorp.com/*" }, function(tabs) {
        if (tabs.length > 0) {
          playSoundInTab(soundName, soundUrl, tabs[0].id);
        } else {
          // If no UvoCorp tab is active, try any active tab
          chrome.tabs.query({ active: true, currentWindow: true }, function(activeTabs) {
            if (activeTabs.length > 0) {
              playSoundInTab(soundName, soundUrl, activeTabs[0].id);
            } else {
              // Last resort: try to find any UvoCorp tab
              chrome.tabs.query({ url: "https://www.uvocorp.com/*" }, function(uvoTabs) {
                if (uvoTabs.length > 0) {
                  playSoundInTab(soundName, soundUrl, uvoTabs[0].id);
                } else {
                  console.log("No suitable tab found to play sound, using fallback audio API");
                  // As a last resort, create and play audio directly in background context
                  try {
                    const audio = new Audio(soundUrl);
                    audio.volume = 1.0;
                    audio.play().catch(error => {
                      console.error("Background audio API failed:", error);
                    });
                  } catch (e) {
                    console.error("Background audio creation failed:", e);
                  }
                }
              });
            }
          });
        }
      });
    }
  } catch (error) {
    console.error("Error in sound playback:", error);
  }
}

// Play sound in a specific tab
function playSoundInTab(soundName, soundUrl, tabId) {
  console.log(`Attempting to play sound ${soundName} in tab ${tabId}`);
  
  // First try using executeScript (more reliable)
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: playSoundInPage,
    args: [soundUrl, soundName]
  }).catch(error => {
    console.error("Error injecting sound script:", error);
    
    // Fallback to sending a message to the content script
    chrome.tabs.sendMessage(tabId, {
      action: "playSound",
      soundUrl: soundUrl,
      soundName: soundName
    }).catch(msgError => {
      console.error("Error sending sound message:", msgError);
    });
  });
}

// Function to play sound in the page context
function playSoundInPage(soundUrl, soundName) {
  try {
    console.log(`Trying to play sound ${soundName} in page from ${soundUrl}`);
    
    // Create an audio element
    const audio = new Audio(soundUrl);
    audio.volume = 1.0;
    
    // Make sure it loads
    audio.oncanplaythrough = () => {
      console.log(`Sound ${soundName} loaded, attempting to play`);
    };
    
    // Handle errors
    audio.onerror = (e) => {
      console.error(`Error loading sound ${soundName}:`, e);
    };
    
    // Play the sound
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise.then(() => {
        console.log(`Sound ${soundName} played successfully in page`);
      }).catch(error => {
        console.error(`Failed to play sound ${soundName} in page:`, error);
        
        // Fallback for browsers that block autoplay
        const tempAudio = document.createElement('audio');
        tempAudio.src = soundUrl;
        tempAudio.volume = 1.0;
        document.body.appendChild(tempAudio);
        
        // Add user interaction hooks for later playback
        const playOnInteraction = function() {
          tempAudio.play()
            .then(() => {
              console.log(`Sound played on user interaction`);
              // Clean up event listeners
              document.removeEventListener('click', playOnInteraction);
              document.removeEventListener('keydown', playOnInteraction);
              // Remove after playing
              setTimeout(() => {
                document.body.removeChild(tempAudio);
              }, 3000);
            })
            .catch(() => {
              document.body.removeChild(tempAudio);
            });
        };
        
        // Add listeners for user interaction
        document.addEventListener('click', playOnInteraction, { once: true });
        document.addEventListener('keydown', playOnInteraction, { once: true });
      });
    }
  } catch (error) {
    console.error("Error playing sound in page:", error);
  }
}

// Show a browser notification
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: title,
    message: message,
    priority: 2,
    silent: false
  }, function(notificationId) {
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
    }, 5000);
  });
}

// Save order details
function saveOrderDetail(orderId, details) {
  // Get existing order details
  chrome.storage.local.get(['uvoOrderDetails'], function(result) {
    const orderDetails = result.uvoOrderDetails || {};
    
    // Add timestamp for expiration
    details.savedAt = new Date().getTime();
    
    // Save the details
    orderDetails[orderId] = details;
    
    // Clean up old order details (older than 24 hours)
    const now = new Date().getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    Object.keys(orderDetails).forEach(id => {
      if (orderDetails[id].savedAt && (now - orderDetails[id].savedAt > oneDayMs)) {
        delete orderDetails[id];
      }
    });
    
    // Save back to storage
    chrome.storage.local.set({ uvoOrderDetails: orderDetails });
  });
}

// Update extension badge
function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#4361ee' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Monitor when tabs are updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Update active tab info for UvoCorp orders page
    if (tab.url.includes('uvocorp.com/orders/available.html')) {
      activeTabInfo.tabId = tabId;
      activeTabInfo.url = tab.url;
      activeTabInfo.isMonitoring = true;
      
      // Check if the bot should be active
      chrome.storage.local.get(['uvoBotEnabled'], function(result) {
        const shouldBeActive = result.uvoBotEnabled === true;
        
        if (shouldBeActive) {
          // Send a message to the content script to start monitoring
          chrome.tabs.sendMessage(tabId, {
            action: "toggleActive",
            active: true
          }).catch(error => {
            console.log("Error sending message to tab:", error);
          });
        }
      });
    } else if (activeTabInfo.tabId === tabId) {
      // User navigated away from orders page in the monitoring tab
      activeTabInfo.url = tab.url;
      activeTabInfo.isMonitoring = tab.url.includes('uvocorp.com/orders/available.html');
    }
  }
});

// Track when a tab becomes active
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (activeInfo.tabId === activeTabInfo.tabId) {
    // The monitoring tab became active again
    console.log("Monitoring tab is now active");
  }
});

// Track when a tab is closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (tabId === activeTabInfo.tabId) {
    // The monitoring tab was closed
    activeTabInfo.tabId = null;
    activeTabInfo.url = null;
    activeTabInfo.isMonitoring = false;
    console.log("Monitoring tab was closed");
  }
});

// Create context menu for quick actions
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "uvobot-toggle",
    title: "Toggle UvoCorp Bot",
    contexts: ["page"],
    documentUrlPatterns: ["https://www.uvocorp.com/*"]
  });
  
  chrome.contextMenus.create({
    id: "uvobot-refresh",
    title: "Refresh Page Now",
    contexts: ["page"],
    documentUrlPatterns: ["https://www.uvocorp.com/*"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "uvobot-toggle") {
    // Toggle bot status
    chrome.storage.local.get(['uvoBotEnabled'], function(result) {
      const newStatus = !(result.uvoBotEnabled === true);
      
      // Save new status
      chrome.storage.local.set({ uvoBotEnabled: newStatus });
      
      // Send message to content script
      chrome.tabs.sendMessage(tab.id, {
        action: "toggleActive",
        active: newStatus
      }).catch(error => {
        console.log("Error sending toggle message to tab:", error);
      });
      
      // Show notification
      showNotification(
        "UvoCorp Bot Status",
        newStatus ? "Bot is now active" : "Bot is now paused"
      );
    });
  } else if (info.menuItemId === "uvobot-refresh") {
    // Refresh the page
    chrome.tabs.reload(tab.id);
  }
});