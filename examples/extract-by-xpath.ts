import * as fs from 'fs';
import { JSDOM } from 'jsdom';

// Get arguments
const args = process.argv.slice(2);
if (args.length !== 3) {
  console.error('Usage: tsx extract-by-xpath.ts <html-file> <xpath> <output-file>');
  console.error('Example: tsx extract-by-xpath.ts page.html "//div[@class=\'results\']" results.html');
  process.exit(1);
}

const [htmlFile, xpath, outputFile] = args;

// Check input file exists
if (!fs.existsSync(htmlFile)) {
  console.error(`File not found: ${htmlFile}`);
  process.exit(1);
}

// Load HTML
console.log(`Loading: ${htmlFile}`);
const html = fs.readFileSync(htmlFile, 'utf-8');

// Parse with JSDOM and extract element using XPath
const dom = new JSDOM(html);
const doc = dom.window.document;

// Use XPath to find element
const result = doc.evaluate(xpath, doc, null, 9, null); // XPathResult.FIRST_ORDERED_NODE_TYPE
const element = result.singleNodeValue as Element;

if (!element) {
  console.error(`Element not found with XPath: ${xpath}`);
  process.exit(1);
}

// Save element HTML
fs.writeFileSync(outputFile, element.outerHTML, 'utf-8');

console.log(`✅ Extracted element saved to: ${outputFile}`);
console.log(`Element: ${element.tagName}, ${element.children.length} children`);