# Replay API

The replay module provides functionality to replay recorded SimplePage actions, allowing you to reproduce user interactions programmatically.

## Overview

The replay system reads actions recorded by SimplePage (stored in `actions.json` files) and executes them using the SimplePageClient API. This is useful for:

- Automated testing and regression testing
- Debugging user-reported issues
- Creating demos and tutorials
- Performance testing with repeated actions

## Installation

```typescript
import { replay, replayFromFile, replayPartial } from './src/replay';
```

## Core Functions

### `replay(actions, options)`

Replays an array of actions sequentially.

```typescript
async function replay(
  actions: Action[], 
  options?: ReplayOptions
): Promise<ReplayResult>
```

**Parameters:**
- `actions`: Array of Action objects to replay
- `options`: Optional configuration object

**Returns:** `ReplayResult` with execution details

### `replayFromFile(filePath, options)`

Loads and replays actions from a JSON file.

```typescript
async function replayFromFile(
  filePath: string,
  options?: ReplayOptions
): Promise<ReplayResult>
```

**Parameters:**
- `filePath`: Path to the actions.json file
- `options`: Optional configuration object

### `replayPartial(actions, indices, options)`

Replays specific actions by their indices.

```typescript
async function replayPartial(
  actions: Action[],
  indices: number[],
  options?: ReplayOptions
): Promise<ReplayResult>
```

## Configuration Options

```typescript
interface ReplayOptions {
  serverUrl?: string;        // SimplePage server URL (default: 'http://localhost:3100')
  delay?: number;           // Delay between actions in milliseconds (default: 1000ms)
  verbose?: boolean;        // Enable detailed logging (default: false)
  continueOnError?: boolean; // Continue replay even if an action fails (default: false)
}
```

## Result Object

```typescript
interface ReplayResult {
  success: boolean;         // Overall success status
  executedActions: number;  // Number of successfully executed actions
  errors: Array<{          // Array of errors encountered
    action: Action;
    error: string;
  }>;
  pageId?: string;         // ID of the created page (if any)
}
```

## Supported Action Types

The replay system supports all SimplePage action types:

- `create`: Create a new page
- `navigate`: Navigate to a URL
- `act`: Perform actions (click, fill, etc.) using XPath or element ID
- `wait`: Wait for a specified duration
- `condition`: Check if page content matches a pattern
- `close`: Close the page

Note: `navigateBack`, `navigateForward`, and `reload` are recorded but not yet implemented in SimplePageClient.

## Usage Examples

### Basic Replay from File

```typescript
import { replayFromFile } from './src/replay';

const result = await replayFromFile('/tmp/simplepage/abc123/actions.json', {
  verbose: true,
  delay: 1000
});

console.log(`Executed ${result.executedActions} actions`);
if (result.errors.length > 0) {
  console.log('Errors:', result.errors);
}
```

### Replay Custom Actions

```typescript
import { replay } from './src/replay';

const actions = [
  {
    type: 'create',
    url: 'https://example.com',
    description: 'Create test page',
    timestamp: Date.now()
  },
  {
    type: 'act',
    method: 'click',
    xpath: '//button[@id="submit"]',
    description: 'Click submit button',
    timestamp: Date.now() + 1000
  }
];

const result = await replay(actions, {
  verbose: true,
  continueOnError: true
});
```

### Partial Replay

```typescript
import { replayPartial } from './src/replay';
import * as fs from 'fs';

// Load actions from file
const data = JSON.parse(fs.readFileSync('actions.json', 'utf-8'));
const actions = data.actions;

// Replay only actions 0, 2, and 4
const result = await replayPartial(actions, [0, 2, 4], {
  verbose: true
});
```

## Error Handling

The replay system provides flexible error handling:

1. **Default behavior**: Stops on first error
2. **With `continueOnError: true`**: Continues execution, collecting all errors
3. **All errors are captured** in the result object for analysis

## Best Practices

1. **Use appropriate delays**: Add delays between actions to avoid overwhelming the target site
2. **Enable verbose logging**: Use `verbose: true` during development and debugging
3. **Handle errors gracefully**: Check the result object for errors and handle them appropriately
4. **Test incrementally**: Use `replayPartial` to test specific action sequences
5. **Monitor server resources**: Ensure the SimplePage server has adequate resources for replay sessions

## Limitations

- Some navigation actions (`navigateBack`, `navigateForward`, `reload`) are not yet supported
- Actions are replayed sequentially (no parallel execution)
- Timing may differ from original recording due to network and processing variations