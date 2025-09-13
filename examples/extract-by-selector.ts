import * as fs from 'fs';
import { JSDOM } from 'jsdom';

// Get arguments
const args = process.argv.slice(2);
if (args.length !== 3) {
  console.error('Usage: tsx extract-by-selector.ts <html-file> <selector-or-xpath> <output-file>');
  console.error('Example: tsx extract-by-selector.ts page.html ".search-results" results.html');
  console.error('Example: tsx extract-by-selector.ts page.html "//div[@class=\'results\']" results.html');
  process.exit(1);
}

const [htmlFile, selectorOrXpath, outputFile] = args;

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

let element: Element | null = null;

// Detect if it's XPath (starts with / or //) or CSS selector
if (selectorOrXpath.startsWith('/')) {
  // Use XPath
  const result = doc.evaluate(selectorOrXpath, doc, null, 9, null); // XPathResult.FIRST_ORDERED_NODE_TYPE
  element = result.singleNodeValue as Element;
} else {
  // Use CSS selector
  element = doc.querySelector(selectorOrXpath);
}

if (!element) {
  console.error(`Element not found with ${selectorOrXpath.startsWith('/') ? 'XPath' : 'selector'}: ${selectorOrXpath}`);
  process.exit(1);
}

// Save element HTML
fs.writeFileSync(outputFile, element.outerHTML, 'utf-8');

console.log(`✅ Extracted element saved to: ${outputFile}`);
console.log(`Element: ${element.tagName}, ${element.children.length} children`);