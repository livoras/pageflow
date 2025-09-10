import { replayFromFile } from './src/replay';

async function testReplay() {
  console.log('🧪 Testing replay of tweet posting actions...\n');
  
  // Replay the first attempt that failed with click interception
  console.log('📂 Replaying first attempt (with click interception issue)...');
  try {
    const result1 = await replayFromFile(
      '/var/folders/43/0rcft_cn3zs7fgp1m0mgfs0c0000gn/T/simplepage/d16dc99c-5286-4ace-af38-b1e3dff5e37d/actions.json',
      {
        verbose: true,
        delay: 2000, // 2 second delay between actions
        continueOnError: true
      }
    );
    
    console.log('\n📊 First attempt results:');
    console.log(`Success: ${result1.success}`);
    console.log(`Executed: ${result1.executedActions} actions`);
    console.log(`Errors: ${result1.errors.length}`);
    
    if (result1.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result1.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. Action: ${err.action.type} - ${err.action.description}`);
        console.log(`     Error: ${err.error}`);
      });
    }
  } catch (error) {
    console.error('Failed to replay first attempt:', error);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // Replay the second successful attempt  
  console.log('📂 Replaying second attempt (successful)...');
  try {
    const result2 = await replayFromFile(
      '/var/folders/43/0rcft_cn3zs7fgp1m0mgfs0c0000gn/T/simplepage/8827c133-3eb7-4c52-807b-9244de704b0b/actions.json',
      {
        verbose: true,
        delay: 2000,
        continueOnError: true
      }
    );
    
    console.log('\n📊 Second attempt results:');
    console.log(`Success: ${result2.success}`);
    console.log(`Executed: ${result2.executedActions} actions`);
    console.log(`Errors: ${result2.errors.length}`);
  } catch (error) {
    console.error('Failed to replay second attempt:', error);
  }
}

testReplay().catch(console.error);