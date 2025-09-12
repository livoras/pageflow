import * as fs from 'fs';
import { JSDOM } from 'jsdom';

// Get arguments
const args = process.argv.slice(2);
if (args.length !== 3) {
  console.error('Usage: tsx extract-by-selector.ts <html-file> <selector> <output-file>');
  console.error('Example: tsx extract-by-selector.ts page.html ".search-results" results.html');
  process.exit(1);
}

const [htmlFile, selector, outputFile] = args;

// Check input file exists
if (!fs.existsSync(htmlFile)) {
  console.error(`File not found: ${htmlFile}`);
  process.exit(1);
}

// Load HTML
console.log(`Loading: ${htmlFile}`);
const html = fs.readFileSync(htmlFile, 'utf-8');

// Parse with JSDOM and extract element
const dom = new JSDOM(html);
const doc = dom.window.document;
const element = doc.querySelector(selector);

if (!element) {
  console.error(`Element not found with selector: ${selector}`);
  process.exit(1);
}

// Save element HTML
fs.writeFileSync(outputFile, element.outerHTML, 'utf-8');

console.log(`✅ Extracted element saved to: ${outputFile}`);
console.log(`Element: ${element.tagName}, ${element.children.length} children`);