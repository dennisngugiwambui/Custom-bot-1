// UvoCorp Order Bot - Order Detail Handler

// Configuration
let BOT_CONFIG = {
  acceptedLanguages: [
    'java', 'python', 'r', 'r studio', 'spss', 'php', 'tableau', 'tabeleau', 'power bi',
    'adobe', 'html', 'dart', 'flutter', 'react', 'web', 'sql', 'database',
    'golang', 'laravel', 'c#', 'networking', 'cisco', 'packet tracer', 'assembly', 
    'check instructions', 'excel', 'computer science', 'verilog'
  ],
  soundEnabled: true
};

// Detect and handle tracking systems like Microsoft Clarity
function handleTrackingDetection() {
  try {
    // Look for Clarity or other tracking scripts
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const src = script.src || '';
      if (src.includes('clarity.ms') || 
          src.includes('hotjar') || 
          src.includes('mouseflow') || 
          src.includes('fullstory')) {
        console.log("Tracking script detected: " + src);
        applyAntiDetectionMeasures();
        return true;
      }
    }
    
    // Check for global tracking objects
    if (window._clarity || window.ClickTaleContext || window.hj || window.mouseflow) {
      console.log("Tracking object detected in window");
      applyAntiDetectionMeasures();
      return true;
    }
    
    return false;
  } catch (e) {
    console.error("Error in tracking detection:", e);
    return false;
  }
}

// Apply measures to avoid detection while preserving functionality
function applyAntiDetectionMeasures() {
  try {
    console.log("Applying anti-detection measures");
    
    // 1. Intercept clarity if present
    if (window._clarity) {
      console.log("Intercepting Clarity");
      const originalStart = window._clarity.start;
      window._clarity.start = function() {
        console.log("Clarity.start called - modified");
        return originalStart.apply(this, arguments);
      };
    }
    
    // 2. Add entropy to fingerprinting methods without breaking functionality
    try {
      // Canvas fingerprinting prevention (subtle, doesn't break legitimate use)
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function() {
        // Call original function
        const result = originalToDataURL.apply(this, arguments);
        
        // Only modify small canvases likely used for fingerprinting
        if (this.width < 50 && this.height < 50) {
          return result.substring(0, result.length - 8) + 
                 Math.floor(Math.random() * 10) + 
                 result.substring(result.length - 7);
        }
        
        return result;
      };
    } catch (e) {
      console.log("Canvas modification error:", e);
    }
  } catch (e) {
    console.error("Error applying anti-detection measures:", e);
  }
}

// Initialize - Run immediately without waiting for DOMContentLoaded
(function immediateActions() {
  console.log("Order detail handler - immediate initialization");
  
  // Check for tracking first
  handleTrackingDetection();
  
  // Try to click the take order button immediately on script load
  // This ensures the button is clicked as soon as possible
  setTimeout(clickTakeOrderButton, 100);

  // Try again after a slightly longer delay in case page is still loading
  setTimeout(clickTakeOrderButton, 500);

  // Final fallback with longer delay
  setTimeout(clickTakeOrderButton, 1500);
})();

// Also wait for DOMContentLoaded for the regular initialization
document.addEventListener('DOMContentLoaded', () => {
  console.log("Order detail handler - DOM content loaded");
  
  // Monitor for Clarity being added later
  setupClarityMonitoring();

  // Load configuration
  chrome.storage.local.get([
    'uvoAcceptedLanguages',
    'uvoSoundEnabled'
  ], function(result) {
    if (result.uvoAcceptedLanguages) {
      BOT_CONFIG.acceptedLanguages = result.uvoAcceptedLanguages;
    }
    
    if (result.uvoSoundEnabled !== undefined) {
      BOT_CONFIG.soundEnabled = result.uvoSoundEnabled;
    }
    
    // Process the order
    processOrder();
  });
});

// Monitor for Clarity being added later
function setupClarityMonitoring() {
  const clarityObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.tagName === 'SCRIPT' && node.src && 
             (node.src.includes('clarity') || node.src.includes('hotjar'))) {
            console.log("Tracking script dynamically added");
            handleTrackingDetection();
            break;
          }
        }
      }
    }
    
    // Also check for Clarity object
    if (window._clarity && !window._clarityHandled) {
      window._clarityHandled = true;
      handleTrackingDetection();
    }
  });
  
  // Start observing
  clarityObserver.observe(document, {
    childList: true,
    subtree: true
  });
}

// Direct function to find and click the take order button
function clickTakeOrderButton() {
  try {
    console.log("Attempting to find and click take order button");
    
    // Play sound immediately to ensure it works
    playSound("order-taken");
    
    // Log the HTML of the form area to debug
    const bidArea = document.querySelector('.order--bid');
    if (bidArea) {
      console.log("Found bid area:", bidArea.outerHTML);
    }
    
    // Try all possible selectors for the take order button
    // Adding more comprehensive selectors
    const takeOrderButton = 
      document.querySelector('input[value="Take Order"]') ||
      document.querySelector('.button.button--1[value="Take Order"]') ||
      document.querySelector('form.order--bid__top-buttons input[type="submit"]') ||
      document.querySelector('button.take-order-button') ||
      document.querySelector('form[action*="take_order"] input[type="submit"]') ||
      document.querySelector('.button--1[value="Take Order"]') ||
      document.querySelector('.order--bid__top-buttons input') ||
      document.querySelector('form[action*="/take_order"] input') ||
      document.querySelector('input.button.button--1');
    
    if (takeOrderButton) {
      console.log("Take Order button found, clicking it immediately:", takeOrderButton);
      
      // Extract order info for notification and tracking
      const orderInfo = extractOrderInfoQuickly();
      
      // Save to taken orders immediately before clicking
      saveOrderToTaken(orderInfo.id, orderInfo.price, orderInfo);
      
      // Click the button using multiple methods for redundancy
      takeOrderButton.click();
      
      // Also dispatch events for redundancy
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
          console.log("Form submit fallback failed:", e);
        }
      }
      
      // Show notification overlay
      showOverlay("Taking order...", "success");
      
      // Play sound again for redundancy
      setTimeout(() => playSound("order-taken"), 200);
      
      // Close tab after successful click
      setTimeout(() => {
        closeTab();
      }, 2000);
      
      return true;
    } else {
      console.error("Take Order button not found on page");
      
      // Check if this is a bid order instead
      const bidButton = document.querySelector('input[value="Place Bid"]');
      if (bidButton) {
        console.log("This is a bid order, not a take order");
        rejectOrder(null, "This is a bid order, not a take order");
      } else {
        console.log("No Take Order button found");
        rejectOrder(null, "No Take Order button found on page");
      }
      
      return false;
    }
  } catch (error) {
    console.error("Error in clickTakeOrderButton:", error);
    rejectOrder(null, "Error trying to take order: " + error.message);
    return false;
  }
}

// Quick extraction of basic info for immediate button click
function extractOrderInfoQuickly() {
  // Extract just the bare minimum needed for tracking
  const orderIdElement = document.querySelector('.order--header__name-number');
  const priceElement = document.querySelector('.order--header__info-price');
  
  return {
    id: orderIdElement ? orderIdElement.textContent.trim().replace('#', '') : 'Unknown',
    price: priceElement ? priceElement.textContent.trim() : '$0',
    timestamp: new Date().toISOString()
  };
}

// Save this order to taken orders
function saveOrderToTaken(orderId, price, quickInfo = null) {
  try {
    console.log("Saving order to taken orders:", orderId, price);
    
    // First try to extract full order details
    const orderInfo = extractOrderInfo() || {};
    
    // Create a complete order info object
    const completeOrderInfo = {
      id: orderId,
      price: typeof price === 'string' ? parseFloat(price.replace('$', '')) : price,
      language: orderInfo.language || findProgrammingLanguage() || 'Unknown',
      discipline: orderInfo.discipline || findDiscipline() || 'Unknown',
      deadline: orderInfo.deadline || findDeadline() || 'Unknown',
      deadlineText: orderInfo.deadlineText || findDeadlineText() || 'Unknown',
      link: window.location.href,
      status: 'taken',
      timestamp: new Date().toISOString(),
      processedAt: new Date().toISOString()
    };
    
    // Extract instructions for saving
    const instructions = document.getElementById('paperinstraction__text')?.textContent.trim() || '';
    
    // Create and save order details
    const fullOrderDetails = {
      ...completeOrderInfo,
      instructionsText: instructions,
      attachedFiles: extractAttachedFiles(),
      processedAt: new Date().toISOString()
    };
    
    // Save to storage immediately with proper state management
    chrome.storage.local.get(['uvoTakenOrders', 'uvoAvailableOrders', 'uvoAllVisitedOrders'], function(result) {
      let takenOrders = result.uvoTakenOrders || [];
      let availableOrders = result.uvoAvailableOrders || [];
      let allVisitedOrders = result.uvoAllVisitedOrders || [];
      
      // Check if order is already in taken orders to prevent duplicates
      const existingTakenIndex = takenOrders.findIndex(order => order.id === completeOrderInfo.id);
      if (existingTakenIndex === -1) {
        // Add to taken orders only if not already there
        takenOrders.unshift(completeOrderInfo);
      }
      
      // Remove from available orders
      availableOrders = availableOrders.filter(order => order.id !== completeOrderInfo.id);
      
      // Update in all visited orders
      const visitedIndex = allVisitedOrders.findIndex(order => order.id === completeOrderInfo.id);
      if (visitedIndex !== -1) {
        allVisitedOrders[visitedIndex] = {...allVisitedOrders[visitedIndex], status: 'taken'};
      } else {
        // Add to all visited if not already there
        allVisitedOrders.unshift({...completeOrderInfo, status: 'taken'});
      }
      
      // Save ALL arrays back to storage to ensure consistency
      chrome.storage.local.set({
        uvoTakenOrders: takenOrders,
        uvoAvailableOrders: availableOrders,
        uvoAllVisitedOrders: allVisitedOrders
      });
      
      // Save full order details
      chrome.runtime.sendMessage({
        action: "saveOrderDetail",
        orderId: completeOrderInfo.id,
        details: fullOrderDetails
      });
      
      // Notify background script
      chrome.runtime.sendMessage({
        action: 'orderTaken',
        order: completeOrderInfo
      });
      
      console.log("Order saved to taken orders:", completeOrderInfo.id);
    });
  } catch (error) {
    console.error("Error saving order to taken orders:", error);
  }
}

// Alternative ways to find programming language when normal method fails
function findProgrammingLanguage() {
  // Method 1: Try direct selector for programming language field
  try {
    // Best approach: Find all li elements and look for the one with "Programming language" label
    const items = document.querySelectorAll('.order--tabs__content-instraction-table li, .order--tabscontent-instraction-table li');
    for (const item of items) {
      const label = item.querySelector('.order--tabs__content-instraction-table-label, .order--tabscontent-instraction-table-label');
      const value = item.querySelector('.order--tabs__content-instraction-table-value, .order--tabscontent-instraction-table-value');
      
      if (label && value && label.textContent.trim().toLowerCase().includes('programming language')) {
        return value.textContent.trim();
      }
    }
  } catch (e) {
    console.log("Error finding programming language via direct selector:", e);
  }
  
  // Method 2: Check using NLP approach by scanning text content
  try {
    const pageContent = document.body.textContent.toLowerCase();
    for (const language of BOT_CONFIG.acceptedLanguages) {
      if (pageContent.includes(language.toLowerCase())) {
        return language;
      }
    }
  } catch (e) {
    console.log("Error finding programming language via page content:", e);
  }
  
  // Method 3: Try different selector paths
  try {
    const selectors = [
      '.order--tabs__content-instraction-table-value:nth-of-type(6)',
      '.order--tabs__content-discipline + .order--tabs__content-instraction-table-value',
      '.order--tabs__content-instraction-table li:nth-child(3) .order--tabs__content-instraction-table-value'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        return element.textContent.trim();
      }
    }
  } catch (e) {
    console.log("Error finding programming language via alternative selectors:", e);
  }
  
  return null;
}

// Find discipline using multiple methods
function findDiscipline() {
  try {
    // Method 1: Look for discipline in the instruction table
    const items = document.querySelectorAll('.order--tabs__content-instraction-table li, .order--tabscontent-instraction-table li');
    for (const item of items) {
      const label = item.querySelector('.order--tabs__content-instraction-table-label, .order--tabscontent-instraction-table-label');
      const value = item.querySelector('.order--tabs__content-instraction-table-value, .order--tabscontent-instraction-table-value');
      
      if (label && value && label.textContent.trim().toLowerCase().includes('discipline')) {
        return value.textContent.trim();
      }
    }
    
    // Method 2: Try different selectors
    const selectors = [
      '.order--tabs__content-instraction-table-value:nth-of-type(5)',
      '.order--tabs__content-discipline .order--tabs__content-instraction-table-value'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        return element.textContent.trim();
      }
    }
  } catch (e) {
    console.log("Error finding discipline:", e);
  }
  
  return null;
}

// Find deadline in required format (hours/days)
function findDeadline() {
  try {
    // First try to get the deadline text
    const deadlineText = findDeadlineText();
    if (!deadlineText) return null;
    
    // Parse deadline into a human-readable duration format
    const deadlineMatch = /(\d+)d\s*(\d+)h\s*(\d+)m/i.exec(deadlineText);
    if (deadlineMatch) {
      const days = parseInt(deadlineMatch[1]);
      const hours = parseInt(deadlineMatch[2]);
      const minutes = parseInt(deadlineMatch[3]);
      
      // Format as days, hours, minutes
      return `${days}d ${hours}h ${minutes}m`;
    }
    
    // Try different formats
    const hoursMatch = /(\d+)h\s*(\d+)m/i.exec(deadlineText);
    if (hoursMatch) {
      const hours = parseInt(hoursMatch[1]);
      const minutes = parseInt(hoursMatch[2]);
      return `${hours}h ${minutes}m`;
    }
    
    // Look for just numbers
    const greenText = document.querySelector('.order--tabs__content-instraction-table-deadline .green, .order--tabscontent-instraction-table-deadline .green');
    if (greenText) {
      const text = greenText.textContent.trim();
      
      // Parse the green text which contains the deadline timer
      if (text.includes('h')) {
        const hoursMatch = text.match(/\((\d+)\s*h\)/);
        if (hoursMatch) {
          return `${hoursMatch[1]}h`;
        }
      } else if (text.includes('d')) {
        const daysMatch = text.match(/\((\d+)\s*d\)/);
        if (daysMatch) {
          return `${daysMatch[1]}d`;
        }
      }
    }
  } catch (e) {
    console.log("Error finding deadline format:", e);
  }
  
  return null;
}

// Find deadline text
function findDeadlineText() {
  try {
    // Look for deadline in the instruction table
    const deadlineElement = document.querySelector('.order--tabs__content-instraction-table-deadline .order--tabs__content-instraction-table-value strong, .order--tabscontent-instraction-table-deadline .order--tabs__content-instraction-table-value strong');
    
    if (deadlineElement) {
      return deadlineElement.textContent.trim();
    }
    
    // Alternative method - look for items with "deadline" label
    const items = document.querySelectorAll('.order--tabs__content-instraction-table li, .order--tabscontent-instraction-table li');
    for (const item of items) {
      const label = item.querySelector('.order--tabs__content-instraction-table-label, .order--tabscontent-instraction-table-label');
      const value = item.querySelector('.order--tabs__content-instraction-table-value, .order--tabscontent-instraction-table-value');
      
      if (label && value && label.textContent.trim().toLowerCase().includes('deadline')) {
        return value.textContent.trim();
      }
    }
  } catch (e) {
    console.log("Error finding deadline text:", e);
  }
  
  return null;
}

// Process the order
function processOrder() {
  try {
    console.log("Processing order detail");
    
    // Extract order information
    const orderInfo = extractOrderInfo();
    
    if (!orderInfo) {
      console.error("Failed to extract order info");
      return;
    }
    
    console.log("Extracted order info:", orderInfo);
    
    // Save order detail
    saveOrderDetail(orderInfo);
    
    // Check if the language is in our accepted list
    const languageMatch = isAcceptedLanguage(orderInfo.language) || orderInfo.pageContainsLanguage;
    
    if (!languageMatch) {
      // Reject order - language doesn't match
      rejectOrder(orderInfo, `Language not in accepted list: ${orderInfo.language}`);
      return;
    }
    
    // Check if it's a take order or bid order
    if (orderInfo.isBidOrder && !orderInfo.isTakeOrder) {
      // Reject - this is a bid order, not a take order
      rejectOrder(orderInfo, "This is a bid order, not a take order");
      return;
    }
    
    // If we get here, we should take the order
    if (orderInfo.isTakeOrder) {
      takeOrder(orderInfo);
    } else {
      // Neither take nor bid button found - check directly
      clickTakeOrderButton();
    }
  } catch (error) {
    console.error("Error processing order detail:", error);
  }
}

// Extract order information
function extractOrderInfo() {
  try {
    // Extract order ID
    const orderIdElement = document.querySelector('.order--header__name-number');
    if (!orderIdElement) return null;
    
    const id = orderIdElement.textContent.trim().replace('#', '');
    
    // Check if this is a "Take Order" or "Place Bid" page
    // Look for the take order button
    const takeOrderButton = document.querySelector('input[value="Take Order"]') ||
                            document.querySelector('form.order--bid__top-buttons input[type="submit"]') ||
                            document.querySelector('form[action*="take_order"] input');
    
    const isTakeOrder = takeOrderButton !== null;
    
    // If bid button exists, this is a bid order
    const bidButton = document.querySelector('input[value="Place Bid"]');
    const isBidOrder = bidButton !== null;
    
    // Extract programming language explicitly
    const language = findProgrammingLanguage() || '';
    
    // Check if page contains any accepted language keywords
    const pageContainsLanguage = pageContainsAcceptedLanguage();
    console.log(`Page contains accepted language: ${pageContainsLanguage}`);
    
    // Extract deadline text and formatted deadline
    const deadlineText = findDeadlineText() || '';
    const deadline = findDeadline() || deadlineText;
    
    // Try to extract hours from the green text
    let deadlineHours = 0;
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
    const discipline = findDiscipline() || '';
    
    console.log(`Extracted Order Info - ID: ${id}, Language: ${language || 'Not specified'}, Deadline: ${deadline}, Hours: ${deadlineHours}h, Discipline: ${discipline}, Is Take Order: ${isTakeOrder}, Is Bid Order: ${isBidOrder}`);
    
    return {
      id,
      language,
      deadline,
      deadlineText,
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
    console.error("Error extracting order info:", error);
    return null;
  }
}

// Check if a language is accepted
function isAcceptedLanguage(language) {
  if (!language) return false;

  // Convert to lowercase for case-insensitive comparison
  const lowerCaseLanguage = language.toLowerCase();

  // Check if any of our accepted languages is a substring of the provided language
  return BOT_CONFIG.acceptedLanguages.some(acceptedLang => 
    lowerCaseLanguage.includes(acceptedLang.toLowerCase())
  );
}

// Check if the page contains any accepted language
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

// Take an order
function takeOrder(orderInfo) {
  try {
    console.log("Taking order");
    
    // Find the Take Order button - try multiple selectors
    const takeOrderButton = 
      document.querySelector('input[value="Take Order"]') || 
      document.querySelector('.button.button--1[value="Take Order"]') ||
      document.querySelector('form.order--bid__top-buttons input[type="submit"]') ||
      document.querySelector('button.take-order-button') ||
      document.querySelector('form[action*="take_order"] input[type="submit"]');
    
    if (takeOrderButton) {
      console.log("Take Order button found, clicking it");
      
      // Display an overlay to show the user that we're taking the order
      showOverlay("Taking order...", "success");
      
      // Add to taken orders
      const takenOrder = {
        ...orderInfo,
        status: 'taken',
        processedAt: new Date().toISOString()
      };
      
      // Update storage with proper state management
      chrome.storage.local.get(['uvoTakenOrders', 'uvoAvailableOrders', 'uvoAllVisitedOrders'], function(result) {
        const takenOrders = result.uvoTakenOrders || [];
        const availableOrders = result.uvoAvailableOrders || [];
        const allVisitedOrders = result.uvoAllVisitedOrders || [];
        
        // Check if order is already in taken orders to prevent duplicates
        const existingTakenIndex = takenOrders.findIndex(order => order.id === orderInfo.id);
        if (existingTakenIndex === -1) {
          // Add to taken orders only if not already there
          takenOrders.unshift(takenOrder);
        }
        
        // Remove from available orders
        const filteredAvailableOrders = availableOrders.filter(order => order.id !== orderInfo.id);
        
        // Update in all visited orders
        const visitedIndex = allVisitedOrders.findIndex(order => order.id === orderInfo.id);
        if (visitedIndex !== -1) {
          allVisitedOrders[visitedIndex] = {...allVisitedOrders[visitedIndex], status: 'taken'};
        } else {
          // Add to all visited if not already there
          allVisitedOrders.unshift({...takenOrder});
        }
        
        // Save ALL arrays back to storage to ensure consistency
        chrome.storage.local.set({
          uvoTakenOrders: takenOrders,
          uvoAvailableOrders: filteredAvailableOrders,
          uvoAllVisitedOrders: allVisitedOrders
        });
        
        // Play sound
        playSound("order-taken");
        
        // Notify background
        chrome.runtime.sendMessage({
          action: 'orderTaken',
          order: takenOrder
        });
        
        // Click the button immediately for speed
        takeOrderButton.click();
        
        // Also try submitting the form directly as fallback
        const form = takeOrderButton.closest('form');
        if (form) {
          try {
            form.submit();
          } catch (e) {
            console.log("Form submit failed:", e);
          }
        }
        
        // Close the tab after a delay
        setTimeout(() => {
          closeTab();
        }, 2000);
      });
    } else {
      console.error("Take Order button not found");
      rejectOrder(orderInfo, "Take Order button not found");
    }
  } catch (error) {
    console.error("Error taking order:", error);
    rejectOrder(orderInfo, "Error taking order: " + error.message);
  }
}

// Reject an order
function rejectOrder(orderInfo, reason) {
  console.log(`Rejecting order: ${reason}`);

  try {
    // Create rejected order object - use basic page info if orderInfo not provided
    let rejectedOrder;
    
    if (!orderInfo) {
      // Extract basic information for rejection
      const orderIdElement = document.querySelector('.order--header__name-number');
      const priceElement = document.querySelector('.order--header__info-price');
      const language = findProgrammingLanguage();
      
      rejectedOrder = {
        id: orderIdElement ? orderIdElement.textContent.trim().replace('#', '') : 'Unknown',
        price: priceElement ? parseFloat(priceElement.textContent.trim().replace('$', '')) : 0,
        language: language || 'Unknown',
        deadline: findDeadline() || 'Unknown',
        discipline: findDiscipline() || 'Unknown',
        link: window.location.href,
        status: 'rejected',
        reason: reason,
        processedAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      };
    } else {
      rejectedOrder = {
        ...orderInfo,
        status: 'rejected',
        reason: reason,
        processedAt: new Date().toISOString()
      };
    }

    // Update storage with proper state management
    chrome.storage.local.get(['uvoRejectedOrders', 'uvoAvailableOrders', 'uvoAllVisitedOrders'], function(result) {
      const rejectedOrders = result.uvoRejectedOrders || [];
      const availableOrders = result.uvoAvailableOrders || [];
      const allVisitedOrders = result.uvoAllVisitedOrders || [];
      
      // Check if order is already in rejected orders to prevent duplicates
      const existingRejectedIndex = rejectedOrders.findIndex(order => order.id === rejectedOrder.id);
      if (existingRejectedIndex === -1) {
        // Add to rejected orders only if not already there
        rejectedOrders.unshift(rejectedOrder);
      }
      
      // Remove from available orders if exists
      const filteredAvailableOrders = availableOrders.filter(order => 
        order.id !== rejectedOrder.id
      );
      
      // Update in all visited orders
      const visitedIndex = allVisitedOrders.findIndex(order => order.id === rejectedOrder.id);
      if (visitedIndex !== -1) {
        allVisitedOrders[visitedIndex] = {...allVisitedOrders[visitedIndex], status: 'rejected', reason};
      } else {
        // Add to all visited if not already there
        allVisitedOrders.unshift({...rejectedOrder});
      }
      
      // Save ALL arrays back to storage
      chrome.storage.local.set({
        uvoRejectedOrders: rejectedOrders,
        uvoAvailableOrders: filteredAvailableOrders,
        uvoAllVisitedOrders: allVisitedOrders
      });
      
      // Show notification
      showNotification("Order Rejected", reason, "error");
      
      // Play sound
      playSound("rejected-order");
      
      // Notify background
      chrome.runtime.sendMessage({
        action: 'orderRejected',
        order: rejectedOrder
      });
      
      // Close tab after delay
      setTimeout(() => {
        closeTab();
      }, 1500);
    });
  } catch (error) {
    console.error("Error in rejectOrder:", error);
    
    // Try to close tab anyway
    setTimeout(() => {
      closeTab();
    }, 1500);
  }
}

// Save order details
function saveOrderDetail(orderInfo) {
  try {
    // Extract additional details
    const instructionsText = extractOrderInstructions();
    const attachedFiles = extractAttachedFiles();
    
    // Create full details object
    const fullOrderDetails = {
      ...orderInfo,
      instructionsText,
      attachedFiles,
      orderId: orderInfo.id,
      processedAt: new Date().toISOString()
    };
    
    // Send to background script for storage
    chrome.runtime.sendMessage({
      action: "saveOrderDetail",
      orderId: orderInfo.id,
      details: fullOrderDetails
    });
    
    return fullOrderDetails;
  } catch (error) {
    console.error("Error saving order details:", error);
    return null;
  }
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

// Show notification on the page
function showNotification(title, message, type = 'info') {
  // Check if notification container exists
  let notification = document.querySelector('.uvo-notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.className = `uvo-notification ${type}`;
    document.body.appendChild(notification);
  } else {
    notification.className = `uvo-notification ${type}`;
  }

  // Set content
  notification.innerHTML = `
    <div class="uvo-notification-icon">
      ${getIconForType(type)}
    </div>
    <div class="uvo-notification-content">
      <div class="uvo-notification-title">${title}</div>
      <div class="uvo-notification-message">${message}</div>
    </div>
    <button class="uvo-notification-close">×</button>
  `;

  // Add close button functionality
  const closeButton = notification.querySelector('.uvo-notification-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      notification.classList.add('uvo-closing');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    });
  }

  // Auto close after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.add('uvo-closing');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }, 5000);
}

// Show overlay when taking order
function showOverlay(message, type = 'info') {
  // Create overlay if it doesn't exist
  let overlay = document.querySelector('.uvo-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'uvo-overlay';
    document.body.appendChild(overlay);
  }

  // Set content
  overlay.innerHTML = `
    <div class="uvo-overlay-content">
      <div class="uvo-overlay-icon">${getIconForType(type)}</div>
      <div class="uvo-overlay-message">${message}</div>
      <div class="uvo-overlay-spinner"></div>
    </div>
  `;
}

// Get icon for notification type
function getIconForType(type) {
  switch (type) {
    case 'success':
      return `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    case 'error':
      return `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    case 'warning':
      return `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    default:
      return `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }
}

// Play a sound
function playSound(soundName) {
  if (!BOT_CONFIG.soundEnabled) return;

  console.log(`Playing sound: ${soundName}`);

  // Both play locally and send message to background for redundancy
  try {
    // First try to create and play audio directly
    const audio = new Audio(chrome.runtime.getURL(`sounds/${soundName}.mp3`));
    audio.volume = 1.0;
    
    // Try to play immediately
    audio.play().then(() => {
      console.log(`Sound ${soundName} played successfully directly`);
    }).catch(err => {
      console.log(`Direct audio play failed: ${err}, trying background script`);
      
      // If direct play fails, try via background script
      chrome.runtime.sendMessage({
        action: "playSound",
        sound: soundName
      });
    });
  } catch (e) {
    console.log(`Error creating audio: ${e}, trying background script`);
    
    // Send message to background script to play sound
    chrome.runtime.sendMessage({
      action: "playSound",
      sound: soundName
    });
  }
}

// Close the current tab
function closeTab() {
  console.log("Closing tab");

  // Send message to background script to close the tab
  chrome.runtime.sendMessage({
    action: "closeCurrentTab"
  });
}

// This script adds anti-detection styles to the page to make the bot look more human
function injectAntiDetectionStyles() {
  // Create styles
  const styles = document.createElement('style');
  styles.textContent = `
    .uvo-notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: rgba(67, 97, 238, 0.95);
      color: white;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      z-index: 10000;
      display: flex;
      align-items: center;
      max-width: 350px;
      animation: uvo-slide-in 0.4s cubic-bezier(0.17, 0.67, 0.32, 1.32) forwards;
      transform-origin: bottom right;
    }
    
    .uvo-notification.success {
      background-color: #10b981;
    }
    
    .uvo-notification.error {
      background-color: #ef4444;
    }
    
    .uvo-notification.warning {
      background-color: #f59e0b;
    }
    
    .uvo-notification-icon {
      margin-right: 12px;
      font-size: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .uvo-notification-content {
      flex: 1;
    }
    
    .uvo-notification-title {
      font-weight: bold;
      margin-bottom: 4px;
      font-size: 16px;
    }
    
    .uvo-notification-message {
      font-size: 14px;
      opacity: 0.95;
    }
    
    .uvo-notification-close {
      background: none;
      border: none;
      color: white;
      opacity: 0.7;
      cursor: pointer;
      font-size: 18px;
      padding: 8px;
      margin-left: 8px;
      transition: all 0.2s;
      border-radius: 50%;
    }
    
    .uvo-notification-close:hover {
      opacity: 1;
      background-color: rgba(255, 255, 255, 0.1);
    }
    
    @keyframes uvo-slide-in {
      0% { transform: translateX(120%) scale(0.8); opacity: 0; }
      80% { transform: translateX(-5%) scale(1.05); opacity: 1; }
      100% { transform: translateX(0) scale(1); opacity: 1; }
    }
    
    @keyframes uvo-slide-out {
      0% { transform: translateX(0) scale(1); opacity: 1; }
      100% { transform: translateX(120%) scale(0.8); opacity: 0; }
    }
    
    @keyframes uvo-pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    
    .uvo-notification.uvo-closing {
      animation: uvo-slide-out 0.3s ease-in forwards;
    }
    
    /* Overlay styles */
    .uvo-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      backdrop-filter: blur(2px);
      animation: uvo-fade-in 0.3s forwards;
    }
    
    .uvo-overlay-content {
      background-color: white;
      padding: 25px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
      text-align: center;
      max-width: 80%;
      animation: uvo-scale-in 0.3s forwards;
    }
    
    @keyframes uvo-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes uvo-scale-in {
      from { transform: scale(0.8); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    
    .uvo-overlay-icon {
      font-size: 50px;
      color: #4f46e5;
      margin-bottom: 20px;
    }
    
    .uvo-overlay-message {
      font-size: 18px;
      margin-bottom: 15px;
      color: #1f2937;
    }
    
    .uvo-overlay-spinner {
      display: inline-block;
      width: 32px;
      height: 32px;
      border: 3px solid rgba(79, 70, 229, 0.3);
      border-radius: 50%;
      border-top-color: #4f46e5;
      animation: uvo-spin 1s linear infinite;
      margin: 16px 0;
    }
    
    @keyframes uvo-spin {
      to { transform: rotate(360deg); }
    }
  `;
  
  // Add to page
  document.head.appendChild(styles);
}

// On load, inject the anti-detection styles
injectAntiDetectionStyles();
