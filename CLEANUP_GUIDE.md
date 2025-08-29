# Stagehand 精简指南

## 测试标准
**唯一标准**：`tsx examples/user-control.ts` 必须成功运行

## 核心功能依赖
user-control.ts 使用的核心功能：
1. `new Stagehand()` - 创建实例
2. `stagehand.init()` - 初始化浏览器
3. `page.getPageStructure()` - 获取 A11y Tree 结构
4. `page.actByEncodedId()` - 通过 EncodedId 操作元素
5. `stagehand.close()` - 关闭浏览器

## 必须保留的核心文件
- `lib/a11y/utils.ts` - A11y Tree 提取核心（getAccessibilityTree）
- `lib/StagehandPage.ts` - 包含 getPageStructure() 和 actByEncodedId()
- `lib/index.ts` - Stagehand 类主入口
- `lib/dom/` - DOM 操作脚本目录

## 删除策略

### 操作流程
1. **删除** - 删除一个文件或代码块
2. **测试** - 运行 `tsx examples/user-control.ts`
3. **处理** - 如果报错，只删除引起错误的引用
4. **验证** - 确保测试通过
5. **继续** - 进入下一个删除

### 关键原则
- **不改核心逻辑** - getPageStructure() 和 actByEncodedId() 已经工作正常
- **只删不改** - 删除文件和引用，不重写逻辑
- **逐步进行** - 一次一个文件，立即测试
- **最小化改动** - 只处理直接报错，不预判

## 可删除清单

### 第一批：独立文件
- [x] `lib/cache.ts` - 缓存相关
- [x] `lib/logger.ts` - 日志系统
- [x] `lib/version.ts` - 版本管理
- [x] `lib/CHANGELOG.md` - 变更日志
- [x] `lib/package.json` - 包配置

### 第二批：已注释的代码
- [ ] `lib/index.ts` 中所有注释掉的代码块
- [ ] `lib/StagehandPage.ts` 中所有注释掉的方法

### 第三批：辅助文件
- [ ] `lib/utils.ts` - 检查依赖后内联或删除
- [ ] `lib/StagehandContext.ts` - 如果只是包装可以简化
- [ ] `lib/dom/genDomScripts.ts` - 构建工具
- [ ] `lib/dom/global.d.ts` - TypeScript 声明

### 第四批：可能的简化
- [ ] `lib/dom/elementCheckUtils.ts` - 确认 actByEncodedId 不依赖
- [ ] `lib/dom/process.ts` - 确认 a11y/utils.ts 不依赖

## 最终目标
保持最少的文件数量，只要能运行 user-control.ts 即可。理想状态是 3-4 个核心文件。