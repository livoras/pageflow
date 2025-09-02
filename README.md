# SimplePage

A lightweight web automation framework built on Playwright and Accessibility Tree, without any AI/LLM dependencies.

## Features

- **Accessibility Tree Extraction** - Retrieves complete accessibility tree structure using Chrome DevTools Protocol
- **Structured Page Analysis** - Converts complex DOM into clean, readable tree format
- **XPath Mapping** - Automatically generates EncodedId to XPath mappings for stable element targeting
- **Precise Element Operations** - Supports element interaction via EncodedId or XPath
- **HTTP API Server** - REST API for browser automation with persistent context
- **Operation Recording** - Complete action history with page snapshots
- **Zero AI Dependencies** - Runs entirely locally without any LLM or AI services

## Installation

```bash
pnpm install
```

## Quick Start

### Direct Usage

```typescript
import { chromium } from 'playwright';
import { SimplePage } from './src/SimplePage';

const browser = await chromium.launch();
const page = await browser.newPage();
const sp = new SimplePage(page);
await sp.init();

// Navigate to a URL
await sp.navigate('https://example.com', 5000);

// Get page structure
const structure = await sp.getPageStructure();
console.log(structure.simplified);  // Print simplified page structure
console.log(structure.xpathMap);    // View EncodedId to XPath mappings

// Operate elements via XPath
await sp.actByXPath('//input[@name="search"]', 'fill', ['search text']);

// Operate elements via EncodedId (requires structure extraction first)
await sp.actByEncodedId('0-123', 'click');

// Wait for timeout
await sp.waitForTimeout(2000);
```

### HTTP Server Mode

Start the HTTP server for REST API access:

```bash
PORT=3100 tsx examples/start-server.ts
```

The server provides a complete REST API for browser automation:

```bash
# Create a new page
curl -X POST http://localhost:3100/api/pages \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "url": "https://example.com", "timeout": 10000}'

# Get page structure
curl http://localhost:3100/api/pages/{pageId}/structure

# Navigate to URL
curl -X POST http://localhost:3100/api/pages/{pageId}/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://google.com", "timeout": 5000}'

# Act on element by EncodedId
curl -X POST http://localhost:3100/api/pages/{pageId}/act-id \
  -H "Content-Type: application/json" \
  -d '{"encodedId": "0-123", "method": "click"}'

# Wait
curl -X POST http://localhost:3100/api/pages/{pageId}/wait \
  -H "Content-Type: application/json" \
  -d '{"timeout": 2000}'

# Close page
curl -X DELETE http://localhost:3100/api/pages/{pageId}
```

## API Reference

### SimplePage Methods

#### `getPageStructure(selector?: string)`

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

#### `navigate(url: string, timeout?: number, description?: string)`

Navigates to a specified URL.

**Parameters:**
- `url`: Target URL to navigate to
- `timeout`: Navigation timeout in milliseconds (default: 3000)
- `description`: Optional description for logging

#### `waitForTimeout(timeout: number, description?: string)`

Waits for a specified duration.

**Parameters:**
- `timeout`: Wait duration in milliseconds
- `description`: Optional description for logging

#### `actByEncodedId(encodedId: string, method: string, args?: string[])`

Operates on elements using EncodedId (internally converts to XPath via xpathMap).

**Parameters:**
- `encodedId`: Element identifier in format "frameOrdinal-backendNodeId"
- `method`: Playwright action method (click, fill, select, etc.)
- `args`: Optional arguments for the method

#### `actByXPath(xpath: string, method: string, args?: string[])`

Directly operates on elements using XPath selectors for more stable automation.

**Parameters:**
- `xpath`: XPath selector string
- `method`: Playwright action method
- `args`: Optional arguments for the method

### HTTP API Endpoints

#### POST `/api/pages`
Creates a new page and navigates to URL.

**Request Body:**
```json
{
  "name": "page-name",
  "url": "https://example.com",  // Required
  "timeout": 10000,               // Optional, default 3000
  "description": "Description"    // Optional
}
```

#### DELETE `/api/pages/:pageId`
Closes a page.

#### GET `/api/pages/:pageId/structure`
Returns the simplified page structure.

**Query Parameters:**
- `selector`: Optional CSS selector to limit extraction scope

#### POST `/api/pages/:pageId/navigate`
Navigates the page to a new URL.

**Request Body:**
```json
{
  "url": "https://example.com",
  "timeout": 5000,
  "description": "Navigate to example"
}
```

#### POST `/api/pages/:pageId/wait`
Waits for specified duration.

**Request Body:**
```json
{
  "timeout": 2000,
  "description": "Wait for page to settle"
}
```

#### POST `/api/pages/:pageId/act-id`
Acts on element by EncodedId.

**Request Body:**
```json
{
  "encodedId": "0-123",
  "method": "click",
  "args": [],
  "description": "Click button"
}
```

#### POST `/api/pages/:pageId/act-xpath`
Acts on element by XPath.

**Request Body:**
```json
{
  "xpath": "//button[@id='submit']",
  "method": "click",
  "args": [],
  "description": "Click submit button"
}
```

#### GET `/api/pages/:pageId`
Returns page information.

#### GET `/api/pages`
Lists all open pages.

## Page State Tracking

SimplePage can optionally record all operations for debugging and replay:

```typescript
// Enable state tracking with page ID
const sp = new SimplePage(page, 'unique-page-id', 'Test automation');
await sp.init();

// All operations are recorded to /tmp/simplepage/{id}/
// - actions.json: Complete operation history
// - data/: Page snapshots for each action
```

Each action records:
- Operation type (create, navigate, wait, act, close)
- Timestamp
- Page structure snapshot
- XPath mappings

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

### Start HTTP Server
```bash
PORT=3100 tsx examples/start-server.ts
```
Starts the SimplePageServer with REST API on specified port.

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
├── SimplePage.ts         # Core class wrapping automation functionality
├── SimplePageServer.ts   # HTTP API server with page management
├── utils.ts              # Accessibility Tree extraction utilities
└── scriptContent.ts      # DOM manipulation scripts

examples/
├── get-structure.ts       # Page structure extraction tool
├── start-server.ts        # HTTP server launcher
├── user-control.ts        # User control demonstration
└── simple-page-example.ts # Basic usage example
```

## How It Works

1. **CDP Integration** - Uses Chrome DevTools Protocol to call `Accessibility.getFullAXTree`
2. **Tree Transformation** - Converts raw A11y Tree into readable text format with element relationships
3. **ID Mapping** - Creates mappings between EncodedIds and XPath selectors
4. **Iterative Exploration** - Save structure → Analyze → Update script → Execute
5. **Persistent Context** - Server mode maintains browser state across requests
6. **Action Recording** - Optional complete history tracking with snapshots

## Important Notes

### EncodedId Stability
- EncodedIds change after page reload
- Use XPath for stable automation across sessions
- The xpathMap provides the bridge between temporary IDs and stable selectors

### Dynamic Content
- Some dynamic websites may have changing XPaths
- Test stability for your specific use case
- Consider using more robust selectors (data attributes, ARIA labels)

### Server Mode
- Uses persistent browser context for maintaining login states
- User data stored in `~/.simple-page-server/user-data`
- Supports headless mode with `HEADLESS=true` environment variable

## Use Cases

- **Web Scraping** - Extract structured data without parsing HTML
- **Test Automation** - Build reliable E2E tests using accessibility tree
- **Page Analysis** - Understand page structure through accessibility lens
- **Automation Scripts** - Create maintainable automation without AI dependencies
- **API-Driven Automation** - Control browser via REST API for integration with other systems
- **Debugging Automation** - Complete operation recording for troubleshooting

## License

MIT