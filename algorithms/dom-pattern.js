// DOM Pattern Matcher Algorithm
// This algorithm detects similar element sequences based on DOM structure, interaction patterns, and text content

(function() {
  window.SequenceDetector = {
    threshold: 0.7,
    
    // Main detection function
    detect: function(elements) {
      const sequences = this.findSimilarSequences(elements);
      return { sequences };
    },

    // Extract feature vector from element structure
    extractFeatureVector: function(element) {
      const features = new Map();
      
      const collectFeatures = (el, parent) => {
        const type = el.tagName ? el.tagName.toLowerCase() : 'text';
        const parentType = parent ? parent.tagName.toLowerCase() : 'root';
        
        // Get child types
        const childTypes = el.children ? 
          Array.from(el.children).map(c => c.tagName.toLowerCase()) : [];
        
        // Get sibling types  
        const siblingTypes = parent && parent.children ?
          Array.from(parent.children)
            .filter(s => s !== el)
            .map(s => s.tagName.toLowerCase()) : [];
        
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
    },

    // Calculate structural similarity between two feature vectors
    calculateStructuralSimilarity: function(featuresA, featuresB) {
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
    },

    // Extract interaction element stats
    extractInteractionStats: function(element) {
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
    },

    // Extract interaction element texts
    extractInteractionTexts: function(element) {
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
    },

    // Calculate interaction type consistency (25% weight)
    calculateInteractionTypeConsistency: function(elementA, elementB) {
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
    },

    // Calculate text match bonus (25% weight)
    calculateTextMatchBonus: function(elementA, elementB) {
      const textsA = this.extractInteractionTexts(elementA);
      const textsB = this.extractInteractionTexts(elementB);
      
      if (textsA.size === 0 || textsB.size === 0) return 0;
      
      for (const text of textsA) {
        if (textsB.has(text)) {
          return 1;
        }
      }
      
      return 0;
    },

    // Calculate three-layer weighted similarity
    calculateSimilarity: function(vectorA, vectorB, elementA, elementB) {
      const structuralSim = this.calculateStructuralSimilarity(vectorA, vectorB);
      
      if (elementA && elementB) {
        const typeConsistency = this.calculateInteractionTypeConsistency(elementA, elementB);
        const textBonus = this.calculateTextMatchBonus(elementA, elementB);
        
        // 50% structure + 25% interaction type consistency + 25% text match bonus
        return structuralSim * 0.5 + typeConsistency * 0.25 + textBonus * 0.25;
      }
      
      return structuralSim;
    },

    // Find all similar sequences in a list of elements
    findSimilarSequences: function(elements) {
      const sequences = [];
      const processed = new Set();
      
      console.log('[findSimilarSequences] Starting with', elements.length, 'elements');
      
      // Log first few elements to see what we're working with
      console.log('[findSimilarSequences] First 5 elements:');
      for (let i = 0; i < Math.min(5, elements.length); i++) {
        const el = elements[i];
        console.log(`  [${i}] ${el.tagName} class="${el.className}" text="${el.textContent.substring(0, 50)}..."`);
      }
      
      // Group by tag name
      const typeGroups = new Map();
      elements.forEach((el, idx) => {
        const type = el.tagName.toLowerCase();
        if (!typeGroups.has(type)) {
          typeGroups.set(type, []);
        }
        typeGroups.get(type).push({ element: el, index: idx });
      });
      
      console.log('[findSimilarSequences] Type groups:', Array.from(typeGroups.entries()).map(([type, group]) => type + ':' + group.length));
      
      // Process each type group
      for (const [type, group] of typeGroups.entries()) {
        if (group.length < 3) continue;
        
        console.log('[findSimilarSequences] Processing type:', type, 'with', group.length, 'elements');
        
        let i = 0;
        while (i < group.length) {
          if (processed.has(group[i].index)) {
            i++;
            continue;
          }
          
          console.log('[findSimilarSequences] Starting new sequence from index:', group[i].index);
          
          const baseFeatures = this.extractFeatureVector(group[i].element);
          const sequence = [{ ...group[i], similarity: 1.0, prevSimilarity: 1.0 }]; // Base element has 100% similarity
          
          // Log base element details
          const baseEl = group[i].element;
          console.log(`[findSimilarSequences] Base element [${group[i].index}]: ${baseEl.tagName} text="${baseEl.textContent.substring(0, 30)}..."`);
          
          for (let j = i + 1; j < group.length; j++) {
            if (processed.has(group[j].index)) {
              console.log('[findSimilarSequences] Skipping processed index:', group[j].index);
              continue;
            }
            
            // Check if this element is reasonably close to the last element in sequence
            const lastInSequence = sequence[sequence.length - 1];
            const gap = group[j].index - lastInSequence.index;
            
            // Skip if gap is too large (more than 10 positions away)
            if (gap > 10) {
              console.log('[findSimilarSequences] Gap too large between', lastInSequence.index, 'and', group[j].index, 'gap:', gap);
              break; // Stop looking for more elements in this sequence
            }
            
            const features = this.extractFeatureVector(group[j].element);
            const baseSimilarity = this.calculateSimilarity(baseFeatures, features, group[i].element, group[j].element);
            
            console.log('[findSimilarSequences] Comparing base', group[i].index, 'with', group[j].index, 'similarity:', baseSimilarity.toFixed(3), 'gap:', gap);
            
            if (baseSimilarity >= this.threshold) {
              // Calculate similarity with previous element in sequence
              const prevElement = sequence[sequence.length - 1].element;
              const prevFeatures = this.extractFeatureVector(prevElement);
              const prevSimilarity = this.calculateSimilarity(prevFeatures, features, prevElement, group[j].element);
              
              console.log('[findSimilarSequences] Adding to sequence, prev similarity:', prevSimilarity.toFixed(3));
              sequence.push({ ...group[j], similarity: baseSimilarity, prevSimilarity });
            }
          }
          
          if (sequence.length >= 3) {
            console.log('[findSimilarSequences] Found sequence of', sequence.length, 'elements, indices:', sequence.map(s => s.index).join(','));
            
            // Log details of the sequence
            console.log('[findSimilarSequences] Sequence details:');
            sequence.slice(0, 3).forEach((item, idx) => {
              const el = item.element;
              console.log(`  Item ${idx}: ${el.tagName} "${el.textContent.substring(0, 30)}..."`);
            });
            
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
  };
})();