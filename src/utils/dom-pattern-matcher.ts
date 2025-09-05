/**
 * DOM Pattern Matcher Implementation
 * 基于"类型-深度"统计的列表检测算法
 */

import type { ElementNode } from '../types/outline';
import * as fs from 'fs';

// 特征向量类型：键为"类型+局部上下文"，值为出现次数
type FeatureVector = Map<string, number>;

// 局部上下文指纹
interface ContextFingerprint {
  self: string;
  parent: string;
  children: string[];
  siblings: string[];
}

export class DOMPatternMatcher {
  private readonly DEFAULT_THRESHOLD = 0.7; // 默认相似度阈值 70%
  
  /**
   * 获取节点的兄弟类型列表
   */
  private getSiblingTypes(node: ElementNode, parent: ElementNode | null): string[] {
    if (!parent) return [];
    
    const siblings = parent.children
      .filter(child => child !== node && child.type !== 'LineBreak')
      .map(child => child.type);
    
    // 返回去重排序的类型列表
    return [...new Set(siblings)].sort();
  }
  
  /**
   * 获取节点的上下文指纹
   */
  private getContextFingerprint(node: ElementNode, parent: ElementNode | null): ContextFingerprint {
    const children = node.children
      .filter(child => child.type !== 'LineBreak')
      .map(child => child.type);
    
    return {
      self: node.type,
      parent: parent?.type || 'root',
      children: [...new Set(children)].sort(),
      siblings: this.getSiblingTypes(node, parent)
    };
  }
  
  /**
   * 生成指纹的字符串键
   */
  private fingerprintToKey(fp: ContextFingerprint): string {
    return `${fp.self}|P:${fp.parent}|C:[${fp.children.join(',')}]|S:[${fp.siblings.join(',')}]`;
  }
  
  /**
   * 提取节点的局部结构特征向量
   * 递归遍历所有子节点，统计每个"类型+局部上下文"的出现次数
   */
  private extractFeatureVector(node: ElementNode, parent: ElementNode | null = null): FeatureVector {
    const vector: FeatureVector = new Map();
    
    // 递归收集特征
    const collectFeatures = (n: ElementNode, p: ElementNode | null) => {
      // 忽略 LineBreak 元素
      if (n.type === 'LineBreak') {
        n.children.forEach(child => {
          collectFeatures(child, n);
        });
        return;
      }
      
      // 获取上下文指纹
      const fingerprint = this.getContextFingerprint(n, p);
      const featureKey = this.fingerprintToKey(fingerprint);
      
      // 统计特征
      vector.set(featureKey, (vector.get(featureKey) || 0) + 1);
      
      // 递归处理子节点
      n.children.forEach(child => {
        collectFeatures(child, n);
      });
    };
    
    // 从当前节点开始收集
    collectFeatures(node, parent);
    
    return vector;
  }
  
  /**
   * 计算两个特征向量的相似度
   * 返回相同维度占总维度的百分比
   */
  private calculateStructuralSimilarity(vectorA: FeatureVector, vectorB: FeatureVector): number {
    // 获取所有唯一的特征键
    const allKeys = new Set([...vectorA.keys(), ...vectorB.keys()]);
    
    if (allKeys.size === 0) return 1; // 两个空向量视为相同
    
    // 统计相同维度的数量
    let sameCount = 0;
    for (const key of allKeys) {
      const countA = vectorA.get(key) || 0;
      const countB = vectorB.get(key) || 0;
      if (countA === countB) {
        sameCount++;
      }
    }
    
    // 返回相似度百分比
    return sameCount / allKeys.size;
  }
  
  /**
   * 提取交互元素的类型统计
   */
  private extractInteractionStats(node: ElementNode): Map<string, number> {
    const stats = new Map<string, number>();
    
    const collect = (n: ElementNode) => {
      // 统计 link 和 button 的数量
      if (n.type === 'link' || n.type === 'button') {
        stats.set(n.type, (stats.get(n.type) || 0) + 1);
      }
      
      // 递归处理子节点
      n.children.forEach(child => collect(child));
    };
    
    collect(node);
    return stats;
  }
  
  /**
   * 提取交互元素的文本内容
   */
  private extractInteractionTexts(node: ElementNode): Set<string> {
    const texts = new Set<string>();
    
    const collect = (n: ElementNode) => {
      // 收集 link 和 button 的文本内容
      if ((n.type === 'link' || n.type === 'button') && n.content) {
        texts.add(n.content);
      }
      
      // 递归处理子节点
      n.children.forEach(child => collect(child));
    };
    
    collect(node);
    return texts;
  }
  
  /**
   * 计算交互元素类型和数量的一致性（20%权重）
   */
  private calculateInteractionTypeConsistency(nodeA: ElementNode, nodeB: ElementNode): number {
    const statsA = this.extractInteractionStats(nodeA);
    const statsB = this.extractInteractionStats(nodeB);
    
    // 如果都没有交互元素，返回1（完全一致）
    if (statsA.size === 0 && statsB.size === 0) return 1;
    
    // 如果只有一个有交互元素，返回0
    if (statsA.size === 0 || statsB.size === 0) return 0;
    
    // 检查类型和数量的一致性
    const allTypes = new Set([...statsA.keys(), ...statsB.keys()]);
    let matchCount = 0;
    
    for (const type of allTypes) {
      const countA = statsA.get(type) || 0;
      const countB = statsB.get(type) || 0;
      if (countA === countB) {
        matchCount++;
      }
    }
    
    return matchCount / allTypes.size;
  }
  
  /**
   * 计算文本匹配奖励（10%权重）
   */
  private calculateTextMatchBonus(nodeA: ElementNode, nodeB: ElementNode): number {
    const textsA = this.extractInteractionTexts(nodeA);
    const textsB = this.extractInteractionTexts(nodeB);
    
    // 如果都没有文本，返回0（没有奖励）
    if (textsA.size === 0 || textsB.size === 0) return 0;
    
    // 检查是否有任何相同的文本
    for (const text of textsA) {
      if (textsB.has(text)) {
        return 1; // 有匹配就给满分
      }
    }
    
    return 0;
  }
  
  /**
   * 计算三层权重相似度（50%结构 + 25%交互类型一致性 + 25%文本匹配奖励）
   */
  private calculateSimilarity(vectorA: FeatureVector, vectorB: FeatureVector, nodeA?: ElementNode, nodeB?: ElementNode): number {
    const structuralSim = this.calculateStructuralSimilarity(vectorA, vectorB);
    
    // 如果提供了节点，计算完整的三层相似度
    if (nodeA && nodeB) {
      const typeConsistency = this.calculateInteractionTypeConsistency(nodeA, nodeB);
      const textBonus = this.calculateTextMatchBonus(nodeA, nodeB);
      
      // 50% 结构 + 25% 交互类型一致性 + 25% 文本匹配奖励
      return structuralSim * 0.5 + typeConsistency * 0.25 + textBonus * 0.25;
    }
    
    // 否则只返回结构相似度
    return structuralSim;
  }
  
  /**
   * 判断两个节点是否相似
   * 与 DOMSimHash 接口兼容
   */
  areSimilar(node1: ElementNode, node2: ElementNode, threshold?: number): boolean {
    const vector1 = this.extractFeatureVector(node1);
    const vector2 = this.extractFeatureVector(node2);
    const similarity = this.calculateSimilarity(vector1, vector2, node1, node2);
    
    return similarity >= (threshold ?? this.DEFAULT_THRESHOLD);
  }
  
  /**
   * 查找最大相似子序列
   * 与 DOMSimHash 接口兼容
   */
  findSimilarSequence(nodes: ElementNode[], threshold?: number): {
    start: number;
    end: number;
    samples: ElementNode[];
    baseHash: number; // 为了接口兼容，这里用0代替
  } | null {
    if (nodes.length < 3) return null;
    
    const actualThreshold = threshold ?? this.DEFAULT_THRESHOLD;
    let maxLen = 0;
    let bestStart = 0;
    let bestEnd = 0;
    let bestSamples: ElementNode[] = [];
    
    // 滑动窗口查找最长相似序列
    for (let i = 0; i <= nodes.length - 3; i++) {
      const baseType = nodes[i].type;
      const baseVector = this.extractFeatureVector(nodes[i]);
      let j = i + 1;
      let similarCount = 1;
      const currentSamples = [nodes[i]];
      
      // 调试：对52个div的情况
      if (nodes.length === 52 && i < 5) {
        console.log(`\nTrying sequence from position ${i} (type: ${baseType})`);
      }
      
      // 记录找到的最长序列
      if (nodes.length === 52 && maxLen >= 3 && i == nodes.length - 3) {
        console.log(`\nFinal best sequence: positions ${bestStart} to ${bestEnd} (${maxLen} items)`);
      }
      
      while (j < nodes.length) {
        // 类型必须相同
        if (nodes[j].type !== baseType) {
          if (similarCount >= 3) break;
          j++;
          continue;
        }
        
        const vector = this.extractFeatureVector(nodes[j]);
        const similarity = this.calculateSimilarity(baseVector, vector, nodes[i], nodes[j]);
        
        // 调试：检查前几个div的相似度
        if (nodes.length === 52 && i === 0 && j < 5) {
          console.log(`Position ${i} vs ${j}: similarity = ${similarity}`);
        }
        
        // 调试：检查位置24附近的相似度
        if (nodes.length === 52 && i === 24 && j >= 25 && j <= 30) {
          console.log(`Position ${i} vs ${j}: similarity = ${similarity}`);
        }
        
        // Debug: Log similarity for list 0-4688
        if (nodes.length === 48) {
          // 输出相邻产品的比较
          if (j === i + 1) {
            console.log(`\n=== Product ${i + 1} vs Product ${j + 1} ===`);
            console.log(`Similarity: ${similarity}`);
            
            // 详细输出产品1和2的比较
            if (i === 0 && j === 1) {
              console.log('\n=== Detailed Product 1 vs Product 2 Analysis ===');
              console.log('Product 1 ref:', nodes[i].ref);
              console.log('Product 2 ref:', nodes[j].ref);
              console.log('Product 1 features (count:', baseVector.size, '):');
              // 只显示前10个特征
              const features1 = Array.from(baseVector.entries()).slice(0, 10);
              features1.forEach(([key, count]) => {
                console.log(`  ${key}: ${count}`);
              });
              if (baseVector.size > 10) console.log(`  ... and ${baseVector.size - 10} more features`);
              
              console.log('\nProduct 2 features (count:', vector.size, '):');
              const features2 = Array.from(vector.entries()).slice(0, 10);
              features2.forEach(([key, count]) => {
                console.log(`  ${key}: ${count}`);
              });
              if (vector.size > 10) console.log(`  ... and ${vector.size - 10} more features`);
              
              const structuralSim = this.calculateStructuralSimilarity(baseVector, vector);
              const typeConsistency = this.calculateInteractionTypeConsistency(nodes[i], nodes[j]);
              const textBonus = this.calculateTextMatchBonus(nodes[i], nodes[j]);
              
              console.log('\n=== Similarity Breakdown ===');
              console.log(`1. Structural Similarity: ${(structuralSim * 100).toFixed(1)}% (weight: 50%)`);
              console.log(`2. Type/Count Consistency: ${(typeConsistency * 100).toFixed(1)}% (weight: 25%)`);
              console.log(`3. Text Match Bonus: ${(textBonus * 100).toFixed(1)}% (weight: 25%)`);
              console.log(`Combined: ${(similarity * 100).toFixed(1)}%`);
              
              // 交互元素统计
              const stats1 = this.extractInteractionStats(nodes[i]);
              const stats2 = this.extractInteractionStats(nodes[j]);
              console.log('\nInteraction Stats:');
              console.log('Product 1:', Object.fromEntries(stats1));
              console.log('Product 2:', Object.fromEntries(stats2));
              
              // 文本内容
              const texts1 = this.extractInteractionTexts(nodes[i]);
              const texts2 = this.extractInteractionTexts(nodes[j]);
              console.log('\nTexts:');
              console.log('Product 1:', Array.from(texts1));
              console.log('Product 2:', Array.from(texts2));
              
              // 显示共同特征
              const commonFeatures: string[] = [];
              const uniqueTo1: string[] = [];
              const uniqueTo2: string[] = [];
              
              const allKeys = new Set([...baseVector.keys(), ...vector.keys()]);
              for (const key of allKeys) {
                const count1 = baseVector.get(key) || 0;
                const count2 = vector.get(key) || 0;
                if (count1 > 0 && count2 > 0) {
                  commonFeatures.push(key);
                } else if (count1 > 0) {
                  uniqueTo1.push(key);
                } else {
                  uniqueTo2.push(key);
                }
              }
              
              console.log('\nFeature Analysis:');
              console.log('Common features:', commonFeatures.length);
              console.log('Unique to Product 1:', uniqueTo1.length);
              console.log('Unique to Product 2:', uniqueTo2.length);
              
              if (commonFeatures.length > 0) {
                console.log('\nSample common features:');
                commonFeatures.slice(0, 5).forEach(f => console.log(`  ${f}`));
              }
              
              // 生成对比文件
              function printNodeTree(node: ElementNode, indent = 0): string {
                let result = ' '.repeat(indent) + node.line + '\n';
                for (const child of node.children) {
                  result += printNodeTree(child, indent + 2);
                }
                return result;
              }
              
              const comparison = `=== Product 1 vs 2 Comparison ===\n\n` +
                               `Product 1 (ref: ${nodes[0].ref}):\n` +
                               `${printNodeTree(nodes[0])}\n` +
                               `${'='.repeat(80)}\n\n` +
                               `Product 2 (ref: ${nodes[1].ref}):\n` +
                               `${printNodeTree(nodes[1])}`;
                               
              fs.writeFileSync('product-1-2-comparison.txt', comparison);
              console.log('\nSaved comparison to product-1-2-comparison.txt');
            }
          }
          
          if (i === 0 && j === 7) {
            console.log('\n=== Comparing product 1 with product 8 ===');
            console.log('Product 1 ref:', nodes[i].ref);
            console.log('Product 8 ref:', nodes[j].ref);
            console.log('Product 1 features:', baseVector);
            console.log('Product 8 features:', vector);
            console.log(`Similarity: ${similarity}`);
            
            const allKeys = new Set([...baseVector.keys(), ...vector.keys()]);
            console.log('\nDifferences:');
            for (const key of allKeys) {
              const count1 = baseVector.get(key) || 0;
              const count8 = vector.get(key) || 0;
              if (count1 !== count8) {
                console.log(`  ${key}: product1=${count1}, product8=${count8}`);
              }
            }
          }
          
          // 总是输出产品8和9的比较
          if (j === 7) {
            const product8Vector = vector;
            const product9Vector = this.extractFeatureVector(nodes[8]);
            const structuralSim89 = this.calculateStructuralSimilarity(product8Vector, product9Vector);
            const typeConsistency89 = this.calculateInteractionTypeConsistency(nodes[7], nodes[8]);
            const textBonus89 = this.calculateTextMatchBonus(nodes[7], nodes[8]);
            const similarity89 = this.calculateSimilarity(product8Vector, product9Vector, nodes[7], nodes[8]);
            
            console.log('\n=== Product 8 vs Product 9 Features ===');
            console.log('Product 8 features:', product8Vector);
            console.log('Product 9 features:', product9Vector);
            
            console.log('\n=== Similarity Breakdown ===');
            console.log(`1. Structural Similarity: ${(structuralSim89 * 100).toFixed(1)}% (weight: 50%)`);
            console.log(`2. Type/Count Consistency: ${(typeConsistency89 * 100).toFixed(1)}% (weight: 25%)`);
            console.log(`3. Text Match Bonus: ${(textBonus89 * 100).toFixed(1)}% (weight: 25%)`);
            console.log(`Combined Similarity: ${(similarity89 * 100).toFixed(1)}%`);
            console.log(`Formula: ${(structuralSim89 * 0.5 * 100).toFixed(1)}% + ${(typeConsistency89 * 0.25 * 100).toFixed(1)}% + ${(textBonus89 * 0.25 * 100).toFixed(1)}% = ${(similarity89 * 100).toFixed(1)}%`);
            
            // 输出交互元素统计
            const stats8 = this.extractInteractionStats(nodes[7]);
            const stats9 = this.extractInteractionStats(nodes[8]);
            console.log('\nInteraction Element Stats:');
            console.log('Product 8:', Object.fromEntries(stats8));
            console.log('Product 9:', Object.fromEntries(stats9));
            
            // 输出文本内容
            const texts8 = this.extractInteractionTexts(nodes[7]);
            const texts9 = this.extractInteractionTexts(nodes[8]);
            console.log('\nInteraction Element Texts:');
            console.log('Product 8:', Array.from(texts8));
            console.log('Product 9:', Array.from(texts9));
            console.log('Common texts:', Array.from(texts8).filter(t => texts9.has(t)));
            
            const allKeys89 = new Set([...product8Vector.keys(), ...product9Vector.keys()]);
            console.log('\nStructural Differences:');
            for (const key of allKeys89) {
              const count8 = product8Vector.get(key) || 0;
              const count9 = product9Vector.get(key) || 0;
              if (count8 !== count9) {
                console.log(`  ${key}: product8=${count8}, product9=${count9}`);
              }
            }
          }
          
          if (i === 0 && j === 8) {
            console.log('\n=== Comparing product 1 with product 9 ===');
            console.log('Product 1 ref:', nodes[i].ref);
            console.log('Product 9 ref:', nodes[j].ref);
            console.log('Product 1 features:', baseVector);
            console.log('Product 9 features:', vector);
            console.log(`Similarity: ${similarity}`);
            
            const allKeys = new Set([...baseVector.keys(), ...vector.keys()]);
            console.log('\nDifferences:');
            for (const key of allKeys) {
              const count1 = baseVector.get(key) || 0;
              const count9 = vector.get(key) || 0;
              if (count1 !== count9) {
                console.log(`  ${key}: product1=${count1}, product9=${count9}`);
              }
            }
            
            // 生成包含完整元素内容的对比文件
            function printNodeTree(node: ElementNode, indent = 0): string {
              let result = ' '.repeat(indent) + node.line + '\n';
              for (const child of node.children) {
                result += printNodeTree(child, indent + 2);
              }
              return result;
            }
            
            const comparison = `=== Product 8 vs 9 Comparison ===\n\n` +
                             `Product 8 (ref: ${nodes[7].ref}):\n` +
                             `${printNodeTree(nodes[7])}\n` +
                             `${'='.repeat(80)}\n\n` +
                             `Product 9 (ref: ${nodes[8].ref}):\n` +
                             `${printNodeTree(nodes[8])}`;
                             
            fs.writeFileSync('product-8-9-comparison.txt', comparison);
            console.log('\nSaved comparison to product-8-9-comparison.txt');
          }
        }
        
        if (similarity >= actualThreshold) {
          // 相似，继续扩展序列
          similarCount++;
          currentSamples.push(nodes[j]);
          if (similarCount >= 3 && similarCount > maxLen) {
            maxLen = similarCount;
            bestStart = i;
            bestEnd = j;
            bestSamples = [...currentSamples];
          }
          // 调试：检查为什么在24停止
          if (nodes.length === 53 && i === 2 && j === 26) {
            console.log(`\nAt position ${j+1}: Similarity ${similarity} >= ${actualThreshold}, continuing...`);
          }
        } else if (similarCount >= 3) {
          // 已找到足够长的序列，结束
          if (nodes.length === 53 && j >= 24 && j <= 28) {
            console.log(`\nSequence check at position ${j} (element ${j+1})`);
            console.log(`Base position: ${i+1}, Current position: ${j+1}`);
            console.log(`Similarity: ${similarity} (threshold: ${actualThreshold})`);
            console.log(`Similar count so far: ${similarCount}`);
          }
          break;
        }
        j++;
      }
    }
    
    if (maxLen >= 3) {
      return {
        start: bestStart,
        end: bestEnd,
        samples: bestSamples,
        baseHash: 0 // 接口兼容
      };
    }
    
    return null;
  }
  
  /**
   * 批量查找所有相似序列
   * 与 DOMSimHash 接口兼容
   */
  findAllSimilarSequences(nodes: ElementNode[], threshold?: number): Array<{
    start: number;
    end: number;
    count: number;
    sample: ElementNode;
    items: ElementNode[];
  }> {
    const sequences: Array<{
      start: number;
      end: number;
      count: number;
      sample: ElementNode;
      items: ElementNode[];
    }> = [];
    
    const processed = new Set<number>();
    const actualThreshold = threshold ?? this.DEFAULT_THRESHOLD;
    
    // 按类型分组
    const typeGroups = new Map<string, {node: ElementNode, index: number}[]>();
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const type = node.type;
      if (!typeGroups.has(type)) {
        typeGroups.set(type, []);
      }
      typeGroups.get(type)!.push({node, index: i});
    }
    
    // 对每个类型组查找相似序列
    for (const [type, group] of typeGroups.entries()) {
      if (group.length < 3) continue;
      
      // 调试：针对53个元素的列表
      if (nodes.length === 53 && type === 'div') {
        console.log(`\n=== Processing div group with ${group.length} items ===`);
        console.log('Div positions:', group.map(g => g.index + 1).join(', '));
      }
      
      // 过滤未处理的节点
      const unprocessed = [];
      const indexMap = [];
      
      for (const item of group) {
        if (!processed.has(item.index)) {
          unprocessed.push(item.node);
          indexMap.push(item.index);
        }
      }
      
      if (unprocessed.length < 3) continue;
      
      const seq = this.findSimilarSequence(unprocessed, actualThreshold);
      
      if (seq) {
        const actualStart = indexMap[seq.start];
        const actualEnd = indexMap[seq.end];
        
        // 调试：记录找到的序列
        if (nodes.length === 53 && type === 'div') {
          console.log(`Found sequence: positions ${actualStart + 1} to ${actualEnd + 1} (${seq.end - seq.start + 1} items)`);
          console.log(`Mapped indices: ${seq.start} to ${seq.end} in unprocessed array of ${unprocessed.length} items`);
        }
        
        sequences.push({
          start: actualStart,
          end: actualEnd,
          count: seq.end - seq.start + 1,
          sample: nodes[actualStart],
          items: seq.samples
        });
        
        // 标记已处理的节点
        for (let k = seq.start; k <= seq.end; k++) {
          processed.add(indexMap[k]);
        }
      }
    }
    
    return sequences;
  }
  
  /**
   * 清除缓存（接口兼容，实际上这个算法不需要缓存）
   */
  clearCache(): void {
    // No cache needed for this algorithm
  }
}