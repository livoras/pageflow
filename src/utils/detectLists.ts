import { JSDOM } from 'jsdom';

interface ElementStats {
  element: Element;
  xpath: string;
  directChildrenCount: number;
  totalDescendantsCount: number;
}

/**
 * Generate XPath for an element
 */
function getXPath(element: Element): string {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === 1) {
    let index = 1;
    let sibling = current.previousElementSibling;

    while (sibling) {
      if (sibling.nodeName === current.nodeName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }

    const tagName = current.nodeName.toLowerCase();
    const part = tagName + (index > 1 ? `[${index}]` : '');
    parts.unshift(part);

    current = current.parentElement;
  }

  return '/' + parts.join('/');
}

/**
 * Count total descendants of an element
 */
function countDescendants(element: Element): number {
  return element.querySelectorAll('*').length;
}

/**
 * Clean DOM by removing scripts, styles, SVGs, and iframes
 */
function cleanDOM(doc: Document): void {
  // Remove script elements
  const scripts = doc.querySelectorAll('script');
  scripts.forEach(script => script.remove());

  // Remove style elements
  const styles = doc.querySelectorAll('style');
  styles.forEach(style => style.remove());

  // Remove SVG elements
  const svgs = doc.querySelectorAll('svg');
  svgs.forEach(svg => svg.remove());

  // Remove iframe elements
  const iframes = doc.querySelectorAll('iframe');
  iframes.forEach(iframe => iframe.remove());
}

/**
 * Check if ancestor element contains descendant element
 */
function isAncestor(ancestor: Element, descendant: Element): boolean {
  return ancestor.contains(descendant) && ancestor !== descendant;
}

/**
 * Calculate overlap ratio between parent and child candidates
 */
function calculateOverlap(parent: Element, child: Element, allCandidates: ElementStats[]): number {
  const parentChildren = Array.from(parent.children);
  const candidateElements = new Set(allCandidates.map(c => c.element));
  
  // Count parent's direct children that are candidates or contain candidates
  const overlapCount = parentChildren.filter(childElement => 
    candidateElements.has(childElement) || childElement.contains(child)
  ).length;
  
  return parentChildren.length > 0 ? overlapCount / parentChildren.length : 0;
}

/**
 * Filter out nested candidates with high overlap (>= 70%)
 */
function filterNestedCandidates(candidates: ElementStats[], overlapThreshold = 0.7): ElementStats[] {
  const filtered: ElementStats[] = [];
  
  for (const candidate of candidates) {
    let shouldKeep = true;
    
    // Check if candidate should be filtered out due to being a parent with high overlap
    for (const other of candidates) {
      if (candidate === other) continue;
      
      // Check if candidate is ancestor of other
      if (isAncestor(candidate.element, other.element)) {
        const overlap = calculateOverlap(candidate.element, other.element, candidates);
        
        if (overlap >= overlapThreshold) {
          // candidate is parent with high overlap, should be filtered out
          shouldKeep = false;
          break;
        }
      }
    }
    
    if (shouldKeep) {
      filtered.push(candidate);
    }
  }
  
  return filtered;
}

/**
 * Detect potential list containers in HTML
 * @param html - HTML string to analyze
 * @returns Array of XPaths for detected list containers
 */
export function detectLists(html: string, debug = false): string[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Step 1: Clean the DOM
  cleanDOM(doc);

  // Step 2: Collect statistics for all elements
  const allElements = doc.querySelectorAll('*');
  const elementStats: ElementStats[] = [];

  allElements.forEach(element => {
    const directChildrenCount = element.children.length;
    const totalDescendantsCount = countDescendants(element);

    // Only consider elements with at least some children
    if (directChildrenCount > 0) {
      elementStats.push({
        element,
        xpath: getXPath(element),
        directChildrenCount,
        totalDescendantsCount
      });
    }
  });

  if (debug) {
    console.log(`Total elements with children: ${elementStats.length}`);
    
    // Check what happened after cleaning
    const remainingScripts = doc.querySelectorAll('script').length;
    console.log(`Scripts after cleaning: ${remainingScripts}`);
    
    // Find a-page element and check its stats after cleaning
    const aPage = doc.getElementById('a-page');
    if (aPage) {
      console.log('\na-page after cleaning:');
      console.log(`Direct children: ${aPage.children.length}`);
      const childTypes: Record<string, number> = {};
      Array.from(aPage.children).forEach(child => {
        const tag = child.tagName.toLowerCase();
        childTypes[tag] = (childTypes[tag] || 0) + 1;
      });
      console.log('Child types:', childTypes);
    }
  }

  // Step 3: Sort by direct children count
  const sortedByDirectChildren = [...elementStats].sort(
    (a, b) => b.directChildrenCount - a.directChildrenCount
  );

  // Step 4: Sort by total descendants count
  const sortedByTotalDescendants = [...elementStats].sort(
    (a, b) => b.totalDescendantsCount - a.totalDescendantsCount
  );

  if (debug) {
    console.log('\nTop 10 by direct children:');
    sortedByDirectChildren.slice(0, 10).forEach((stat, i) => {
      console.log(`  ${i+1}. ${stat.element.tagName} - ${stat.directChildrenCount} children`);
    });

    console.log('\nTop 10 by total descendants:');
    sortedByTotalDescendants.slice(0, 10).forEach((stat, i) => {
      console.log(`  ${i+1}. ${stat.element.tagName} - ${stat.totalDescendantsCount} descendants`);
    });
  }

  // Step 5: Create a weighted scoring system
  const listCandidates: ElementStats[] = [];
  
  // Calculate normalized scores (0-100) for all elements
  const scores = new Map<Element, number>();
  
  // Linear normalization: rank 1 = 100, last rank = 0
  const totalElements = sortedByDirectChildren.length;
  
  // Calculate normalized scores for direct children (60% weight)
  sortedByDirectChildren.forEach((stat, index) => {
    const normalizedScore = totalElements > 1 
      ? 100 * (totalElements - index - 1) / (totalElements - 1)
      : 100;
    const weightedScore = normalizedScore * 0.6;
    scores.set(stat.element, weightedScore);
  });
  
  // Calculate normalized scores for total descendants (40% weight)
  sortedByTotalDescendants.forEach((stat, index) => {
    const normalizedScore = totalElements > 1
      ? 100 * (totalElements - index - 1) / (totalElements - 1)
      : 100;
    const weightedScore = normalizedScore * 0.4;
    const currentScore = scores.get(stat.element) || 0;
    scores.set(stat.element, currentScore + weightedScore);
  });
  
  // Filter candidates with reasonable criteria
  elementStats.forEach(stat => {
    const score = scores.get(stat.element) || 0;
    
    // Candidates must have:
    // 1. At least 3 direct children
    // 2. Score above threshold (25 out of 100)
    // 3. Not be too deeply nested (avoid body/html)
    if (stat.directChildrenCount >= 3 && score > 25) {
      // Skip elements that are too high level (like body, html)
      const tagName = stat.element.tagName.toLowerCase();
      if (tagName !== 'html' && tagName !== 'body') {
        listCandidates.push(stat);
      }
    }
  });

  if (debug) {
    console.log(`\nPotential list candidates: ${listCandidates.length}`);
    
    // Show detailed scoring for a-page
    const aPageStats = elementStats.find(stat => stat.element.id === 'a-page');
    if (aPageStats) {
      const aPageScore = scores.get(aPageStats.element) || 0;
      console.log('\na-page detailed analysis:');
      console.log(`Weighted Score: ${aPageScore.toFixed(2)}`);
      console.log(`Direct children: ${aPageStats.directChildrenCount}`);
      console.log(`Total descendants: ${aPageStats.totalDescendantsCount}`);
      
      // Find its rank in each list
      const directChildrenRank = sortedByDirectChildren.findIndex(s => s.element === aPageStats.element) + 1;
      const descendantsRank = sortedByTotalDescendants.findIndex(s => s.element === aPageStats.element) + 1;
      console.log(`Rank by direct children: ${directChildrenRank}`);
      console.log(`Rank by total descendants: ${descendantsRank}`);
      
      // Calculate component scores
      const directChildScore = totalElements > 1 
        ? 100 * (totalElements - (directChildrenRank - 1)) / (totalElements - 1)
        : 100;
      const descendantsScore = totalElements > 1
        ? 100 * (totalElements - (descendantsRank - 1)) / (totalElements - 1)
        : 100;
      console.log(`Direct children score: ${directChildScore.toFixed(2)} × 0.6 = ${(directChildScore * 0.6).toFixed(2)}`);
      console.log(`Descendants score: ${descendantsScore.toFixed(2)} × 0.4 = ${(descendantsScore * 0.4).toFixed(2)}`);
    }
    
    // Show top 5 candidates with scores BEFORE sorting
    console.log('\nTop 5 candidates BEFORE sorting by score:');
    listCandidates.slice(0, 5).forEach((stat, i) => {
      const score = scores.get(stat.element) || 0;
      console.log(`${i+1}. ${stat.element.tagName}#${stat.element.id || '(no-id)'} - Score: ${score.toFixed(2)}, Children: ${stat.directChildrenCount}, Descendants: ${stat.totalDescendantsCount}`);
    });
  }

  // Sort candidates by combined score
  listCandidates.sort((a, b) => {
    const scoreA = scores.get(a.element) || 0;
    const scoreB = scores.get(b.element) || 0;
    return scoreB - scoreA;
  });
  
  if (debug) {
    console.log('\nTop 5 candidates AFTER sorting by score:');
    listCandidates.slice(0, 5).forEach((stat, i) => {
      const score = scores.get(stat.element) || 0;
      console.log(`${i+1}. ${stat.element.tagName}#${stat.element.id || '(no-id)'} - Score: ${score.toFixed(2)}, Children: ${stat.directChildrenCount}, Descendants: ${stat.totalDescendantsCount}`);
    });
  }

  // Take top candidates first, then filter for efficiency
  const topCandidates = listCandidates.slice(0, 20); // Take top 20 to ensure we get 10 after filtering
  const filteredCandidates = filterNestedCandidates(topCandidates);
  
  if (debug) {
    console.log(`\nFiltering top ${topCandidates.length} candidates: ${topCandidates.length} -> ${filteredCandidates.length}`);
    const filteredOut = topCandidates.length - filteredCandidates.length;
    if (filteredOut > 0) {
      console.log(`Filtered out ${filteredOut} nested candidates with >70% overlap from top results`);
    }
    
    console.log('\nFinal candidates after filtering:');
    filteredCandidates.slice(0, 10).forEach((stat, i) => {
      console.log(`${i+1}. ${stat.element.tagName}#${stat.element.id || '(no-id)'} - Children: ${stat.directChildrenCount}, Descendants: ${stat.totalDescendantsCount}`);
    });
  }
  
  // Return XPaths of top candidates
  return filteredCandidates.slice(0, 10).map(stat => stat.xpath);
}