// Browser DOM Highlighter
// Independent element highlighting tool

export const browserDOMHighlighterScript = `
(function() {
  // Only initialize if not already done
  if (window._highlighterInitialized) {
    console.log('[Highlighter] Already initialized, skipping');
    return;
  }
  
  // Store all highlighted elements for management
  window._highlights = new Map();
  
  // Highlight a single element by XPath
  window.highlight = function(xpath, color, label) {
    try {
      // Find element by xpath
      const element = document.evaluate(
        xpath, 
        document, 
        null, 
        XPathResult.FIRST_ORDERED_NODE_TYPE, 
        null
      ).singleNodeValue;
      
      if (!element) {
        console.warn('[Highlighter] Element not found for xpath:', xpath);
        return null;
      }
      
      // Store original styles
      const originalStyles = {
        backgroundColor: element.style.backgroundColor,
        border: element.style.border,
        position: element.style.position,
        overflow: element.style.overflow
      };
      
      // Apply highlight styles
      element.style.backgroundColor = color || 'rgba(255, 255, 0, 0.3)';
      element.style.border = \`2px solid \${color ? color.replace(/[\\d.]+\\)/, '0.8)') : 'rgba(255, 255, 0, 0.8)'}\`;
      
      // Ensure element is positioned for label placement
      const computedPosition = window.getComputedStyle(element).position;
      if (computedPosition === 'static') {
        element.style.position = 'relative';
      }
      element.style.overflow = 'visible';
      
      // Create and attach label if provided
      let labelElement = null;
      if (label) {
        // Get element position relative to viewport
        const rect = element.getBoundingClientRect();
        
        labelElement = document.createElement('div');
        // Use a unique ID instead of class
        const labelId = 'highlight-label-' + Math.random().toString(36).substr(2, 9);
        labelElement.id = labelId;
        labelElement.style.cssText = \`
          position: fixed;
          top: \${rect.top + 4}px;
          left: \${rect.left + 4}px;
          background: \${color ? color.replace(/[\\d.]+\\)/, '0.9)') : 'rgba(255, 255, 0, 0.9)'};
          color: white;
          padding: 4px 8px;
          font-size: 12px;
          font-weight: bold;
          border-radius: 3px;
          z-index: 2147483647;
          white-space: pre-wrap;
          max-width: 300px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          pointer-events: none;
          line-height: 1.4;
        \`;
        labelElement.textContent = label;
        
        // Append to body instead of element
        document.body.appendChild(labelElement);
        
        // Update position on scroll
        const updatePosition = () => {
          const newRect = element.getBoundingClientRect();
          labelElement.style.top = \`\${newRect.top + 4}px\`;
          labelElement.style.left = \`\${newRect.left + 4}px\`;
        };
        
        // Store the update function so we can remove it later
        labelElement._updatePosition = updatePosition;
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
      }
      
      // Store highlight information
      window._highlights.set(xpath, {
        element: element,
        originalStyles: originalStyles,
        labelElement: labelElement,
        color: color
      });
      
      console.log('[Highlighter] Highlighted element at:', xpath);
      return element;
    } catch (error) {
      console.error('[Highlighter] Error highlighting element:', error);
      return null;
    }
  };
  
  // Remove highlight from a single element
  window.unhighlight = function(xpath) {
    const highlight = window._highlights.get(xpath);
    if (!highlight) {
      console.warn('[Highlighter] No highlight found for xpath:', xpath);
      return false;
    }
    
    // Restore original styles
    const { element, originalStyles, labelElement } = highlight;
    // Remove the inline styles we added
    if (originalStyles.backgroundColor === '') {
      element.style.removeProperty('background-color');
    } else {
      element.style.backgroundColor = originalStyles.backgroundColor;
    }
    if (originalStyles.border === '') {
      element.style.removeProperty('border');
    } else {
      element.style.border = originalStyles.border;
    }
    if (originalStyles.position === '') {
      element.style.removeProperty('position');
    } else {
      element.style.position = originalStyles.position;
    }
    if (originalStyles.overflow === '') {
      element.style.removeProperty('overflow');
    } else {
      element.style.overflow = originalStyles.overflow;
    }
    
    // Remove label if it exists
    if (labelElement) {
      console.log('[Highlighter] Removing label for xpath:', xpath);
      // Remove event listeners
      if (labelElement._updatePosition) {
        window.removeEventListener('scroll', labelElement._updatePosition, true);
        window.removeEventListener('resize', labelElement._updatePosition);
      }
      // Remove from DOM
      if (labelElement.parentNode) {
        labelElement.remove();
        console.log('[Highlighter] Label removed from DOM');
      } else {
        console.warn('[Highlighter] Label has no parentNode');
      }
    }
    
    // Remove from storage
    window._highlights.delete(xpath);
    console.log('[Highlighter] Removed highlight from:', xpath);
    return true;
  };
  
  // Clear all highlights
  window.clearAllHighlights = function() {
    const count = window._highlights.size;
    console.log('[Highlighter] Starting to clear', count, 'highlights');
    console.log('[Highlighter] Current highlights Map:', window._highlights);
    
    // Debug: Check if we have any highlighted elements with our styles
    const highlightedElements = document.querySelectorAll('[style*="rgba(0, 255, 0"]');
    console.log('[Highlighter] Found', highlightedElements.length, 'elements with green background');
    highlightedElements.forEach((elem, index) => {
      console.log('[Highlighter] Element', index, 'styles:', elem.style.cssText);
    });
    
    // Create a copy of xpaths to avoid modifying map during iteration
    const xpaths = Array.from(window._highlights.keys());
    console.log('[Highlighter] XPaths to clear:', xpaths);
    let cleared = 0;
    xpaths.forEach(xpath => {
      const result = window.unhighlight(xpath);
      if (result) cleared++;
    });
    
    // Also remove any orphaned labels that might exist
    const orphanedLabels = document.querySelectorAll('[id^="highlight-label-"]');
    orphanedLabels.forEach(label => {
      console.log('[Highlighter] Removing orphaned label:', label.id);
      label.remove();
    });
    
    // Force clear any remaining highlighted elements
    if (highlightedElements.length > 0 && count === 0) {
      console.log('[Highlighter] WARNING: Found highlighted elements but Map is empty!');
      highlightedElements.forEach(elem => {
        console.log('[Highlighter] Force clearing element styles');
        elem.style.removeProperty('background-color');
        elem.style.removeProperty('border');
        elem.style.removeProperty('position');
        elem.style.removeProperty('overflow');
      });
    }
    
    console.log('[Highlighter] Cleared', cleared, 'of', count, 'highlights');
    console.log('[Highlighter] Removed', orphanedLabels.length, 'orphaned labels');
    console.log('[Highlighter] Remaining highlights:', window._highlights.size);
    return cleared;
  };
  
  // Get all current highlights
  window.getHighlights = function() {
    const highlights = [];
    window._highlights.forEach((highlight, xpath) => {
      highlights.push({
        xpath: xpath,
        color: highlight.color,
        hasLabel: !!highlight.labelElement
      });
    });
    return highlights;
  };
  
  // Highlight multiple elements at once
  window.highlightMultiple = function(items) {
    const results = [];
    items.forEach(item => {
      const element = window.highlight(item.xpath, item.color, item.label);
      results.push({
        xpath: item.xpath,
        success: element !== null
      });
    });
    return results;
  };
  
  // Mark as initialized
  window._highlighterInitialized = true;
  console.log('[Highlighter] DOM Highlighter initialized');
})();
`;