# 迭代探索式爬虫开发

## 核心流程

每一步操作都遵循以下循环：

1. **获取页面结构** - 保存当前页面的 A11y Tree
2. **分析定位元素** - 读取结构，找到目标元素的准确 ID  
3. **执行单一操作** - 基于 ID 执行一个原子操作
4. **验证并继续** - 检查结果，进入下一轮循环

## 示例流程

```typescript
// 第1轮：打开页面
await page.goto("https://amazon.com");
const structure1 = await page.getPageStructure();
// 分析 structure1，找到搜索框 ID

// 第2轮：输入搜索词
await page.actByEncodedId("searchBoxId", "fill", ["卷发棒"]);
const structure2 = await page.getPageStructure();
// 分析 structure2，找到搜索按钮 ID

// 第3轮：点击搜索
await page.actByEncodedId("searchBtnId", "click");
const structure3 = await page.getPageStructure();
// 分析 structure3，继续下一步...
```

## 关键原则

- **单步原子性** - 每次只做一个操作
- **基于观察决策** - 不预设元素位置，通过实际结构确定
- **累积构建** - 每个成功步骤都记录下来，最终形成完整脚本