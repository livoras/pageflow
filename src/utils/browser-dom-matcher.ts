// Browser DOM Matcher
// Combines algorithm loading with highlighting functionality

import fs from 'fs';
import path from 'path';
import { browserDOMHighlighterScript } from './browser-dom-highlighter';
import { browserListDetectorScript } from './browser-list-detector';

// Get algorithm file path from environment variable or use default
const algorithmPath = process.env.ALGORITHM || path.join(process.cwd(), 'algorithms/dom-pattern.js');

// Read algorithm file
let algorithmScript: string;
try {
  algorithmScript = fs.readFileSync(algorithmPath, 'utf-8');
  console.log(`Loaded algorithm from: ${algorithmPath}`);
} catch (error) {
  console.error(`Failed to load algorithm from ${algorithmPath}:`, error);
  // Fallback to empty detector
  algorithmScript = `
    window.SequenceDetector = {
      detect: function(elements) {
        console.error('No algorithm loaded');
        return { sequences: [] };
      }
    };
  `;
}

// Combined script that includes algorithm, detector and highlighter
export const browserDOMMatcherScript = `
${algorithmScript}

${browserListDetectorScript}

${browserDOMHighlighterScript}

// Main entry point for DOM pattern matching
(function() {
  window.DOMPatternMatcher = {
    processLists: function(lists) {
      const results = {
        lists: [],
        totalSequences: 0
      };
      
      lists.forEach((list, listIndex) => {
        // Detect sequences using the loaded algorithm
        const detectionResult = window.SequenceDetector.detect(list.elements);
        
        // Highlight the sequences
        const highlightResult = window.DOMHighlighter.highlightSequences(detectionResult.sequences);
        
        // Store results without DOM elements
        detectionResult.sequences.forEach((seq, seqIdx) => {
          results.lists.push({
            listIndex: listIndex,
            sequenceIndex: seqIdx,
            elementCount: seq.elements ? seq.elements.length : 0
          });
        });
        
        results.totalSequences += highlightResult.totalSequences;
      });
      
      return results;
    }
  };
})();
`;