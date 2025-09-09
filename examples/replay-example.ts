import { replayFromFile, replay, ReplayOptions } from '../src/replay';
import * as path from 'path';

// Example 1: Replay from an actions.json file
async function example1() {
  console.log('Example 1: Replay from file');
  
  // You can use any actions.json file from SimplePage sessions
  const actionsFile = '/var/folders/43/0rcft_cn3zs7fgp1m0mgfs0c0000gn/T/simplepage/9296a5ef-a26e-4256-a697-d9381cd054c0/actions.json';
  
  const result = await replayFromFile(actionsFile, {
    verbose: true,
    delay: 1000, // 1 second between actions
    continueOnError: true,
    serverUrl: 'http://localhost:3100'
  });
  
  console.log('\nReplay Result:', result);
}

// Example 2: Replay specific actions
async function example2() {
  console.log('\nExample 2: Replay custom actions');
  
  const customActions = [
    {
      type: 'create' as const,
      url: 'https://example.com',
      description: 'Create test page',
      timestamp: Date.now()
    },
    {
      type: 'wait' as const,
      timeout: 2000,
      description: 'Wait for page load',
      timestamp: Date.now() + 1000
    },
    {
      type: 'act' as const,
      method: 'click',
      xpath: '//a[@href="/more"]',
      args: [],
      description: 'Click more link',
      timestamp: Date.now() + 3000
    },
    {
      type: 'close' as const,
      timestamp: Date.now() + 4000
    }
  ];
  
  const result = await replay(customActions, {
    verbose: true,
    delay: 500
  });
  
  console.log('\nReplay Result:', result);
}

// Example 3: Replay with error handling
async function example3() {
  console.log('\nExample 3: Replay partial actions from file');
  
  const actionsFile = '/var/folders/43/0rcft_cn3zs7fgp1m0mgfs0c0000gn/T/simplepage/9296a5ef-a26e-4256-a697-d9381cd054c0/actions.json';
  const fs = require('fs');
  
  try {
    // Load actions from file
    const content = fs.readFileSync(actionsFile, 'utf-8');
    const data = JSON.parse(content);
    const actions = data.actions;
    
    // Replay only the first 3 actions
    const selectedActions = actions.slice(0, 3);
    
    const result = await replay(selectedActions, {
      verbose: true,
      continueOnError: false // Stop on first error
    });
    
    console.log('\nPartial Replay Result:', result);
  } catch (error) {
    console.error('Failed to replay:', error);
  }
}

// Main function to run examples
async function main() {
  const args = process.argv.slice(2);
  const example = args[0] || '1';
  
  try {
    switch (example) {
      case '1':
        await example1();
        break;
      case '2':
        await example2();
        break;
      case '3':
        await example3();
        break;
      default:
        console.log('Usage: tsx replay-example.ts [1|2|3]');
    }
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

main();