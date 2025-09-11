---
allowed-tools: Bash, Read
description: Manage postScript functions with HTML structure analysis
---

# PostScript Management

根据用户需求 `$ARGUMENTS` 调用 postScript 工具进行增删改查操作。

## 工具位置
- **postScript 工具**：`src/utils/postScript.ts`
- **文档**：`docs/postScript.md`

## 核心原则

### 添加脚本时必须遵循：

1. **先分析 HTML 结构**
   - 读取实际的 HTML 数据文件
   - 分析标签层次、class 名称、属性、文本分布
   - 理解重复模式和数据结构

2. **精准选择器要求**
   - 基于实际结构编写准确的 cheerio 选择器
   - **禁止猜测性选择器**
   - **禁止 fallback 方式**（如 `h1, h2, .title`）
   - 选择器必须一步到位，精准命中

3. **100% 完成原则**
   - 要么完全满足用户需求
   - 要么如实告知无法完成
   - **不存在"部分完成"**
   - **不能将就或给出模糊结果**
   - **必须满足精准选择器要求：只要用了模糊选择器，就是失败**

## 执行步骤

### 添加脚本时的完整流程：

1. **读取 HTML 数据**
```bash
# 先读取对应的数据文件分析结构
```

2. **结构分析**
   - 仔细观察 HTML 的实际结构
   - 识别数据提取的可行性
   - 确认选择器的精确路径

3. **脚本生成**（仅在确认可行时）
```bash
tsx -e "
import { addPostScript } from './src/utils/postScript';
addPostScript('pageId', actionIndex, '基于实际结构的精准脚本');
console.log('Script added');
"
```

4. **诚实反馈**
   - 如果无法精准提取：直接说明原因
   - 如果结构不清晰：如实告知
   - 如果需求无法满足：不提供近似结果

## 三个核心函数

### 执行脚本 (runPostScript)  
```bash
tsx -e "
import { runPostScript } from './src/utils/postScript';
runPostScript('pageId', actionIndex).then(result => console.log('Result:', JSON.stringify(result, null, 2)));
"
```

### 删除脚本 (removePostScript)
```bash
tsx -e "
import { removePostScript } from './src/utils/postScript';
removePostScript('pageId', actionIndex, scriptIndex);
console.log('Script removed');
"
```

## 根据用户需求执行

- 如果用户说要**添加/新增/创建**脚本 → 先分析 HTML 结构，确认可行后使用 addPostScript
- 如果用户说要**运行/执行**脚本 → 使用 runPostScript  
- 如果用户说要**删除/移除**脚本 → 使用 removePostScript
- 如果用户说要**查看**脚本 → 读取 actions.json 显示 postScripts 数组