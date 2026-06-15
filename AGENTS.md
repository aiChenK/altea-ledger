# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指导。

## 项目概述

阿尔特里亚大陆考勤簿（altea-ledger，龙之谷关卡与状态记录程序）是一个全栈 Web 应用，用于追踪龙之谷游戏中多角色的进度——每日签到、每周副本完成情况、资产数量、金鹅 Buff 计时器和全局备忘录。用于替代手动 Excel 记录方式。所有界面文本均为中文。

## 常用命令

| 任务 | 命令 |
|------|------|
| 安装依赖 | `npm install` |
| 开发模式（需在两个终端分别运行） | `npm run dev`（Vite，端口 5173）+ `npm run server`（Express，端口 3001） |
| 代码检查 | `npm run lint` |
| 生产构建并启动 | `npm start`（构建到 `dist/`，在端口 3001 提供服务） |
| 仅构建 | `npm run build` |
| 预览生产构建 | `npm run preview` |

未配置测试框架——没有 `npm test`。

## 架构

**前端：** 单个大型 React 19 组件，位于 `src/App.jsx`（约 1010 行）。无路由、无状态管理库——所有状态通过 `useState`/`useEffect`/`useRef` 管理。使用原生 CSS（`src/App.css`、`src/index.css`）实现暗色玻璃拟态主题。Vite 8 负责构建和 HMR 开发服务；将 `/api` 请求代理到 Express 后端。

**后端：** Express 5 服务器，位于 `server.js`，提供 REST 接口。所有状态以扁平 JSON 文件持久化在 `data/` 目录（无数据库）。核心重置逻辑位于 `reset-check.js`。

**关键文件：**
- `server.js` — Express API 接口：`/api/status`、`/api/save`、`/api/config`、`/api/force-reset`、`/api/history`
- `reset-check.js` — 每日/每周重置检测、数据结构与配置对齐、历史快照创建
- `data/config.json` — 游戏配置（角色、每日任务、每周副本、资产、重置时间表）
- `data/data.json` — 当前各角色状态
- `data/history.json` — 已归档的每周快照（上限 50 条）

## 数据流

1. 前端挂载时调用 `GET /api/status`——服务器执行 `checkAndReset()`，如需要则自动进行每日（09:00）或每周（周六 09:00）重置，然后返回配置和数据。
2. 用户操作触发 `POST /api/save`（文本输入防抖 600ms，开关切换立即保存）。
3. 配置变更通过 `POST /api/config` 触发 `alignDataStructure()`，将 `data.json` 与新配置同步（添加/移除角色和任务、填充默认值）。
4. 每周重置时，先创建历史快照，再清除每周进度。

## 重要约定

- 项目使用 JSX，而非 TypeScript（尽管 devDependencies 中包含 `@types/react`）。
- `data/` 目录包含真实游戏数据，且未被 gitignore——请勿随意覆盖或清空这些文件。
- `dist/` 目录是预构建产物并已提交；`npm run build` 可重新生成。
- Vite 开发服务器将所有 `/api/*` 请求代理到 `localhost:3001`——开发模式下后端必须处于运行状态前端才能正常工作。
