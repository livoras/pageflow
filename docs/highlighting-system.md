# Highlighting System Documentation

## Overview

The highlighting system provides a simple API for highlighting DOM elements on web pages with customizable colors and labels. This system is completely independent from any list/sequence detection algorithms.

## Core Features

1. **Element Highlighting**
   - Highlight any element via XPath selector
   - Customizable highlight colors (RGBA format)
   - Optional text labels displayed inside highlight boxes
   - Labels positioned at top-left corner of highlighted elements

2. **Highlight Management**
   - Track all highlights using Map structure
   - Remove individual highlights by XPath
   - Clear all highlights with single command
   - Automatic label position updates on scroll/resize

3. **Compatibility**
   - Works with all element types including self-closing elements (input, img, etc.)
   - Labels use fixed positioning independent of element type
   - Proper z-index layering ensures visibility

## API Reference

### Browser API (Injected Script)

```javascript
// Highlight a single element
window.highlight(xpath, color, label)
// Returns: highlighted element or null

// Remove highlight from element
window.unhighlight(xpath)
// Returns: boolean success

// Clear all highlights
window.clearAllHighlights()
// Returns: number of cleared highlights

// Get all current highlights
window.getHighlights()
// Returns: array of highlight info

// Highlight multiple elements
window.highlightMultiple(items)
// Returns: array of results
```

### REST API Endpoints

#### Highlight Element
```
POST /api/pages/:pageId/highlight
Body: {
  "xpath": "//div[@id='example']",
  "color": "rgba(255, 0, 0, 0.3)",
  "label": "Example Label"
}
```

#### Remove Highlight
```
POST /api/pages/:pageId/unhighlight
Body: {
  "xpath": "//div[@id='example']"
}
```

#### Clear All Highlights
```
POST /api/pages/:pageId/clear-highlights
```

## Implementation Details

### File Structure

- `/src/utils/browser-dom-highlighter.ts` - Core highlighting script injected into pages
- `/src/SimplePageServer.ts` - Express server with highlight API endpoints

### Technical Approach

1. **Highlighting Method**
   - Apply inline styles to target elements (background color, border)
   - Ensure element positioning for proper label placement

2. **Label Implementation**
   - Create div elements with fixed positioning
   - Append to document body (not target element)
   - Calculate position based on element's getBoundingClientRect()
   - Update position on scroll/resize events

3. **State Management**
   - Use window._highlights Map to track all active highlights
   - Prevent script re-initialization with window._highlighterInitialized flag
   - Store original element styles for restoration

## Usage Examples

### Basic Highlighting
```javascript
// Highlight search box in orange
window.highlight(
  "//input[@id='search']", 
  "rgba(255, 165, 0, 0.5)", 
  "Search Box"
);

// Highlight product cards in different colors
window.highlight(
  "//div[@class='product'][1]", 
  "rgba(255, 0, 0, 0.3)", 
  "Product 1"
);
window.highlight(
  "//div[@class='product'][2]", 
  "rgba(0, 0, 255, 0.3)", 
  "Product 2"
);
```

### Managing Highlights
```javascript
// Remove specific highlight
window.unhighlight("//input[@id='search']");

// Clear everything
window.clearAllHighlights();

// Check current highlights
const highlights = window.getHighlights();
console.log(`${highlights.length} elements highlighted`);
```

### Batch Operations
```javascript
// Highlight multiple elements at once
const results = window.highlightMultiple([
  {
    xpath: "//button[@type='submit']",
    color: "rgba(0, 255, 0, 0.3)",
    label: "Submit Button"
  },
  {
    xpath: "//a[@class='logo']",
    color: "rgba(128, 0, 128, 0.3)",
    label: "Logo"
  }
]);
```

## Known Limitations

- Labels may overlap if highlighted elements are very close together
- Fixed positioning means labels don't move with CSS transforms on parent elements
- Very long labels may extend beyond viewport edges

## Migration Notes

This system replaces the previous sequence-based highlighting that was tightly coupled with list detection algorithms. Key changes:

- No more automatic sequence detection
- No more pattern matching for similar elements
- Simple XPath-based targeting instead of complex similarity algorithms
- Labels now appear inside highlight boxes rather than above them