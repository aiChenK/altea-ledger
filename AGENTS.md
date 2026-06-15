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

**后端：** Express 5 服务器，位于 `server.js`，提供 REST 接口。支持多用户机制，通过读取环境变量 `USERS_AUTH` 来验证不同用户的密码并映射其昵称，数据按用户昵称物理隔离（每个用户生成独立的配置文件、数据文件和历史归档）。核心重置逻辑位于 `reset-check.js`。

**关键文件：**
- `server.js` — Express API 接口，负责鉴权并根据 `req.nickname` 动态读写用户独立文件。
- `reset-check.js` — 每日/每周重置检测、数据结构与配置对齐、历史快照创建（支持传参写入用户专属历史文件）。
- `data/config.json` — 系统默认的全局基础配置模板。
- `data/config_${nickname}.json` — 对应用户独立的配置（如角色列表、关卡增减等）。
- `data/data_${nickname}.json` — 对应用户独立的角色每日/每周进度数据及备忘录等。
- `data/history_${nickname}.json` — 对应用户独立的每周历史快照归档（上限 50 条）。

## 数据流

1. 前端挂载或登录时，带上 Authorization Bearer 密码，调用 `GET /api/status` —— 服务器从中间件匹配 `USERS_AUTH` 解析出当前用户 `nickname`，若其个人文件不存在则拷贝全局模板动态建档；随后对其执行 `checkAndReset()` 检测重置，最后返回专属配置和数据。
2. 用户操作触发 `POST /api/save` （文本输入防抖 600ms，开关切换立即保存），保存至对应用户的个人数据文件中。
3. 配置变更通过 `POST /api/config` 保存至用户的 `config_${nickname}.json` 触发 `alignDataStructure()` 与数据同步。
4. 每周重置时，先在用户专属的历史归档中创建快照，再清除该用户周常进度。

## 重要约定

- 项目使用 JSX，而非 TypeScript（尽管 devDependencies 中包含 `@types/react`）。
- `data/` 目录包含真实游戏数据，且未被 gitignore——请勿随意覆盖或清空这些文件。
- `dist/` 目录是预构建产物并已提交；`npm run build` 可重新生成。
- Vite 开发服务器将所有 `/api/*` 请求代理到 `localhost:3001`——开发模式下后端必须处于运行状态前端才能正常工作。
