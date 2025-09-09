import { SimplePageClient } from '../src/client/SimplePageClient';
import * as fs from 'fs';

// Test replay method using SimplePageClient with Baidu search example
async function testClientReplay() {
  const client = new SimplePageClient('http://localhost:3100');
  
  try {
    console.log('Testing SimplePageClient replay with Baidu search actions...\n');
    
    // Using the Baidu search test actions file from example 4
    const actionsFile = '/var/folders/43/0rcft_cn3zs7fgp1m0mgfs0c0000gn/T/simplepage/a04f398a-4577-49c1-b267-f03b30c1dd75/actions.json';
    
    if (fs.existsSync(actionsFile)) {
      const content = fs.readFileSync(actionsFile, 'utf-8');
      const data = JSON.parse(content);
      const actions = data.actions;
      
      console.log(`Loaded ${actions.length} actions from Baidu search test`);
      console.log('Starting replay...\n');
      
      const result = await client.replay(actions, {
        verbose: true,
        delay: 2000, // 2 seconds between actions to see the process clearly
        continueOnError: false
      });
      
      console.log('\nBaidu Search Replay Result:', result);
    } else {
      console.error(`Actions file not found: ${actionsFile}`);
    }
    
  } catch (error) {
    console.error('Error during replay:', error);
  }
}

// Run the test
testClientReplay().catch(console.error);