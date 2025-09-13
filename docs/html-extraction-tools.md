# HTML 提取和清理工具链

## 工具概述

### 1. detectLists
- 识别页面中的列表结构
- 返回 XPath 路径数组
- 性能优化：O(n²) → O(20²)

### 2. extract-by-selector.ts
- 提取指定元素的 HTML
- 支持 CSS 选择器和 XPath
- 用法：`tsx extract-by-selector.ts <html-file> <selector> <output-file>`

### 3. clean-html.ts
- 清理和格式化 HTML
- 移除无用标签（script, style, link, meta 等）
- 使用 prettier 格式化
- 智能处理 HTML 片段
- 用法：`tsx clean-html.ts <input-file> <output-file>`

## 配合流程

```bash
# 1. 发现列表结构
tsx test-detect-lists.ts page.html

# 2. 提取元素
tsx extract-by-selector.ts page.html "/xpath/or/.css-selector" output/element.html

# 3. 清理内容
tsx clean-html.ts output/element.html output/clean.html
```

## 输出规范

- 临时文件存放在 `output/` 目录
- 清理后的 HTML 具有正确缩进和格式化
- 移除空元素和压缩空白字符