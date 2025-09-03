/**
 * Parse page structure text to ElementNode array
 */

import type { ElementNode } from '../types/outline';

export class StructureParser {
  /**
   * Parse structure text to ElementNode array
   * Format: [ref] type: content
   * Example: [0-4061] list: 跳至
   */
  parse(text: string): ElementNode[] {
    const lines = text.split('\n');
    const nodes: ElementNode[] = [];
    const stack: { node: ElementNode; indent: number }[] = [];
    
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];
      if (!line.trim()) continue;
      
      // Calculate indent level (count leading spaces)
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1].length : 0;
      
      // Parse line content
      // Format: [ref] type: content  or  [ref] type
      const linePattern = /^\s*\[([^\]]+)\]\s+([^:]+)(?::\s*(.*))?$/;
      const match = line.match(linePattern);
      
      if (!match) continue;
      
      const [, ref, type, content = ''] = match;
      
      // Create node
      const node: ElementNode = {
        indent,
        type: type.trim(),
        ref: ref.trim(),
        content: content.trim(),
        line: line.trim(),
        children: [],
        priority: this.calculatePriority(type.trim()),
        isRepetitive: false,
        lineNumber: lineNumber + 1,
        hasInteraction: this.hasInteraction(type.trim(), line)
      };
      
      // Build tree structure
      // Remove all nodes from stack with indent >= current indent
      while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }
      
      // If stack is empty, this is a root node
      if (stack.length === 0) {
        nodes.push(node);
      } else {
        // Otherwise, this is a child of the last node in stack
        const parent = stack[stack.length - 1].node;
        parent.children.push(node);
        node.parent = parent;
      }
      
      // Push current node to stack
      stack.push({ node, indent });
    }
    
    return nodes;
  }
  
  /**
   * Flatten tree to linear array (depth-first)
   * 将树形结构展平为线性数组（深度优先）
   */
  flatten(nodes: ElementNode[]): ElementNode[] {
    const result: ElementNode[] = [];
    
    const traverse = (node: ElementNode) => {
      result.push(node);
      for (const child of node.children) {
        traverse(child);
      }
    };
    
    for (const node of nodes) {
      traverse(node);
    }
    
    return result;
  }
  
  /**
   * Calculate priority based on element type
   */
  private calculatePriority(type: string): number {
    const priorities: Record<string, number> = {
      'button': 8,
      'link': 7,
      'input': 7,
      'textbox': 7,
      'searchbox': 8,
      'select': 6,
      'heading': 5,
      'listitem': 4,
      'list': 3,
      'navigation': 2,
      'div': 1,
      'StaticText': 1
    };
    
    return priorities[type] || 0;
  }
  
  /**
   * Check if element type has interaction capability
   */
  private hasInteraction(type: string, line: string): boolean {
    const interactiveTypes = [
      'button', 'link', 'input', 'textbox', 'searchbox',
      'select', 'option', 'checkbox', 'radio'
    ];
    
    return interactiveTypes.includes(type) || line.includes('[cursor=pointer]');
  }
}