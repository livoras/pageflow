import { StructureParser } from '../src/utils/structure-parser';
import { DOMSimHash } from '../src/utils/dom-simhash';
import { ElementNode } from '../src/types/outline';
import * as fs from 'fs';
import * as path from 'path';

// Read Amazon search results
const structureText = fs.readFileSync('amazon-search-correct.txt', 'utf-8');

// Parse structure
const parser = new StructureParser();
const nodes = parser.parse(structureText);

console.log('Parsed nodes count:', nodes.length);
console.log('First few root nodes:');
nodes.slice(0, 3).forEach((node, i) => {
  console.log(`${i + 1}. Type: ${node.type}, Indent: ${node.indent}, Content: ${node.content.substring(0, 50)}...`);
  console.log(`   Children: ${node.children.length}`);
});

// Recursively find all list nodes
function findLists(nodes: ElementNode[]): ElementNode[] {
  const lists: ElementNode[] = [];
  for (const node of nodes) {
    if (node.type === 'list' && node.children.length >= 3) {
      lists.push(node);
    }
    lists.push(...findLists(node.children));
  }
  return lists;
}

// Find all lists
const lists = findLists(nodes);
console.log('\nLists found:', lists.length);

// Show info about each list
lists.forEach((list, i) => {
  console.log(`\nList ${i + 1}:`);
  console.log('  Ref:', list.ref);
  console.log('  Children count:', list.children.length);
  console.log('  Child types:', [...new Set(list.children.map(c => c.type))].join(', '));
});

// Create output directory
const outputDir = 'similar-sequences';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Test with SimHash
console.log('\n--- Testing SimHash for lists ---');
const simhash = new DOMSimHash();

// Process each list
lists.forEach((list, listIndex) => {
  console.log(`\nProcessing list ${listIndex + 1} (${list.ref}):`);
  console.log(`  Children: ${list.children.length}`);
  
  // Only process lists with enough children
  if (list.children.length < 3) {
    console.log('  Skipping: too few children');
    return;
  }
  
  // Find similar sequences within this list's children
  const sequences = simhash.findAllSimilarSequences(list.children);
  
  if (sequences.length > 0) {
    console.log(`  Found ${sequences.length} similar sequences:`);
    sequences.forEach((seq, i) => {
      console.log(`    Sequence ${i + 1}: ${seq.count} items`);
      console.log(`      Type: ${seq.sample.type}`);
      console.log(`      Content: ${seq.sample.content.substring(0, 50)}...`);
      
      // Save similar sequences to files
      const filename = `list-${list.ref}-seq-${i + 1}-${seq.sample.type}-${seq.count}items.txt`;
      const filepath = path.join(outputDir, filename);
      
      // Use the actual matched nodes from the sequence
      const similarNodes = seq.items;
      
      // 输出序列信息
      let content = `Similar Sequence in List ${list.ref}: ${seq.count} ${seq.sample.type} nodes\n`;
      content += `Parent list has ${list.children.length} total children\n`;
      content += '='.repeat(80) + '\n\n';
      
      // 直接输出每个节点的完整行和子节点
      similarNodes.forEach((node, idx) => {
        content += node.line + '\n';
        
        // 递归输出所有子节点的完整行
        function printChildren(children: typeof node.children, baseIndent: number) {
          children.forEach(child => {
            const spaces = ' '.repeat(baseIndent + (child.indent - node.indent));
            content += spaces + child.line.trim() + '\n';
            if (child.children.length > 0) {
              printChildren(child.children, baseIndent);
            }
          });
        }
        
        if (node.children.length > 0) {
          printChildren(node.children, node.indent);
        }
        content += '\n';
      });
      
      fs.writeFileSync(filepath, content);
      console.log(`      Saved to: ${filename}`);
    });
  } else {
    console.log('  No similar sequences found');
  }
});

console.log(`\nAll similar sequences saved to: ${outputDir}/`);