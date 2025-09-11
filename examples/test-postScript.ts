import { addPostScript, runPostScript, removePostScript } from '../src/utils/postScript';

async function testPostScript() {
  const pageId = 'a25d3289-88b0-45e3-8b56-0526f7a8c6b2';
  const actionIndex = 10;

  console.log('=== PostScript Functions Test ===\n');

  // Test 1: Add count script
  console.log('1. Adding count script...');
  addPostScript(pageId, actionIndex, '(htmlArray, cheerio) => ({ count: htmlArray.length, type: "count test" })');

  // Test 2: Add text extraction script
  console.log('2. Adding extraction script...');
  addPostScript(pageId, actionIndex, '(htmlArray, cheerio) => htmlArray.slice(0, 1).map(html => ({ preview: cheerio.load(html)("article").text().slice(0, 30) + "..." }))');

  // Test 3: Run latest script
  console.log('3. Running latest script...');
  const result1 = await runPostScript(pageId, actionIndex);
  console.log('Latest result:', JSON.stringify(result1, null, 2));

  // Test 4: Run specific script (count)
  console.log('4. Running count script (index -2)...');
  const fs = require('fs');
  const path = require('path');
  const actionsPath = path.join(process.env.TMPDIR || '/tmp', 'simplepage', pageId, 'actions.json');
  const actionsData = JSON.parse(fs.readFileSync(actionsPath, 'utf-8'));
  const scriptCount = actionsData.actions[actionIndex].postScripts.length;
  
  const result2 = await runPostScript(pageId, actionIndex, scriptCount - 2);
  console.log('Count result:', JSON.stringify(result2, null, 2));

  // Test 5: Remove latest script
  console.log('5. Removing latest script...');
  removePostScript(pageId, actionIndex, scriptCount - 1);

  // Test 6: Run remaining script
  console.log('6. Running remaining script...');
  const result3 = await runPostScript(pageId, actionIndex);
  console.log('Remaining result:', JSON.stringify(result3, null, 2));

  console.log('\n=== Test Complete ===');
}

testPostScript().catch(console.error);