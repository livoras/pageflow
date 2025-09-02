const fetch = require('node-fetch').default;

const BASE_URL = 'http://localhost:3100';

async function testServer() {
  console.log('Testing SimplePageServer API...\n');
  
  try {
    // 1. Health check
    console.log('1. Health check');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const health = await healthRes.json();
    console.log('   Status:', health);
    
    // 2. Create a page
    console.log('\n2. Creating a page');
    const createRes = await fetch(`${BASE_URL}/api/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Page',
        description: 'Testing SimplePage Server',
        url: 'https://www.example.com'
      })
    });
    const pageData = await createRes.json();
    console.log('   Created page:', pageData);
    const pageId = pageData.id;
    
    // 3. List pages
    console.log('\n3. Listing pages');
    const listRes = await fetch(`${BASE_URL}/api/pages`);
    const pages = await listRes.json();
    console.log('   Pages:', pages);
    
    // 4. Get page info
    console.log('\n4. Getting page info');
    const pageInfoRes = await fetch(`${BASE_URL}/api/pages/${pageId}`);
    const pageInfo = await pageInfoRes.json();
    console.log('   Page info:', pageInfo);
    
    // 5. Get page structure
    console.log('\n5. Getting page structure');
    const structureRes = await fetch(`${BASE_URL}/api/pages/${pageId}/structure`);
    const structure = await structureRes.json();
    console.log('   Structure keys:', Object.keys(structure));
    console.log('   Simplified length:', structure.simplified?.length || 0);
    console.log('   XPath map entries:', Object.keys(structure.xpathMap || {}).length);
    
    // 6. Navigate to another page
    console.log('\n6. Navigating to Baidu');
    const navRes = await fetch(`${BASE_URL}/api/pages/${pageId}/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.baidu.com' })
    });
    const navResult = await navRes.json();
    console.log('   Navigation result:', navResult);
    
    // 7. Get updated structure
    console.log('\n7. Getting updated structure');
    const structure2Res = await fetch(`${BASE_URL}/api/pages/${pageId}/structure`);
    const structure2 = await structure2Res.json();
    console.log('   New structure simplified length:', structure2.simplified?.length || 0);
    
    // 8. Try an action (search on Baidu)
    console.log('\n8. Trying to interact with search box');
    // First, find the search input XPath from structure
    const lines = structure2.simplified.split('\n');
    const searchLine = lines.find(line => line.includes('搜索框') || line.includes('search'));
    if (searchLine) {
      console.log('   Found search element:', searchLine.substring(0, 50) + '...');
      
      // Extract EncodedId (usually at the start of the line like "0-123 input")
      const match = searchLine.match(/^(\d+-\d+)/);
      if (match) {
        const encodedId = match[1];
        console.log('   Using EncodedId:', encodedId);
        
        // Try to fill the search box
        const actRes = await fetch(`${BASE_URL}/api/pages/${pageId}/act-id`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            encodedId: encodedId,
            method: 'fill',
            args: ['SimplePage test']
          })
        });
        const actResult = await actRes.json();
        console.log('   Action result:', actResult);
      }
    }
    
    // 9. Take a screenshot
    console.log('\n9. Taking screenshot');
    const screenshotRes = await fetch(`${BASE_URL}/api/pages/${pageId}/screenshot`);
    if (screenshotRes.ok) {
      const buffer = await screenshotRes.buffer();
      console.log('   Screenshot size:', buffer.length, 'bytes');
    }
    
    // 10. Close the page
    console.log('\n10. Closing page');
    const closeRes = await fetch(`${BASE_URL}/api/pages/${pageId}`, {
      method: 'DELETE'
    });
    const closeResult = await closeRes.json();
    console.log('   Close result:', closeResult);
    
    // 11. Final health check
    console.log('\n11. Final health check');
    const finalHealthRes = await fetch(`${BASE_URL}/health`);
    const finalHealth = await finalHealthRes.json();
    console.log('   Final status:', finalHealth);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Wait for server to be ready
setTimeout(() => {
  testServer();
}, 2000);