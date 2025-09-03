/**
 * DOM SimHash Implementation
 * 用于检测DOM树结构相似性
 */

import type { ElementNode } from '../types/outline';

export class DOMSimHash {
  private readonly HASH_BITS = 32;
  private hashCache = new Map<ElementNode, number>();

  /**
   * 提取DOM节点的结构特征
   */
  extractFeatures(node: ElementNode): string[] {
    const features: string[] = [];
    
    // 1. 深度分布特征：统计各类型元素的深度
    features.push(this.getDepthDistribution(node));
    
    // 2. 形状特征：宽度分布
    features.push(this.getShapeSignature(node));
    
    // 3. 类型计数特征
    features.push(this.getTypeCountSignature(node));
    
    // 4. 交互特征
    if (this.hasInteractiveElements(node)) {
      features.push('interactive');
    }
    
    // 5. 交互指纹特征 - 具体的交互元素内容
    features.push(this.getInteractionSignature(node));
    
    // 6. 深度特征
    features.push(`d${this.getMaxDepth(node)}`);
    
    // 调试：打印特定节点的特征
    if (node.type === 'div' && node.ref === '0-7815') {
      console.log(`[DEBUG] 节点35特征: ${JSON.stringify(features)}`);
    }
    if (node.type === 'div' && node.ref === '0-7217') {
      console.log(`[DEBUG] 节点28特征: ${JSON.stringify(features)}`);
    }
    
    return features;
  }

  /**
   * 获取深度分布特征 - 统计各类型元素的深度
   */
  private getDepthDistribution(node: ElementNode): string {
    const distribution = new Map<string, number>();
    
    // 递归统计所有子元素的深度
    const analyzeElement = (n: ElementNode) => {
      const depth = this.getMaxDepth(n);
      
      // 归一化元素类型
      let normalizedType = n.type;
      if (['div', 'span', 'section', 'article'].includes(n.type)) {
        normalizedType = 'container';
      } else if (['StaticText', 'text'].includes(n.type)) {
        normalizedType = 'text';
      } else if (['link', 'a'].includes(n.type)) {
        normalizedType = 'link';
      } else if (['heading', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(n.type)) {
        normalizedType = 'heading';
      }
      
      // 只统计重要元素类型
      if (['container', 'link', 'button', 'heading'].includes(normalizedType)) {
        const key = `d${depth}-${normalizedType}`;
        distribution.set(key, (distribution.get(key) || 0) + 1);
      }
      
      // 递归分析子元素
      n.children.forEach(analyzeElement);
    };
    
    // 分析所有子元素（不包括根节点）
    node.children.forEach(analyzeElement);
    
    // 转换为特征字符串
    const features = Array.from(distribution.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => {
        // 将数量归类为范围
        const range = count === 1 ? '1' : count <= 3 ? '2-3' : count <= 5 ? '4-5' : '6+';
        return `${key}:${range}`;
      })
      .join(',');
    
    return features || 'empty';
  }

  /**
   * 获取形状签名 - 树的宽度分布
   */
  private getShapeSignature(node: ElementNode): string {
    const widths: number[] = [node.children.length];
    
    // 记录前3个子节点的宽度
    for (let i = 0; i < Math.min(3, node.children.length); i++) {
      widths.push(node.children[i].children.length);
    }
    
    return 'w' + widths.join('-');
  }

  /**
   * 获取类型计数签名
   */
  private getTypeCountSignature(node: ElementNode): string {
    const counts = new Map<string, number>();
    
    function count(n: ElementNode, depth: number) {
      if (depth > 2) return; // 只统计前3层
      
      const type = n.type;
      counts.set(type, (counts.get(type) || 0) + 1);
      n.children.forEach(c => count(c, depth + 1));
    }
    
    count(node, 0);
    
    // 只记录重要类型的首字母和数量
    const important = ['button', 'link', 'text', 'img', 'heading', 'checkbox', 'radio'];
    const sig = important
      .map(t => {
        const c = counts.get(t) || 0;
        return c > 0 ? `${t[0]}${c}` : '';
      })
      .filter(s => s)
      .join('');
    
    return sig || 'empty';
  }

  /**
   * 检查是否有交互元素
   */
  private hasInteractiveElements(node: ElementNode): boolean {
    if (node.line.includes('[cursor=pointer]')) {
      return true;
    }
    
    // 递归检查子节点（限制深度）
    function check(n: ElementNode, depth: number): boolean {
      if (depth > 2) return false;
      
      if (n.type === 'button' || n.type === 'link' || n.type === 'checkbox' || n.type === 'radio') {
        return true;
      }
      
      return n.children.some(c => check(c, depth + 1));
    }
    
    return check(node, 0);
  }

  /**
   * 获取交互元素指纹 - 收集所有有内容的交互元素
   */
  private getInteractionSignature(node: ElementNode): string {
    const interactions: string[] = [];
    
    function collectInteractions(n: ElementNode, depth: number) {
      if (depth > 3) return; // 限制深度
      
      // 只收集有内容的交互元素
      if ((n.type === 'button' || n.type === 'link') && n.content && n.content.trim()) {
        // 生成指纹：类型+标准化的文本
        const normalizedText = n.content.trim().toLowerCase()
          .replace(/\s+/g, ' ') // 标准化空白
          .substring(0, 50); // 限制长度
        interactions.push(`${n.type[0]}:${normalizedText}`);
      }
      
      n.children.forEach(c => collectInteractions(c, depth + 1));
    }
    
    collectInteractions(node, 0);
    
    // 返回排序后的指纹，确保顺序一致
    if (interactions.length === 0) return 'no-interaction';
    return 'ia:' + interactions.sort().join('|');
  }

  /**
   * 获取最大深度
   */
  private getMaxDepth(node: ElementNode): number {
    if (node.children.length === 0) return 0;
    return 1 + Math.max(...node.children.map(c => this.getMaxDepth(c)));
  }

  /**
   * DJB2 hash算法 - 简单快速
   */
  private djb2Hash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i); // hash * 33 + c
    }
    return hash >>> 0; // 转为无符号整数
  }

  /**
   * 特征权重
   */
  private getWeight(feature: string): number {
    if (feature.includes('d') && feature.includes('-') && feature.includes(':')) return 5;  // 深度分布特征最重要
    if (feature.startsWith('w')) return 3; // 形状特征
    if (feature.startsWith('ia:')) return 2; // 交互指纹特征
    if (feature.startsWith('d') && !feature.includes('-')) return 2; // 简单深度特征
    return 1;
  }

  /**
   * 计算SimHash值
   */
  computeHash(node: ElementNode): number {
    // 缓存检查
    if (this.hashCache.has(node)) {
      return this.hashCache.get(node)!;
    }
    
    const features = this.extractFeatures(node);
    const vector = new Array(this.HASH_BITS).fill(0);
    
    for (const feature of features) {
      const hash = this.djb2Hash(feature);
      const weight = this.getWeight(feature);
      
      for (let i = 0; i < this.HASH_BITS; i++) {
        const bit = (hash >> i) & 1;
        vector[i] += bit ? weight : -weight;
      }
    }
    
    // 降维：正数->1, 负数->0
    let simhash = 0;
    for (let i = 0; i < this.HASH_BITS; i++) {
      if (vector[i] > 0) {
        simhash |= (1 << i);
      }
    }
    
    this.hashCache.set(node, simhash);
    return simhash;
  }

  /**
   * 计算汉明距离
   */
  hammingDistance(hash1: number, hash2: number): number {
    let xor = hash1 ^ hash2;
    let count = 0;
    
    while (xor) {
      count += xor & 1;
      xor >>>= 1;
    }
    
    return count;
  }

  /**
   * 判断两个节点是否相似
   */
  areSimilar(node1: ElementNode, node2: ElementNode, threshold = 3): boolean {
    const hash1 = this.computeHash(node1);
    const hash2 = this.computeHash(node2);
    const distance = this.hammingDistance(hash1, hash2);
    return distance <= threshold;
  }

  /**
   * 查找最大相似子序列
   * 不要求从第一个元素开始
   */
  findSimilarSequence(nodes: ElementNode[]): {
    start: number;
    end: number;
    samples: ElementNode[];
    baseHash: number;
  } | null {
    if (nodes.length < 3) return null;
    
    // console.log(`[findSimilarSequence] 开始查找，共${nodes.length}个节点`);
    let maxLen = 0;
    let bestStart = 0;
    let bestEnd = 0;
    let bestBaseHash = 0;
    let bestSamples: ElementNode[] = [];
    
    // 滑动窗口找最长相似序列
    for (let i = 0; i <= nodes.length - 3; i++) {  // 修复：允许检查最后3个节点
      const baseType = nodes[i].type;  // 获取基准类型
      const baseHash = this.computeHash(nodes[i]);
      let j = i + 1;
      let similarCount = 1;
      const currentSamples = [nodes[i]];
      
      // 向后扩展相似序列
      while (j < nodes.length) {
        // 首先检查类型是否相同
        if (nodes[j].type !== baseType) {
          // 类型不同，检查是否已有足够长的序列
          if (similarCount >= 3) {
            break;
          }
          j++;
          continue;
        }
        
        const hash = this.computeHash(nodes[j]);
        const distance = this.hammingDistance(baseHash, hash);
        
        // 调试：打印详细的距离信息
        if (nodes[i].type === 'div' && j - i === 7) {
          console.log(`[DEBUG] 比较div ${i} 和 ${j}:`);
          console.log(`  节点${i}: ${nodes[i].line.substring(0, 100)}`);
          console.log(`  节点${j}: ${nodes[j].line.substring(0, 100)}`);
          console.log(`  Hash${i}: ${baseHash.toString(2).padStart(32, '0')}`);
          console.log(`  Hash${j}: ${hash.toString(2).padStart(32, '0')}`);
          console.log(`  距离: ${distance}`);
        }
        
        // 调试：比较缩进20的div节点
        if (nodes[i].type === 'div' && nodes[j].type === 'div' && j - i === 1 && j === 16) {
          console.log(`[DEBUG] 比较缩进20的div ${i} 和 ${j}:`);
          console.log(`  节点${i}: ${nodes[i].ref} - ${nodes[i].line.substring(0, 80)}`);
          console.log(`  节点${j}: ${nodes[j].ref} - ${nodes[j].line.substring(0, 80)}`);
          console.log(`  Hash${i}: ${baseHash.toString(2).padStart(32, '0')}`);
          console.log(`  Hash${j}: ${hash.toString(2).padStart(32, '0')}`);
          console.log(`  距离: ${distance}`);
          
          // 打印特征
          const features1 = this.extractFeatures(nodes[i]);
          const features2 = this.extractFeatures(nodes[j]);
          console.log(`  节点${i}特征: ${JSON.stringify(features1)}`);
          console.log(`  节点${j}特征: ${JSON.stringify(features2)}`);
        }
        
        if (distance <= 3) {
          // 相似，继续扩展
          similarCount++;
          currentSamples.push(nodes[j]);
          if (similarCount >= 3 && similarCount > maxLen) {  // 修复：只在>=3时更新
            maxLen = similarCount;
            bestStart = i;
            bestEnd = j;
            bestBaseHash = baseHash;
            bestSamples = [...currentSamples];
          }
        } else if (similarCount >= 3) {
          // 已找到足够长的序列，可以结束
          // console.log(`[findSimilarSequence] 在位置${i}找到了${similarCount}个相似节点，因距离${distance}>3而停止`);
          break;
        } else {
          // 重置搜索，继续寻找下一个序列
          // console.log(`[findSimilarSequence] 位置${i}的节点与${j}不相似(距离${distance})，相似数只有${similarCount}，继续搜索`);
        }
        j++;
      }
    }
    
    if (maxLen >= 3) {
      // console.log(`[findSimilarSequence] 找到最长序列：起始${bestStart}，结束${bestEnd}，长度${maxLen}`);
      return {
        start: bestStart,
        end: bestEnd,
        samples: bestSamples,
        baseHash: bestBaseHash
      };
    }
    
    return null;
  }

  /**
   * 批量查找所有相似序列
   */
  findAllSimilarSequences(nodes: ElementNode[]): Array<{
    start: number;
    end: number;
    count: number;
    sample: ElementNode;
    items: ElementNode[];  // 添加所有匹配的节点
  }> {
    const sequences: Array<{
      start: number;
      end: number;
      count: number;
      sample: ElementNode;
      items: ElementNode[];
    }> = [];
    
    // console.log(`[findAllSimilarSequences] 开始处理${nodes.length}个节点`);
    const processed = new Set<number>();
    
    // 先按类型分组
    const typeGroups = new Map<string, {node: ElementNode, index: number}[]>();
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const type = node.type;
      if (!typeGroups.has(type)) {
        typeGroups.set(type, []);
      }
      typeGroups.get(type)!.push({node, index: i});
    }
    
    // 对每个类型组分别查找相似序列
    for (const [type, group] of typeGroups.entries()) {
      // console.log(`[findAllSimilarSequences] 类型${type}有${group.length}个节点`);
      if (group.length < 3) continue;
      
      // 过滤出未处理的节点
      const unprocessed = [];
      const indexMap = [];
      
      for (const item of group) {
        if (!processed.has(item.index)) {
          unprocessed.push(item.node);
          indexMap.push(item.index);
        }
      }
      
      // console.log(`[findAllSimilarSequences] 类型${type}：总共${group.length}个节点，未处理${unprocessed.length}个`);
      
      if (unprocessed.length < 3) continue;
      
      const seq = this.findSimilarSequence(unprocessed);
      
      if (seq) {
        const actualStart = indexMap[seq.start];
        const actualEnd = indexMap[seq.end];
        
        // console.log(`[findAllSimilarSequences] 类型${type}找到序列：索引${actualStart}-${actualEnd}，共${seq.end - seq.start + 1}个`);
        
        sequences.push({
          start: actualStart,
          end: actualEnd,
          count: seq.end - seq.start + 1,
          sample: nodes[actualStart],
          items: seq.samples  // 包含所有匹配的节点
        });
        
        // 标记已处理的节点
        for (let k = seq.start; k <= seq.end; k++) {
          processed.add(indexMap[k]);
        }
        
        // console.log(`[findAllSimilarSequences] 已处理${seq.end - seq.start + 1}个节点，剩余${group.length - processed.size}个div节点未处理`);
      }
    }
    
    return sequences;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.hashCache.clear();
  }
}