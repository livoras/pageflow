// Browser List Detector
// Detects potential lists of similar elements in the DOM

export const browserListDetectorScript = `
(function() {
  window.detectLists = function(rootSelector) {
    const root = typeof rootSelector === 'string' 
      ? document.querySelector(rootSelector) 
      : rootSelector || document.body;
      
    if (!root) return [];
    
    const lists = [];
    const minChildren = 3; // Minimum number of children to consider as a list
    
    // Find all potential container elements
    const containers = root.querySelectorAll('ul, ol, div, section, article, nav, tbody, .list, [role="list"]');
    
    containers.forEach(container => {
      // Get direct children, filtering out text nodes and scripts
      const children = Array.from(container.children).filter(child => {
        const tag = child.tagName.toLowerCase();
        return tag !== 'script' && tag !== 'style' && tag !== 'template';
      });
      
      if (children.length < minChildren) return;
      
      // Group children by tag name
      const tagGroups = new Map();
      children.forEach(child => {
        const tag = child.tagName.toLowerCase();
        if (!tagGroups.has(tag)) {
          tagGroups.set(tag, []);
        }
        tagGroups.get(tag).push(child);
      });
      
      // Check if there's a dominant tag type (more than 50% of children)
      for (const [tag, elements] of tagGroups.entries()) {
        if (elements.length >= minChildren && elements.length >= children.length * 0.5) {
          lists.push({
            container: container,
            elements: elements,
            type: tag
          });
        }
      }
    });
    
    // Also check for any element with many children of the same type
    const allElements = root.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      if (containers.length > 0 && Array.from(containers).includes(el)) continue;
      
      const children = Array.from(el.children).filter(child => {
        const tag = child.tagName.toLowerCase();
        return tag !== 'script' && tag !== 'style' && tag !== 'template';
      });
      
      if (children.length >= minChildren) {
        // Check if children are mostly the same type
        const tagCounts = {};
        children.forEach(child => {
          const tag = child.tagName.toLowerCase();
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
        
        const entries = Object.entries(tagCounts);
        const sorted = entries.sort(function(a, b) { return b[1] - a[1]; });
        const maxTag = sorted[0];
        if (maxTag && maxTag[1] >= minChildren && maxTag[1] >= children.length * 0.5) {
          lists.push({
            container: el,
            elements: children.filter(c => c.tagName.toLowerCase() === maxTag[0]),
            type: maxTag[0]
          });
        }
      }
    }
    
    return lists;
  };
})();
`;