# Stagehand 无 AI 架构设计

## 核心理念
改造 Stagehand，保留其强大的页面理解机制，去除 AI 依赖，让用户完全控制自动化逻辑。

## 架构流程

### 原始 Stagehand 流程（依赖 AI）
```
页面 → A11y Tree → AI 分析 → 选择元素 → 执行操作
```

### 改造后流程（用户控制）
```
页面 → A11y Tree → 用户逻辑 → 选择元素 → 执行操作
```

## 核心机制

### 1. 页面结构提取
使用 Stagehand 原有的 Accessibility Tree 机制：
- Chrome DevTools Protocol 获取 A11y Tree
- 生成 EncodedId（格式：`frameId-backendNodeId`）
- 建立 EncodedId → XPath 映射

### 2. 用户逻辑层
用户基于 A11y Tree 自己实现逻辑：
```typescript
// 示例：用户自定义的元素查找逻辑
function findSearchBox(structure: string): string {
  const lines = structure.split('\n');
  const searchBox = lines.find(line => line.includes('textbox'));
  return extractEncodedId(searchBox); // 返回如 "0-10"
}
```

### 3. 元素操作
基于 EncodedId 和 XPath 映射执行操作：
```typescript
// 内部实现
async function actByEncodedId(encodedId: string, method: string, args: any[]) {
  const xpath = xpathMap[encodedId];
  const element = page.locator(`xpath=${xpath}`);
  return element[method](...args);
}
```

## 关键组件

### StagehandPage 扩展
- `getPageStructure()` - 暴露 A11y Tree 和映射
- `actByEncodedId()` - 基于 EncodedId 操作元素

### 数据结构
```typescript
interface PageStructure {
  simplified: string;        // A11y Tree 文本格式
  xpathMap: Record<string, string>;  // EncodedId → XPath
  tree: AccessibilityNode;   // 原始树结构
}
```

## 使用示例

```typescript
// 1. 初始化（无需 API Key）
const stagehand = new Stagehand({ env: "LOCAL" });
await stagehand.init();

// 2. 获取页面结构
const pageData = await page.getPageStructure();
console.log(pageData.simplified); // 查看 A11y Tree

// 3. 用户分析和决策
const buttonId = findButtonByText(pageData.simplified, "提交");

// 4. 执行操作
await page.actByEncodedId(buttonId, "click");
```

## 优势

1. **无需 AI API** - 完全本地运行
2. **保留强大机制** - 利用 Stagehand 的 A11y Tree 提取
3. **完全可控** - 用户决定所有操作逻辑
4. **可调试** - 能看到完整的页面结构
5. **可扩展** - 用户可以构建自己的逻辑层

## 注意事项

- 这不是为了绕过反自动化机制
- 这不是为了创建新的选择器系统
- 核心是利用 Stagehand 已有的页面理解能力
- 重点是架构的可行性，而非特定网站的成功率