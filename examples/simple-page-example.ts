import { chromium } from 'playwright';
import { SimplePage } from '../src/SimplePage';

async function example() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Create SimplePage instance with just a Playwright page
  const sp = new SimplePage(page);
  await sp.init();
  
  // Navigate to a website
  await page.goto('https://example.com');
  
  // Get page structure (Accessibility Tree)
  const structure = await sp.getPageStructure();
  console.log('Page structure:', structure.simplified);
  console.log('XPath mappings:', structure.xpathMap);
  
  // Act on elements by EncodedId
  // await sp.actByEncodedId('0-123', 'click');
  // await sp.actByEncodedId('0-456', 'fill', ['text input']);
  
  // Act on elements by XPath directly
  // await sp.actByXPath('/html[1]/body[1]/div[1]/input[1]', 'fill', ['direct xpath']);
  
  await browser.close();
}

example().catch(console.error);