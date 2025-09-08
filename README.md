# SimplePage

A lightweight web automation framework built on Playwright and Accessibility Tree, without any AI/LLM dependencies.

## Features

- **Accessibility Tree Extraction** - Retrieves complete accessibility tree structure using Chrome DevTools Protocol
- **Structured Page Analysis** - Converts complex DOM into clean, readable tree format
- **XPath Mapping** - Automatically generates EncodedId to XPath mappings for stable element targeting
- **Precise Element Operations** - Supports element interaction via EncodedId or XPath
- **Condition Checking** - Regex-based page state validation against structure
- **HTTP API Server** - REST API for browser automation with persistent context
- **Operation Recording** - Complete action history with page snapshots
- **Zero AI Dependencies** - Runs entirely locally without any LLM or AI services

## Installation

```bash
pnpm install
```

## Quick Start

### HTTP Server Mode

Start the HTTP server for REST API access:

```bash
PORT=3100 bun run examples/start-server.ts
# or using npm script
PORT=3100 pnpm run server
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

# Scroll to bottom
curl -X POST http://localhost:3100/api/pages/{pageId}/act-xpath \
  -H "Content-Type: application/json" \
  -d '{"xpath": "//body", "method": "scrollY", "args": ["bottom"]}'

# Scroll down 500 pixels
curl -X POST http://localhost:3100/api/pages/{pageId}/act-xpath \
  -H "Content-Type: application/json" \
  -d '{"xpath": "//body", "method": "scrollY", "args": ["500"]}'

# Wait
curl -X POST http://localhost:3100/api/pages/{pageId}/wait \
  -H "Content-Type: application/json" \
  -d '{"timeout": 2000}'

# Check condition
curl -X POST http://localhost:3100/api/pages/{pageId}/condition \
  -H "Content-Type: application/json" \
  -d '{"pattern": "登录.*成功", "description": "Check login success"}'

# Close page
curl -X DELETE http://localhost:3100/api/pages/{pageId}
```

## HTTP API Reference

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

**Response:**
```json
{
  "structure": "Simplified page structure in text format",
  "htmlPath": "/path/to/saved/html/file",
  "actionsPath": "/path/to/actions/json/file",
  "consoleLogPath": "/path/to/console/log/file"
}
```

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

**Supported methods:**
- `click` - Click the element
- `fill` - Fill input field (args: [text])
- `selectOption` - Select dropdown option (args: [value])
- `hover` - Hover over element
- `press` - Press key (args: [key])
- `scrollY` - Vertical scroll (args: ["top" | "bottom" | number])
  - `"top"` - Scroll to top
  - `"bottom"` - Scroll to bottom
  - Positive number - Scroll down by pixels (relative)
  - Negative number - Scroll to absolute position
- `scrollX` - Horizontal scroll (args: ["left" | "right" | number])
  - `"left"` - Scroll to leftmost
  - `"right"` - Scroll to rightmost
  - Positive number - Scroll right by pixels (relative)
  - Negative number - Scroll to absolute position

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

Supports the same methods as act-id.

#### POST `/api/pages/:pageId/condition`
Checks if page structure matches a pattern.

**Request Body:**
```json
{
  "pattern": "登录|login",
  "flags": "i",                    // Optional regex flags
  "description": "Check for login" // Optional
}
```

**Response:**
```json
{
  "matched": true
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
- Operation type (create, navigate, wait, act, condition, close)
- Timestamp
- Page structure snapshot
- XPath mappings
- For condition checks: pattern, flags, and match result

## Example Scripts

### Extract Page Structure
```bash
bun run examples/get-structure.ts https://example.com
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
PORT=3100 bun run examples/start-server.ts
# or using npm script
pnpm run server
```
Starts the SimplePageServer with REST API on specified port.

Environment variables:
```bash
PORT=3100 HEADLESS=true USER_DATA_DIR=/custom/path bun run examples/start-server.ts
```

### User-Controlled Automation
```bash
bun run examples/user-control.ts
```
Demonstrates manual page analysis and operation workflow.

### Basic Usage Example
```bash
bun run examples/simple-page-example.ts
```
Shows basic SimplePage functionality.

### SimplePageClient SDK Usage

The SDK provides a high-level client wrapper around the HTTP API:

```typescript
import { SimplePageClient } from './src/client/SimplePageClient';

// Create client instance
const client = new SimplePageClient('http://localhost:3000');

// Create and control pages
const page = await client.createPage('MyPage', 'https://example.com');

// Perform actions
await page.navigate('https://google.com');
await page.fill('//input[@name="q"]', 'search query');
await page.click('//button[@type="submit"]');
await page.wait(2000);

// Check conditions
const hasResults = await page.checkCondition('Search results');

// Take screenshot
const screenshot = await page.screenshot();

// Close page when done
await page.close();
```

The SDK Page class provides these methods:
- `navigate(url, options)` - Navigate to URL
- `click(xpath, description)` / `clickById(encodedId, description)` - Click elements
- `fill(xpath, text, description)` / `fillById(encodedId, text, description)` - Fill inputs
- `type()` / `typeById()` - Aliases for fill methods
- `wait(timeout, description)` - Wait for specified time
- `checkCondition(pattern, flags, description)` - Check page state
- `getStructure(selector)` - Get page structure, returns {structure, htmlPath, actionsPath, consoleLogPath}
- `getXPath(encodedId)` - Convert EncodedId to XPath
- `screenshot()` - Take page screenshot
- `close()` - Close the page

## Project Structure

```
src/
├── SimplePage.ts         # Core class wrapping automation functionality
├── SimplePageServer.ts   # HTTP API server with page management
├── utils.ts              # Accessibility Tree extraction utilities
├── scriptContent.ts      # DOM manipulation scripts
└── client/
    └── SimplePageClient.ts   # SDK client wrapper for HTTP API

examples/
├── get-structure.ts       # Page structure extraction tool
├── start-server.ts        # HTTP server launcher
├── user-control.ts        # User control demonstration
├── simple-page-example.ts # Basic usage example
└── amazon-search-example.ts # Real-world Amazon search example
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
- User data stored in `~/.simple-page-server/user-data` by default
- Supports headless mode with `HEADLESS=true` environment variable
- Custom user data directory with `USER_DATA_DIR=/path/to/dir` environment variable

## Use Cases

- **Web Scraping** - Extract structured data without parsing HTML
- **Test Automation** - Build reliable E2E tests using accessibility tree
- **Page Analysis** - Understand page structure through accessibility lens
- **Automation Scripts** - Create maintainable automation without AI dependencies
- **API-Driven Automation** - Control browser via REST API for integration with other systems
- **Debugging Automation** - Complete operation recording for troubleshooting

## License

MIT