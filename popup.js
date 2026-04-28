// UvoCorp Order Bot - Popup Script

// Default configuration
const DEFAULT_CONFIG = {
  acceptedLanguages: [
    'java', 'python', 'r', 'r studio', 'spss', 'php', 'tableau', 'tabeleau', 'power bi',
    'adobe', 'html', 'dart', 'flutter', 'react', 'web', 'sql', 'database',
    'golang', 'laravel', 'c#', 'networking', 'cisco', 'packet tracer', 'assembly',
    'check instructions', 'excel', 'computer science', 'verilog'
  ],
  minimumDeadlineHours: 5,
  softRefreshInterval: 1000, // 1 second
  hardRefreshInterval: 6000, // 6 seconds
  maxOrdersToShow: 200,
  soundEnabled: true,
  desktopNotifications: true,
  botEnabled: true,
  autoRefresh: true
};

// State
let botState = {
  active: true,
  stats: {
    available: 0,
    new: 0,
    rejected: 0,
    taken: 0
  },
  orders: {
    available: [],
    rejected: [],
    taken: []
  },
  logs: [],
  config: { ...DEFAULT_CONFIG }
};

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabPanes = document.querySelectorAll('.tab-pane');
const toggleBotButton = document.getElementById('toggleBot');
const toggleText = document.getElementById('toggleText');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const refreshPageButton = document.getElementById('refreshPage');
const statusIndicator = document.querySelector('.status-indicator');
const statusText = document.getElementById('statusText');

// Stats Elements
const availableCountElement = document.getElementById('availableCount');
const newCountElement = document.getElementById('newCount');
const rejectedCountElement = document.getElementById('rejectedCount');
const takenCountElement = document.getElementById('takenCount');

// History Elements
const historyTypeSelect = document.getElementById('historyType');
const historyList = document.getElementById('historyList');
const emptyHistory = document.getElementById('emptyHistory');
const clearHistoryButton = document.getElementById('clearHistory');

// Logs Elements
const recentLogsElement = document.getElementById('recentLogs');
const logsListElement = document.getElementById('logsList');
const clearLogsButton = document.getElementById('clearLogs');

// Settings Elements
const botEnabledSwitch = document.getElementById('botEnabled');
const autoRefreshSwitch = document.getElementById('autoRefresh');
const refreshIntervalInput = document.getElementById('refreshInterval');
const minDeadlineInput = document.getElementById('minDeadline');
const languageTagsContainer = document.getElementById('languageTags');
const newLanguageInput = document.getElementById('newLanguage');
const addLanguageButton = document.getElementById('addLanguage');
const soundEnabledSwitch = document.getElementById('soundEnabled');
const desktopNotificationsSwitch = document.getElementById('desktopNotifications');
const saveSettingsButton = document.getElementById('saveSettings');
const resetSettingsButton = document.getElementById('resetSettings');

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
  // Initialize tabs
  initTabs();
  
  // Load data from storage
  loadStateFromStorage();
  
  // Initialize UI event listeners
  initEventListeners();
  
  // Get current tab status
  checkCurrentTab();
}

// Tab functionality
function initTabs() {
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      
      // Update active tab button
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
      });
      button.classList.add('active');
      
      // Show the selected tab pane
      tabPanes.forEach(pane => {
        pane.classList.remove('active');
      });
      document.getElementById(tabName).classList.add('active');
    });
  });
}

// Initialize event listeners
function initEventListeners() {
  // Toggle bot status
  toggleBotButton.addEventListener('click', toggleBotStatus);
  
  // Refresh page
  refreshPageButton.addEventListener('click', refreshCurrentPage);
  
  // History type change
  historyTypeSelect.addEventListener('change', updateHistoryList);
  
  // Clear history
  clearHistoryButton.addEventListener('click', clearHistory);
  
  // Clear logs
  clearLogsButton.addEventListener('click', clearLogs);
  
  // Language management
  addLanguageButton.addEventListener('click', addLanguage);
  newLanguageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addLanguage();
    }
  });
  
  // Settings buttons
  saveSettingsButton.addEventListener('click', saveSettings);
  resetSettingsButton.addEventListener('click', resetSettings);
  
  // Help links
  document.getElementById('reportIssue').addEventListener('click', reportIssue);
  document.getElementById('helpLink').addEventListener('click', showHelp);
}

// Load state from storage with improved order status tracking
function loadStateFromStorage() {
  chrome.storage.local.get([
    'uvoBotEnabled',
    'uvoAcceptedLanguages',
    'uvoMinimumDeadlineHours',
    'uvoRefreshInterval',
    'uvoSoundEnabled',
    'uvoDesktopNotifications',
    'uvoAutoRefresh',
    'uvoRejectedOrders',
    'uvoTakenOrders',
    'uvoAvailableOrders',
    'uvoAllVisitedOrders',
    'uvoLogs',
    'uvoOrderDetails'
  ], function(result) {
    // Load configuration
    botState.active = result.uvoBotEnabled !== undefined ? result.uvoBotEnabled : true;
    botState.config.acceptedLanguages = result.uvoAcceptedLanguages || DEFAULT_CONFIG.acceptedLanguages;
    botState.config.minimumDeadlineHours = result.uvoMinimumDeadlineHours || DEFAULT_CONFIG.minimumDeadlineHours;
    botState.config.hardRefreshInterval = (result.uvoRefreshInterval || DEFAULT_CONFIG.hardRefreshInterval / 1000) * 1000;
    botState.config.soundEnabled = result.uvoSoundEnabled !== undefined ? result.uvoSoundEnabled : true;
    botState.config.desktopNotifications = result.uvoDesktopNotifications !== undefined ? result.uvoDesktopNotifications : true;
    botState.config.autoRefresh = result.uvoAutoRefresh !== undefined ? result.uvoAutoRefresh : true;
    
    // Load orders with validation and deduplication
    const loadedRejectedOrders = result.uvoRejectedOrders || [];
    const loadedTakenOrders = result.uvoTakenOrders || [];
    const loadedAvailableOrders = result.uvoAvailableOrders || [];
    
    // Validate and deduplicate orders by ID - ensure proper status segregation
    const orderIdSet = {
      taken: new Set(),
      rejected: new Set(),
      available: new Set()
    };
    
    // Clean taken orders - ensure no ID exists in multiple categories
    botState.orders.taken = loadedTakenOrders.filter(order => {
      if (!order || !order.id) return false;
      orderIdSet.taken.add(order.id);
      return true;
    });
    
    // Clean rejected orders - ensure no overlap with taken orders
    botState.orders.rejected = loadedRejectedOrders.filter(order => {
      if (!order || !order.id) return false;
      if (orderIdSet.taken.has(order.id)) return false;
      orderIdSet.rejected.add(order.id);
      return true;
    });
    
    // Clean available orders - ensure no overlap with taken or rejected
    botState.orders.available = loadedAvailableOrders.filter(order => {
      if (!order || !order.id) return false;
      if (orderIdSet.taken.has(order.id) || orderIdSet.rejected.has(order.id)) return false;
      orderIdSet.available.add(order.id);
      return true;
    });
    
    // Load order details
    botState.orderDetails = result.uvoOrderDetails || {};
    
    // Load logs
    botState.logs = result.uvoLogs || [];
    
    // Update stats
    updateStats();
    
    // Update UI
    updateUI();
    
    // Save the cleaned-up state back to storage
    saveStateToStorage();
  });
}

// Save state to Chrome's local storage with improved consistency
function saveStateToStorage() {
  // Validate orders before saving to prevent inconsistent state
  ensureOrderConsistency();
  
  // Limit the number of orders we store
  const limitArray = (arr) => arr && arr.length ? arr.slice(0, BOT_CONFIG.maxOrdersToShow) : [];
  
  chrome.storage.local.set({
    uvoBotEnabled: botState.active,
    uvoRejectedOrders: limitArray(botState.orders.rejected),
    uvoTakenOrders: limitArray(botState.orders.taken),
    uvoAvailableOrders: limitArray(botState.orders.available),
    uvoAllVisitedOrders: limitArray(botState.orders.all || []),
    uvoLogs: limitArray(botState.logs)
  });
}

// Ensure order consistency - prevent duplicate IDs across categories
function ensureOrderConsistency() {
  // Get all order IDs by category
  const takenIds = new Set(botState.orders.taken.map(order => order.id));
  const rejectedIds = new Set(botState.orders.rejected.map(order => order.id));
  
  // Remove any orders from rejected that are also in taken
  botState.orders.rejected = botState.orders.rejected.filter(order => 
    !takenIds.has(order.id)
  );
  
  // Remove any orders from available that are in taken or rejected
  botState.orders.available = botState.orders.available.filter(order => 
    !takenIds.has(order.id) && !rejectedIds.has(order.id)
  );
}

// Update UI based on current state
function updateUI() {
  // Update bot status UI
  updateBotStatusUI();
  
  // Update stats
  updateStatsUI();
  
  // Update history list
  updateHistoryList();
  
  // Update logs
  updateLogsUI();
  
  // Update settings UI
  updateSettingsUI();
}

// Update bot status UI elements
function updateBotStatusUI() {
  if (botState.active) {
    statusIndicator.classList.remove('paused');
    statusText.textContent = 'Active';
    toggleText.textContent = 'Pause Bot';
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
  } else {
    statusIndicator.classList.add('paused');
    statusText.textContent = 'Paused';
    toggleText.textContent = 'Start Bot';
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
  }
}

// Update stats and UI
function updateStats() {
  botState.stats.available = botState.orders.available.length;
  botState.stats.rejected = botState.orders.rejected.length;
  botState.stats.taken = botState.orders.taken.length;
  botState.stats.new = botState.orders.available.filter(order => order.isNew).length;
}

// Update stats UI elements
function updateStatsUI() {
  availableCountElement.textContent = botState.stats.available;
  newCountElement.textContent = botState.stats.new;
  rejectedCountElement.textContent = botState.stats.rejected;
  takenCountElement.textContent = botState.stats.taken;
}

// Update history list based on selected type
function updateHistoryList() {
  const historyType = historyTypeSelect.value;
  let orders = [];
  
  // Load the most up-to-date data from storage
  chrome.storage.local.get([
    'uvoTakenOrders',
    'uvoRejectedOrders',
    'uvoAvailableOrders'
  ], function(result) {
    // Update our local state with the latest data
    botState.orders.taken = result.uvoTakenOrders || [];
    botState.orders.rejected = result.uvoRejectedOrders || [];
    botState.orders.available = result.uvoAvailableOrders || [];
    
    // Update stats
    updateStats();
    updateStatsUI();
    
    // Now select the correct array based on history type
    switch (historyType) {
      case 'taken':
        orders = botState.orders.taken;
        break;
      case 'rejected':
        orders = botState.orders.rejected;
        break;
      case 'available':
        orders = botState.orders.available;
        break;
    }
    
    // Clear history list
    historyList.innerHTML = '';
    
    // Show empty state if no orders
    if (!orders || orders.length === 0) {
      emptyHistory.classList.remove('hidden');
      return;
    }
    
    // Hide empty state and render orders
    emptyHistory.classList.add('hidden');
    
    // Render history items
    orders.forEach(order => {
      if (!order || !order.id) return; // Skip invalid orders
      
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      
      // Format price
      const formattedPrice = order.price ? `$${order.price.toFixed(2)}` : 'N/A';
      
      // Format deadline
      const deadline = order.deadline || 'N/A';
      
      // Format timestamp
      const timestamp = formatTimestamp(order.timestamp);
      
      historyItem.innerHTML = `
        <div class="history-item-header">
          <div class="history-id">#${order.id}</div>
          <div class="history-price">${formattedPrice}</div>
        </div>
        <div class="history-item-details">
          <div class="history-detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            ${deadline}
          </div>
          <div class="history-detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            ${order.language || 'N/A'}
          </div>
          <div class="history-detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            ${order.discipline || 'N/A'}
          </div>
        </div>
        ${order.reason ? `<div class="rejected-reason">Rejected: ${order.reason}</div>` : ''}
        <div class="history-item-footer">
          <div class="history-timestamp">${timestamp}</div>
          ${historyType === 'available' ? `<div class="history-view-button">
            <a href="${order.link}" target="_blank" class="button primary small">View Order</a>
          </div>` : ''}
        </div>
      `;
      
      historyList.appendChild(historyItem);
    });
  });
}

// Update logs UI
function updateLogsUI() {
  // Update recent logs
  updateRecentLogs();
  
  // Update full logs list
  updateFullLogs();
}

// Update recent logs in dashboard
function updateRecentLogs() {
  recentLogsElement.innerHTML = '';
  
  // Get 5 most recent logs
  const recentLogs = botState.logs.slice(0, 5);
  
  if (recentLogs.length === 0) {
    const emptyLog = document.createElement('div');
    emptyLog.className = 'log-item log-info';
    emptyLog.innerHTML = `
      <div class="log-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12" y2="8"></line>
        </svg>
      </div>
      <div class="log-content">
        <div class="log-message">No recent activity</div>
      </div>
    `;
    recentLogsElement.appendChild(emptyLog);
    return;
  }
  
  recentLogs.forEach(log => {
    const logItem = createLogElement(log);
    recentLogsElement.appendChild(logItem);
  });
}

// Update full logs list
function updateFullLogs() {
  logsListElement.innerHTML = '';
  
  if (botState.logs.length === 0) {
    const emptyLog = document.createElement('div');
    emptyLog.className = 'log-item log-info';
    emptyLog.innerHTML = `
      <div class="log-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12" y2="8"></line>
        </svg>
      </div>
      <div class="log-content">
        <div class="log-message">No logs found</div>
      </div>
    `;
    logsListElement.appendChild(emptyLog);
    return;
  }
  
  botState.logs.forEach(log => {
    const logItem = createLogElement(log);
    logsListElement.appendChild(logItem);
  });
}

// Create log element
function createLogElement(log) {
  const logItem = document.createElement('div');
  logItem.className = `log-item log-${log.type || 'info'}`;
  
  // Get icon based on log type
  let icon = '';
  switch (log.type) {
    case 'success':
      icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>`;
      break;
    case 'warning':
      icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>`;
      break;
    case 'error':
      icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>`;
      break;
    default:
      icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12" y2="8"></line>
      </svg>`;
  }
  
  // Format time
  const timestamp = formatTimestamp(log.timestamp);
  
  logItem.innerHTML = `
    <div class="log-icon">
      ${icon}
    </div>
    <div class="log-content">
      <div class="log-message">${log.message}</div>
      <div class="log-time">${timestamp}</div>
    </div>
  `;
  
  return logItem;
}

// Update settings UI
function updateSettingsUI() {
  // Update switches
  botEnabledSwitch.checked = botState.active;
  autoRefreshSwitch.checked = botState.config.autoRefresh;
  soundEnabledSwitch.checked = botState.config.soundEnabled;
  desktopNotificationsSwitch.checked = botState.config.desktopNotifications;
  
  // Update inputs
  refreshIntervalInput.value = botState.config.hardRefreshInterval / 1000;
  minDeadlineInput.value = botState.config.minimumDeadlineHours;
  
  // Update language tags
  updateLanguageTags();
}

// Update language tags
function updateLanguageTags() {
  languageTagsContainer.innerHTML = '';
  
  botState.config.acceptedLanguages.forEach(language => {
    const tag = document.createElement('div');
    tag.className = 'language-tag';
    tag.innerHTML = `
      ${language}
      <div class="language-tag-remove" data-language="${language}">×</div>
    `;
    
    // Add click event for remove button
    tag.querySelector('.language-tag-remove').addEventListener('click', (e) => {
      removeLanguage(language);
    });
    
    languageTagsContainer.appendChild(tag);
  });
}

// Toggle bot status
function toggleBotStatus() {
  botState.active = !botState.active;
  
  // Update storage
  chrome.storage.local.set({ uvoBotEnabled: botState.active });
  
  // Update UI
  updateBotStatusUI();
  
  // Send message to content script
  sendMessageToActiveTab({
    action: 'toggleActive',
    active: botState.active
  });
  
  // Add log
  addLog({
    type: botState.active ? 'success' : 'warning',
    message: botState.active ? 'Bot activated' : 'Bot paused',
    timestamp: new Date().toISOString()
  });
}

// Add a new language
function addLanguage() {
  const language = newLanguageInput.value.trim();
  
  if (!language) return;
  
  // Check if language already exists
  if (botState.config.acceptedLanguages.includes(language)) {
    // Show error message
    alert(`Language "${language}" already exists!`);
    return;
  }
  
  // Add language
  botState.config.acceptedLanguages.push(language);
  
  // Update UI
  updateLanguageTags();
  
  // Clear input
  newLanguageInput.value = '';
  
  // Add log
  addLog({
    type: 'info',
    message: `Added language: ${language}`,
    timestamp: new Date().toISOString()
  });
}

// Remove a language
function removeLanguage(language) {
  // Remove language
  botState.config.acceptedLanguages = botState.config.acceptedLanguages.filter(lang => lang !== language);
  
  // Update UI
  updateLanguageTags();
  
  // Add log
  addLog({
    type: 'info',
    message: `Removed language: ${language}`,
    timestamp: new Date().toISOString()
  });
}

// Save settings
function saveSettings() {
  // Update config from inputs
  botState.active = botEnabledSwitch.checked;
  botState.config.autoRefresh = autoRefreshSwitch.checked;
  botState.config.hardRefreshInterval = parseInt(refreshIntervalInput.value) * 1000;
  botState.config.minimumDeadlineHours = parseInt(minDeadlineInput.value);
  botState.config.soundEnabled = soundEnabledSwitch.checked;
  botState.config.desktopNotifications = desktopNotificationsSwitch.checked;
  
  // Save to storage
  chrome.storage.local.set({
    uvoBotEnabled: botState.active,
    uvoAcceptedLanguages: botState.config.acceptedLanguages,
    uvoMinimumDeadlineHours: botState.config.minimumDeadlineHours,
    uvoRefreshInterval: botState.config.hardRefreshInterval / 1000,
    uvoSoundEnabled: botState.config.soundEnabled,
    uvoDesktopNotifications: botState.config.desktopNotifications,
    uvoAutoRefresh: botState.config.autoRefresh
  });
  
  // Send message to content script
  sendMessageToActiveTab({
    action: 'updateConfig',
    config: {
      active: botState.active,
      acceptedLanguages: botState.config.acceptedLanguages,
      minimumDeadlineHours: botState.config.minimumDeadlineHours,
      hardRefreshInterval: botState.config.hardRefreshInterval,
      softRefreshInterval: DEFAULT_CONFIG.softRefreshInterval,
      soundEnabled: botState.config.soundEnabled,
      desktopNotifications: botState.config.desktopNotifications,
      autoRefresh: botState.config.autoRefresh
    }
  });
  
  // Update UI
  updateBotStatusUI();
  
  // Add log
  addLog({
    type: 'success',
    message: 'Settings saved successfully',
    timestamp: new Date().toISOString()
  });
}

// Reset settings to default
function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to default?')) {
    // Reset config
    botState.active = DEFAULT_CONFIG.botEnabled;
    botState.config = { ...DEFAULT_CONFIG };
    
    // Update UI
    updateSettingsUI();
    updateBotStatusUI();
    
    // Save to storage
    chrome.storage.local.set({
      uvoBotEnabled: botState.active,
      uvoAcceptedLanguages: botState.config.acceptedLanguages,
      uvoMinimumDeadlineHours: botState.config.minimumDeadlineHours,
      uvoRefreshInterval: botState.config.hardRefreshInterval / 1000,
      uvoSoundEnabled: botState.config.soundEnabled,
      uvoDesktopNotifications: botState.config.desktopNotifications,
      uvoAutoRefresh: botState.config.autoRefresh
    });
    
    // Send message to content script
    sendMessageToActiveTab({
      action: 'updateConfig',
      config: {
        active: botState.active,
        acceptedLanguages: botState.config.acceptedLanguages,
        minimumDeadlineHours: botState.config.minimumDeadlineHours,
        hardRefreshInterval: botState.config.hardRefreshInterval,
        softRefreshInterval: botState.config.softRefreshInterval,
        soundEnabled: botState.config.soundEnabled,
        desktopNotifications: botState.config.desktopNotifications,
        autoRefresh: botState.config.autoRefresh
      }
    });
    
    // Add log
    addLog({
      type: 'warning',
      message: 'All settings reset to default',
      timestamp: new Date().toISOString()
    });
  }
}

// Clear history
function clearHistory() {
  const historyType = historyTypeSelect.value;
  
  if (!confirm(`Are you sure you want to clear all ${historyType} history?`)) {
    return;
  }
  
  switch (historyType) {
    case 'taken':
      botState.orders.taken = [];
      chrome.storage.local.set({ uvoTakenOrders: [] });
      break;
    case 'rejected':
      botState.orders.rejected = [];
      chrome.storage.local.set({ uvoRejectedOrders: [] });
      break;
    case 'available':
      botState.orders.available = [];
      chrome.storage.local.set({ uvoAvailableOrders: [] });
      break;
  }
  
  // Update stats
  updateStats();
  
  // Update UI
  updateStatsUI();
  updateHistoryList();
  
  // Add log
  addLog({
    type: 'warning',
    message: `Cleared ${historyType} history`,
    timestamp: new Date().toISOString()
  });
}

// Clear logs
function clearLogs() {
  if (confirm('Are you sure you want to clear all logs?')) {
    botState.logs = [];
    chrome.storage.local.set({ uvoLogs: [] });
    
    // Update UI
    updateLogsUI();
    
    // Add new log
    addLog({
      type: 'warning',
      message: 'Logs cleared',
      timestamp: new Date().toISOString()
    });
  }
}

// Add a log entry
function addLog(log) {
  // Add timestamp if not provided
  if (!log.timestamp) {
    log.timestamp = new Date().toISOString();
  }
  
  // Add to logs
  botState.logs.unshift(log);
  
  // Keep only the most recent 100 logs
  if (botState.logs.length > 100) {
    botState.logs = botState.logs.slice(0, 100);
  }
  
  // Save to storage
  chrome.storage.local.set({ uvoLogs: botState.logs });
  
  // Update UI
  updateLogsUI();
}

// Refresh current page
function refreshCurrentPage() {
  sendMessageToActiveTab({ action: 'refreshPage' });
  
  // Add log
  addLog({
    type: 'info',
    message: 'Manually refreshed page',
    timestamp: new Date().toISOString()
  });
}

// Check current tab
function checkCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentTab = tabs[0];
    
    if (currentTab && currentTab.url && currentTab.url.includes('uvocorp.com/orders/available.html')) {
      // We're on the UvoCorp available orders page
      // Send message to get current state
      chrome.tabs.sendMessage(currentTab.id, { action: 'getState' }, function(response) {
        if (response && response.state) {
          // Update local state with new data
          updateStateFromContent(response.state);
        }
      });
    }
  });
}

// Update state from content script with improved consistency checking
function updateStateFromContent(state) {
  if (!state) return;
  
  // Update order lists safely
  if (state.rejectedOrders && Array.isArray(state.rejectedOrders)) {
    botState.orders.rejected = state.rejectedOrders;
  }
  
  if (state.takenOrders && Array.isArray(state.takenOrders)) {
    botState.orders.taken = state.takenOrders;
  }
  
  if (state.availableOrders && Array.isArray(state.availableOrders)) {
    botState.orders.available = state.availableOrders;
  }
  
  if (state.allVisitedOrders && Array.isArray(state.allVisitedOrders)) {
    botState.orders.all = state.allVisitedOrders;
  }
  
  // Update active state
  if (state.active !== undefined) {
    botState.active = state.active;
  }
  
  // Ensure consistency between arrays
  ensureOrderConsistency();
  
  // Update stats
  updateStats();
  
  // Update UI
  updateUI();
  
  // Save the updated state to storage
  saveStateToStorage();
}

// Send message to active tab
function sendMessageToActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, message);
    }
  });
}

// Format timestamp
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown';
  
  try {
    const date = new Date(timestamp);
    
    // Check if today
    const today = new Date();
    const isToday = date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();
    
    if (isToday) {
      // Format as time only for today
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      // Format with date and time
      return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  } catch (e) {
    console.error('Error formatting timestamp:', e);
    return 'Invalid date';
  }
}

// Report issue
function reportIssue() {
  window.open('mailto:support@example.com?subject=UvoCorp%20Order%20Bot%20Issue', '_blank');
}

// Show help
function showHelp() {
  chrome.tabs.create({ url: 'help.html' });
}

// Listen for messages from content script or background
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'updateState') {
    // Update state from content script
    updateStateFromContent(request.state);
    
    // Return success
    sendResponse({ success: true });
  } else if (request.action === 'newOrder') {
    // Add log for new order
    addLog({
      type: 'success',
      message: `New order found: #${request.order.id} - ${request.order.language}`,
      timestamp: new Date().toISOString()
    });
    
    // Update state
    loadStateFromStorage();
    
    // Return success
    sendResponse({ success: true });
  } else if (request.action === 'orderTaken') {
    // Add log for taken order
    addLog({
      type: 'success',
      message: `Order taken: #${request.order.id} - $${request.order.price}`,
      timestamp: new Date().toISOString()
    });
    
    // Update state
    loadStateFromStorage();
    
    // Return success
    sendResponse({ success: true });
  } else if (request.action === 'orderRejected') {
    // Add log for rejected order
    addLog({
      type: 'warning',
      message: `Order rejected: #${request.order.id} - ${request.order.reason}`,
      timestamp: new Date().toISOString()
    });
    
    // Update state
    loadStateFromStorage();
    
    // Return success
    sendResponse({ success: true });
  } else if (request.action === 'error') {
    // Add log for error
    addLog({
      type: 'error',
      message: request.message,
      timestamp: new Date().toISOString()
    });
    
    // Return success
    sendResponse({ success: true });
  }
  
  return true; // Keep the message channel open for async response
});