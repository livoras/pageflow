import * as fs from 'fs';
import * as cheerio from 'cheerio';
import * as prettier from 'prettier';

async function main() {
  // Get arguments
  const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Usage: tsx clean-html.ts <input-html-file> <output-html-file>');
  console.error('Example: tsx clean-html.ts dirty.html clean.html');
  process.exit(1);
}

const [htmlFile, outputFile] = args;

// Check input file exists
if (!fs.existsSync(htmlFile)) {
  console.error(`File not found: ${htmlFile}`);
  process.exit(1);
}

console.log(`Cleaning: ${htmlFile}`);
const html = fs.readFileSync(htmlFile, 'utf-8');
const $ = cheerio.load(html);

// Remove meaningless tags
const tagsToRemove = ['script', 'style', 'link', 'meta', 'noscript', 'title'];
let removedCount = 0;
tagsToRemove.forEach(tag => {
  const elements = $(tag);
  removedCount += elements.length;
  elements.remove();
});

// Clean empty elements and whitespace recursively
function cleanElement($element: cheerio.Cheerio<cheerio.Element>) {
  $element.contents().each((_, node) => {
    if (node.type === 'text') {
      // Compress multiple spaces to single space, trim
      const cleaned = node.data?.replace(/\s+/g, ' ').trim() || '';
      if (cleaned) {
        node.data = cleaned;
      } else {
        $(node).remove();
      }
    } else if (node.type === 'tag') {
      const $childElement = $(node);
      cleanElement($childElement); // Recursive
      
      // Remove if empty (no text content and no children)
      const hasContent = $childElement.text().trim();
      const hasChildren = $childElement.children().length > 0;
      const isSelfClosing = ['img', 'br', 'hr', 'input', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'].includes(node.name?.toLowerCase() || '');
      
      if (!hasContent && !hasChildren && !isSelfClosing) {
        $childElement.remove();
      }
    }
  });
}

let emptyElementsBefore = $('*').length;
cleanElement($('html').length ? $('html') : $.root());
let emptyElementsAfter = $('*').length;

// Format and save output
// Check if original HTML was a complete document
const isCompleteDocument = html.trim().toLowerCase().includes('<!doctype') || html.trim().toLowerCase().startsWith('<html');

let cleanedHtml: string;
if (isCompleteDocument) {
  cleanedHtml = $.html();
} else {
  // For HTML fragments, only output the body content
  cleanedHtml = $('body').html() || $.html();
}

// Format with prettier
cleanedHtml = await prettier.format(cleanedHtml, { parser: 'html' });

fs.writeFileSync(outputFile, cleanedHtml, 'utf-8');

console.log(`✅ Cleaned HTML saved to: ${outputFile}`);
console.log(`📊 Statistics:`);
console.log(`   Removed meaningless tags: ${removedCount}`);
console.log(`   Elements before: ${emptyElementsBefore}`);
console.log(`   Elements after: ${emptyElementsAfter}`);
console.log(`   Elements removed: ${emptyElementsBefore - emptyElementsAfter}`);

const originalSize = Buffer.from(html).length;
const cleanedSize = Buffer.from(cleanedHtml).length;
const reduction = ((originalSize - cleanedSize) / originalSize * 100).toFixed(1);
console.log(`   Size reduction: ${reduction}% (${(originalSize/1024).toFixed(1)}KB → ${(cleanedSize/1024).toFixed(1)}KB)`);
}

main().catch(console.error);