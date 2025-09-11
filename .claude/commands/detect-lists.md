---
allowed-tools: Bash
description: 检测当前 SimplePage 页面的列表容器并提取内容
---

# 检测并提取页面列表

## 任务
对当前 SimplePage 页面进行列表容器检测，并尝试提取内容。

## 执行步骤

1. 根据上下文确定当前页面的 pageId（或使用 `$ARGUMENTS` 提供的 pageId）

2. 调用 structure API 获取 HTML 文件路径：
   ```bash
   curl -s http://localhost:3100/api/pages/{pageId}/structure | jq -r '.htmlPath'
   ```

3. 运行检测脚本分析 HTML：
   ```bash
   tsx examples/test-detect-lists.ts {htmlPath} --analyze
   ```

4. 对检测到的前 3 个最有可能的列表容器，尝试提取内容：
   - 如果 XPath 包含 `@id`，转换为 ID 选择器
   - 调用 get-list-by-parent API：
   ```bash
   curl -X POST http://localhost:3100/api/pages/{pageId}/get-list-by-parent \
     -H "Content-Type: application/json" \
     -d '{"selector": "{selector}"}'
   ```

5. 展示结果：
   - 显示检测到的列表容器
   - 显示成功提取的列表内容
   - 标注哪个容器提取成功，包含多少项

## 参数
- `$ARGUMENTS`：可选，指定特定的 pageId