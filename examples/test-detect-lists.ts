import { detectLists } from '../src/utils/detectLists';
import * as fs from 'fs';
import { JSDOM } from 'jsdom';

// Get file path from command line args
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: tsx test-detect-lists.ts <html-file-path> [--debug]');
  process.exit(1);
}

const filePath = args[0];
const debug = args.includes('--debug');

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

console.log(`Testing: ${filePath}`);
const html = fs.readFileSync(filePath, 'utf-8');
const results = detectLists(html, debug);

console.log(`\nFound ${results.length} potential list containers:`);
results.forEach((xpath, index) => {
  console.log(`${index + 1}. ${xpath}`);
});

// If --analyze flag is provided, analyze the results
if (args.includes('--analyze') && results.length > 0) {
  console.log('\n--- Analyzing detected lists ---');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  
  results.slice(0, 5).forEach((xpath, index) => {
    const result = doc.evaluate(xpath, doc, null, 9, null);
    const element = result.singleNodeValue as Element;
    
    if (element) {
      console.log(`\n${index + 1}. ${xpath}`);
      console.log(`   Tag: ${element.tagName}`);
      console.log(`   ID: ${element.id || '(no id)'}`);
      console.log(`   Class: ${element.className || '(no class)'}`);
      console.log(`   Direct children: ${element.children.length}`);
      console.log(`   Total descendants: ${element.querySelectorAll('*').length}`);
      
      // Show first few child tags
      const childTags = Array.from(element.children)
        .slice(0, 5)
        .map(child => child.tagName.toLowerCase());
      console.log(`   First child tags: ${childTags.join(', ')}${element.children.length > 5 ? '...' : ''}`);
    }
  });
}