# SimplePage 启动指南

本文档介绍如何启动 SimplePage 的前后端服务。

## 项目结构

- **SimplePage Server** - 后端 API 服务器，提供网页自动化 API
- **Simple Page Viewer** - 前端可视化界面，用于查看和调试页面操作

## 启动步骤

### 1. 启动后端服务器

```bash
# 在 stagehand 项目根目录下
PORT=3100 SCREENSHOT=true pnpm run server
```

**重要**：务必添加 `SCREENSHOT=true` 参数以启用截图功能，这样每个操作都会自动保存截图，便于调试和回溯。

服务器将在 http://localhost:3100 启动，提供以下 API 端点：
- GET `/health` - 健康检查
- POST `/api/pages` - 创建新页面
- GET `/api/pages/:pageId/structure` - 获取页面结构
- POST `/api/pages/:pageId/act-id` - 通过 EncodedId 操作元素
- POST `/api/pages/:pageId/act-xpath` - 通过 XPath 操作元素
- 更多端点详见启动日志

### 2. 启动前端界面

```bash
# 进入 simple-page-viewer 目录
cd simple-page-viewer

# 启动开发服务器
pnpm run dev
```

前端将在 http://localhost:3102 启动（使用 Next.js + Turbopack）。

## 端口说明

- **3100** - SimplePage API 服务器
- **3102** - Simple Page Viewer 前端界面

## 快速重启

如果需要重启服务，可以按照以下步骤：

### 查找并终止进程

```bash
# 查找后端进程
lsof -i :3100 | grep LISTEN

# 查找前端进程  
lsof -i :3102 | grep LISTEN

# 终止进程（替换 PID 为实际进程号）
kill -9 [PID]
```

### 重新启动

按照上述启动步骤重新启动服务即可。

## 环境变量

- `PORT` - API 服务器端口，默认 3100
- `SCREENSHOT` - **是否启用截图功能，强烈建议设置为 `true` 启用**。启用后每个操作都会保存截图到 `/tmp/simplepage/{pageId}/`，对于调试和操作回溯非常重要

## 注意事项

1. 确保端口未被占用
2. 前端依赖后端 API 服务，建议先启动后端
3. 操作记录默认保存在 `/tmp/simplepage/{pageId}/`
4. 用户数据保存在 `~/.simple-page-server/user-data`