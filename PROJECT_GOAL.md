# Stagehand 改造计划

## 目标
将 Stagehand 改造成一个**无需 AI 的纯自动化框架**

## 核心需求

### 1. 去除 AI 依赖
- ✅ 不需要任何 API Key
- ✅ 不调用 LLM 服务
- ✅ 完全本地运行

### 2. 保留核心能力
- ✅ **页面结构提取** - 获取 Accessibility Tree
- ⚠️ **元素操作** - 基于 EncodedId 或选择器操作元素
- ✅ **直接运行** - 使用 tsx 运行 TypeScript 源码

### 3. 新增方法
- `getPageStructure()` - 获取页面 A11y Tree 结构
- `actByEncodedId()` - 通过 EncodedId 直接操作元素

## 使用模式
```typescript
// 不需要 AI，完全控制逻辑
const stagehand = new Stagehand({ env: "LOCAL" });
await stagehand.init();

// 获取页面结构
const pageData = await page.getPageStructure();

// 分析结构（用户自己的逻辑）
const searchBoxId = findSearchBox(pageData);

// 直接操作
await page.actByEncodedId(searchBoxId, "fill", ["搜索内容"]);
```

## 当前进展

### ✅ 已完成
- 修改 package.json 支持 tsx 直接运行
- 实现 getPageStructure() 方法
- 修复 Proxy 机制让新方法可访问
- 理解 Stagehand 内部机制

### ⚠️ 待解决
- 元素操作在某些网站失败（反自动化问题）
- 需要更多测试用例验证

## 下一步
1. 在简单网站测试框架功能
2. 完善元素操作方法
3. 编写使用文档