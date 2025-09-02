# SimplePage

A lightweight web automation framework built on Playwright and Accessibility Tree, without any AI/LLM dependencies.

## Features

- **Accessibility Tree Extraction** - Retrieves complete accessibility tree structure using Chrome DevTools Protocol
- **Structured Page Analysis** - Converts complex DOM into clean, readable tree format
- **XPath Mapping** - Automatically generates EncodedId to XPath mappings for stable element targeting
- **Precise Element Operations** - Supports element interaction via EncodedId or XPath
- **Zero AI Dependencies** - Runs entirely locally without any LLM or AI services

## Installation

```bash
pnpm install
```

## Quick Start

```typescript
import { chromium } from 'playwright';
import { SimplePage } from './src/SimplePage';

const browser = await chromium.launch();
const page = await browser.newPage();
const sp = new SimplePage(page);
await sp.init();

// Get page structure
const structure = await sp.getPageStructure();
console.log(structure.simplified);  // Print simplified page structure
console.log(structure.xpathMap);    // View EncodedId to XPath mappings

// Operate elements via XPath
await sp.actByXPath('//input[@name="search"]', 'fill', ['search text']);

// Operate elements via EncodedId (requires structure extraction first)
await sp.actByEncodedId('0-123', 'click');
```

## API Reference

### `getPageStructure(selector?: string)`

Extracts the accessibility tree structure and element mappings.

**Returns:**
```typescript
{
  simplified: string,      // Simplified tree structure in text format
  xpathMap: {              // EncodedId to XPath mapping
    "0-123": "//html[1]/body[1]/div[1]/input[1]",
    "0-124": "//html[1]/body[1]/div[1]/button[1]",
    // ...
  },
  idToUrl: {},            // ID to URL mapping (for images and resources)
  tree: object            // Raw A11y Tree object
}
```

The `xpathMap` is crucial for:
- Converting unstable EncodedIds to stable XPath selectors
- Enabling precise element targeting after structure analysis
- Building reliable automation scripts

### `actByEncodedId(encodedId: string, method: string, args?: string[])`

Operates on elements using EncodedId (internally converts to XPath via xpathMap).

**Parameters:**
- `encodedId`: Element identifier in format "frameOrdinal-backendNodeId"
- `method`: Playwright action method (click, fill, select, etc.)
- `args`: Optional arguments for the method

### `actByXPath(xpath: string, method: string, args?: string[])`

Directly operates on elements using XPath selectors for more stable automation.

**Parameters:**
- `xpath`: XPath selector string
- `method`: Playwright action method
- `args`: Optional arguments for the method

## Example Scripts

### Extract Page Structure
```bash
tsx examples/get-structure.ts https://example.com
```
Saves page structure (.txt) and XPath mappings (.json) to system temp directory.

**Output:**
```json
{
  "pageStructure": "/tmp/a1b2c3d4-2025-01-01T12-00-00-000Z.txt",
  "xpathMap": "/tmp/a1b2c3d4-2025-01-01T12-00-00-000Z.json"
}
```

### User-Controlled Automation
```bash
tsx examples/user-control.ts
```
Demonstrates manual page analysis and operation workflow.

### Basic Usage Example
```bash
tsx examples/simple-page-example.ts
```
Shows basic SimplePage functionality.

## Project Structure

```
src/
├── SimplePage.ts      # Core class wrapping automation functionality
├── utils.ts           # Accessibility Tree extraction utilities
└── scriptContent.ts   # DOM manipulation scripts

examples/
├── get-structure.ts       # Page structure extraction tool
├── user-control.ts        # User control demonstration
└── simple-page-example.ts # Basic usage example
```

## How It Works

1. **CDP Integration** - Uses Chrome DevTools Protocol to call `Accessibility.getFullAXTree`
2. **Tree Transformation** - Converts raw A11y Tree into readable text format with element relationships
3. **ID Mapping** - Creates mappings between EncodedIds and XPath selectors
4. **Iterative Exploration** - Save structure → Analyze → Update script → Execute

## Important Notes

### EncodedId Stability
- EncodedIds change after page reload
- Use XPath for stable automation across sessions
- The xpathMap provides the bridge between temporary IDs and stable selectors

### Dynamic Content
- Some dynamic websites may have changing XPaths
- Test stability for your specific use case
- Consider using more robust selectors (data attributes, ARIA labels)

## Use Cases

- **Web Scraping** - Extract structured data without parsing HTML
- **Test Automation** - Build reliable E2E tests using accessibility tree
- **Page Analysis** - Understand page structure through accessibility lens
- **Automation Scripts** - Create maintainable automation without AI dependencies

## License

MIT