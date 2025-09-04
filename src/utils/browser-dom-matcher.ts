/**
 * Browser-compatible DOM Pattern Matcher
 * This version works directly with DOM elements in the browser context
 */

export const browserDOMMatcherScript = `
(function() {
  // Color palette for highlighting different sequences
  const COLOR_PALETTE = [
    'rgba(255, 0, 0, 0.3)',    // Red
    'rgba(0, 255, 0, 0.3)',    // Green
    'rgba(0, 0, 255, 0.3)',    // Blue
    'rgba(255, 165, 0, 0.3)',  // Orange
    'rgba(128, 0, 128, 0.3)',  // Purple
    'rgba(255, 192, 203, 0.3)',// Pink
    'rgba(0, 255, 255, 0.3)',  // Cyan
    'rgba(255, 255, 0, 0.3)',  // Yellow
    'rgba(165, 42, 42, 0.3)',  // Brown
    'rgba(0, 128, 0, 0.3)'     // Dark Green
  ];

  class BrowserDOMPatternMatcher {
    constructor(threshold = 0.7) {
      this.threshold = threshold;
      this.highlightedElements = new Map();
      this.sequenceInfo = [];
    }

    // Extract feature vector from DOM element
    extractFeatureVector(element) {
      const features = new Map();
      
      const collectFeatures = (el, parent = null) => {
        // Get element type
        const type = el.tagName ? el.tagName.toLowerCase() : 'text';
        
        // Skip script and style elements
        if (type === 'script' || type === 'style') return;
        
        // Build context fingerprint
        const parentType = parent ? parent.tagName.toLowerCase() : 'root';
        const childTypes = Array.from(el.children || [])
          .map(c => c.tagName.toLowerCase())
          .sort();
        const siblingTypes = parent ? 
          Array.from(parent.children)
            .filter(c => c !== el)
            .map(c => c.tagName.toLowerCase())
            .slice(0, 2) : [];
        
        const featureKey = type + '|P:' + parentType + 
          '|C:[' + childTypes.join(',') + ']' +
          '|S:[' + siblingTypes.join(',') + ']';
        
        features.set(featureKey, (features.get(featureKey) || 0) + 1);
        
        // Recurse for children
        if (el.children) {
          Array.from(el.children).forEach(child => collectFeatures(child, el));
        }
      };
      
      collectFeatures(element);
      return features;
    }

    // Calculate structural similarity between two feature vectors
    calculateStructuralSimilarity(featuresA, featuresB) {
      const allKeys = new Set([...featuresA.keys(), ...featuresB.keys()]);
      if (allKeys.size === 0) return 1;
      
      let sameCount = 0;
      for (const key of allKeys) {
        const countA = featuresA.get(key) || 0;
        const countB = featuresB.get(key) || 0;
        if (countA === countB) {
          sameCount++;
        }
      }
      
      return sameCount / allKeys.size;
    }

    // Extract interaction element stats
    extractInteractionStats(element) {
      const stats = new Map();
      
      const collect = (el) => {
        const tagName = el.tagName ? el.tagName.toLowerCase() : '';
        if (tagName === 'a' || tagName === 'button') {
          stats.set(tagName === 'a' ? 'link' : 'button', (stats.get(tagName === 'a' ? 'link' : 'button') || 0) + 1);
        }
        
        if (el.children) {
          Array.from(el.children).forEach(child => collect(child));
        }
      };
      
      collect(element);
      return stats;
    }

    // Extract interaction element texts
    extractInteractionTexts(element) {
      const texts = new Set();
      
      const collect = (el) => {
        const tagName = el.tagName ? el.tagName.toLowerCase() : '';
        if ((tagName === 'a' || tagName === 'button') && el.textContent) {
          texts.add(el.textContent.trim());
        }
        
        if (el.children) {
          Array.from(el.children).forEach(child => collect(child));
        }
      };
      
      collect(element);
      return texts;
    }

    // Calculate interaction type consistency (25% weight)
    calculateInteractionTypeConsistency(elementA, elementB) {
      const statsA = this.extractInteractionStats(elementA);
      const statsB = this.extractInteractionStats(elementB);
      
      if (statsA.size === 0 && statsB.size === 0) return 1;
      if (statsA.size === 0 || statsB.size === 0) return 0;
      
      const allTypes = new Set([...statsA.keys(), ...statsB.keys()]);
      let matchCount = 0;
      
      for (const type of allTypes) {
        const countA = statsA.get(type) || 0;
        const countB = statsB.get(type) || 0;
        if (countA === countB) {
          matchCount++;
        }
      }
      
      return matchCount / allTypes.size;
    }

    // Calculate text match bonus (25% weight)
    calculateTextMatchBonus(elementA, elementB) {
      const textsA = this.extractInteractionTexts(elementA);
      const textsB = this.extractInteractionTexts(elementB);
      
      if (textsA.size === 0 || textsB.size === 0) return 0;
      
      for (const text of textsA) {
        if (textsB.has(text)) {
          return 1;
        }
      }
      
      return 0;
    }

    // Calculate three-layer weighted similarity
    calculateSimilarity(vectorA, vectorB, elementA, elementB) {
      const structuralSim = this.calculateStructuralSimilarity(vectorA, vectorB);
      
      if (elementA && elementB) {
        const typeConsistency = this.calculateInteractionTypeConsistency(elementA, elementB);
        const textBonus = this.calculateTextMatchBonus(elementA, elementB);
        
        // 50% structure + 25% interaction type consistency + 25% text match bonus
        return structuralSim * 0.5 + typeConsistency * 0.25 + textBonus * 0.25;
      }
      
      return structuralSim;
    }

    // Find all similar sequences in a list of elements
    findSimilarSequences(elements) {
      const sequences = [];
      const processed = new Set();
      
      // Group by tag name
      const typeGroups = new Map();
      elements.forEach((el, idx) => {
        const type = el.tagName.toLowerCase();
        if (!typeGroups.has(type)) {
          typeGroups.set(type, []);
        }
        typeGroups.get(type).push({ element: el, index: idx });
      });
      
      // Process each type group
      for (const [type, group] of typeGroups.entries()) {
        if (group.length < 3) continue;
        
        let i = 0;
        while (i < group.length) {
          if (processed.has(group[i].index)) {
            i++;
            continue;
          }
          
          const baseFeatures = this.extractFeatureVector(group[i].element);
          const sequence = [{ ...group[i], similarity: 1.0, prevSimilarity: 1.0 }]; // Base element has 100% similarity
          
          for (let j = i + 1; j < group.length; j++) {
            if (processed.has(group[j].index)) continue;
            
            const features = this.extractFeatureVector(group[j].element);
            const baseSimilarity = this.calculateSimilarity(baseFeatures, features, group[i].element, group[j].element);
            
            if (baseSimilarity >= this.threshold) {
              // Calculate similarity with previous element in sequence
              const prevElement = sequence[sequence.length - 1].element;
              const prevFeatures = this.extractFeatureVector(prevElement);
              const prevSimilarity = this.calculateSimilarity(prevFeatures, features, prevElement, group[j].element);
              
              sequence.push({ ...group[j], similarity: baseSimilarity, prevSimilarity });
            }
          }
          
          if (sequence.length >= 3) {
            sequences.push({
              type,
              elements: sequence.map(s => s.element),
              indices: sequence.map(s => s.index),
              similarities: sequence.map(s => s.similarity),
              prevSimilarities: sequence.map(s => s.prevSimilarity),
              count: sequence.length
            });
            
            sequence.forEach(s => processed.add(s.index));
          }
          
          i++;
        }
      }
      
      return sequences;
    }

    // Highlight elements in a sequence
    highlightSequence(sequence, sequenceIndex) {
      const color = COLOR_PALETTE[sequenceIndex % COLOR_PALETTE.length];
      
      sequence.elements.forEach((element, idx) => {
        // Store original styles
        const originalBackground = element.style.backgroundColor;
        const originalBorder = element.style.border;
        const originalPosition = element.style.position;
        const originalZIndex = element.style.zIndex;
        const originalOverflow = element.style.overflow;
        
        this.highlightedElements.set(element, {
          originalBackground,
          originalBorder,
          originalPosition,
          originalZIndex,
          originalOverflow
        });
        
        // Apply highlight - box style
        element.style.backgroundColor = color;
        element.style.border = '1px solid ' + color.replace('0.3', '0.8');
        element.style.position = 'relative';
        element.style.overflow = 'visible';
        
        // Get parent index
        const parentIndex = element.parentElement ? 
          Array.from(element.parentElement.children).indexOf(element) : -1;
        
        // Calculate similarity with previous sibling in parent container
        let simPercent = 100; // Default for first element
        if (element.parentElement && parentIndex > 0) {
          const prevSibling = element.parentElement.children[parentIndex - 1];
          if (prevSibling) {
            const currentFeatures = this.extractFeatureVector(element);
            const prevFeatures = this.extractFeatureVector(prevSibling);
            const siblingSimiliarity = this.calculateSimilarity(currentFeatures, prevFeatures, element, prevSibling);
            simPercent = Math.round(siblingSimiliarity * 100);
          }
        }
        
        // Add label with multiple lines
        const label = document.createElement('div');
        label.className = 'sequence-label';
        label.innerHTML = sequenceIndex + '-' + idx + '<br>' +
                         'idx: ' + parentIndex + '<br>' +
                         'sim: ' + simPercent + '%';
        label.style.cssText = 'position: absolute; top: 2px; left: 2px; background: ' + color.replace('0.3', '0.9') + '; color: white; padding: 4px 6px; font-size: 11px; font-weight: bold; border-radius: 3px; z-index: 10000; font-family: monospace; box-shadow: 0 1px 3px rgba(0,0,0,0.3); line-height: 1.2; white-space: nowrap;';
        element.appendChild(label);
        
        // Add data attributes
        element.setAttribute('data-sequence-index', sequenceIndex);
        element.setAttribute('data-sequence-position', idx);
        element.setAttribute('data-sequence-type', sequence.type);
        element.setAttribute('data-sequence-count', sequence.count);
        element.setAttribute('data-parent-index', parentIndex);
        element.setAttribute('data-similarity', simPercent);
        
        // Hover listeners removed - labels are always visible
      });
      
      this.sequenceInfo.push({
        sequenceIndex,
        color,
        type: sequence.type,
        count: sequence.count,
        elements: sequence.elements,
        similarities: sequence.similarities,
        prevSimilarities: sequence.prevSimilarities
      });
    }

    // Clear all highlights
    clearHighlights() {
      this.highlightedElements.forEach((original, element) => {
        element.style.backgroundColor = original.originalBackground || '';
        element.style.border = original.originalBorder || '';
        if (original.originalPosition) {
          element.style.position = original.originalPosition;
        } else {
          element.style.position = '';
        }
        if (original.originalZIndex) {
          element.style.zIndex = original.originalZIndex;
        } else {
          element.style.zIndex = '';
        }
        if (original.originalOverflow) {
          element.style.overflow = original.originalOverflow;
        } else {
          element.style.overflow = '';
        }
        
        // Remove labels
        const labels = element.querySelectorAll('.sequence-label');
        labels.forEach(label => label.remove());
        
        // Remove data attributes
        element.removeAttribute('data-sequence-index');
        element.removeAttribute('data-sequence-position');
        element.removeAttribute('data-sequence-type');
        element.removeAttribute('data-sequence-count');
        element.removeAttribute('data-parent-index');
        element.removeAttribute('data-similarity');
        
        // Listeners already removed
      });
      
      // Tooltip functionality removed
      
      this.highlightedElements.clear();
      this.sequenceInfo = [];
    }

    // Main function to find and highlight sequences
    findAndHighlightLists(rootSelector = 'body', threshold = 0.7) {
      this.threshold = threshold;
      this.clearHighlights();
      
      const root = document.querySelector(rootSelector);
      if (!root) {
        console.error('Root element not found:', rootSelector);
        return { sequences: [], error: 'Root element not found' };
      }
      
      // Find potential lists
      const lists = this.findPotentialLists(root);
      console.log('Found', lists.length, 'potential lists');
      
      let totalSequences = 0;
      const allSequences = [];
      
      lists.forEach((list, listIdx) => {
        const children = Array.from(list.children);
        const sequences = this.findSimilarSequences(children);
        
        sequences.forEach((seq, seqIdx) => {
          this.highlightSequence(seq, totalSequences);
          allSequences.push({
            listIndex: listIdx,
            sequenceIndex: seqIdx,
            ...seq
          });
          totalSequences++;
        });
      });
      
      return {
        sequences: allSequences,
        totalLists: lists.length,
        totalSequences,
        colorPalette: COLOR_PALETTE
      };
    }

    // Find potential lists (containers with multiple children)
    findPotentialLists(root) {
      const lists = [];
      const minChildren = 3;
      
      const traverse = (element) => {
        // Check if element could be a list
        if (element.children && element.children.length >= minChildren) {
          const tagName = element.tagName.toLowerCase();
          
          // Obvious lists
          if (tagName === 'ul' || tagName === 'ol') {
            lists.push(element);
          }
          // Potential lists (div, section, etc with many children)
          else if (element.children.length >= 5) {
            // Check if children have similar tag names
            const childTags = Array.from(element.children).map(c => c.tagName);
            const tagCounts = {};
            childTags.forEach(tag => {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
            
            // If any tag appears 3+ times, consider it a potential list
            if (Object.values(tagCounts).some(count => count >= 3)) {
              lists.push(element);
            }
          }
        }
        
        // Recurse
        if (element.children) {
          Array.from(element.children).forEach(child => traverse(child));
        }
      };
      
      traverse(root);
      return lists;
    }
  }

  // Expose to window
  window.BrowserDOMPatternMatcher = BrowserDOMPatternMatcher;
})();
`;