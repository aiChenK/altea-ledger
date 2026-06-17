# 🐉 阿尔特里亚大陆考勤簿 (altea-ledger)

这是一个专为龙之谷（Dragon Nest）游戏玩家打造的**高密度、暗黑磨砂玻璃风格 (Glassmorphism)** 的角色周常与日常状态记录管理系统。它完全取代了繁琐的传统 Excel 表格，提供多角色管理、自动周期重置、在线配置管理、游戏收支流水及周常历史归档备份功能。

### 📸 界面预览

| 主界面 (Main Tracker) | 配置管理面板 (Configuration Panel) |
| :---: | :---: |
| ![主界面](screenshots/main_interface.png) | ![配置管理面板](screenshots/config_panel.png) |

---

## ✨ 核心特性

- 🎮 **多角色管理**：支持多角色数据并排展示，方便一屏内快速查看和切换管理。
- ⚡ **智能周期重置**：
  - **日常重置**：每日 **09:00** 自动重置日常状态（签到、喝药、幸运、挂机等）。
  - **周常重置**：每周六 **09:00** 自动重置周关卡，并在重置前自动创建历史快照。
  - **自动判定**：无后台定时器，后端根据客户端请求的时间戳自动、静默完成跨周期重置与数据校准。
- 🦢 **自定义项目追踪**：
  - 支持动态启用默认资产，支持自由新增自定义项（类型支持：数字、时间到期卡片、多阶段进度点）。
  - 所有项目均支持在线可视化隐藏、重命名、及拖拽排序。
- 📈 **收支记账与统计**：
  - 支持记录金币流水（区分普通收支和“买金/卖金”出金交易，记录汇率、手续费及自动备注填充）。
  - 提供按年/月折叠的多级明细统计，支持纯文本一键导入导出备份，历史记录以时间倒序排列。
- ⏳ **历史快照回溯**：
  - 周重置时自动对当周进度与备忘生成快照归档（上限 50 条，超出自动剔除）。
  - 提供只读详情大表与一键清空历史等选项。
- 📌 **流式备忘贴纸**：
  - 标签式（Tag）便签设计，回车生成，点击 `×` 删除，快照归档中亦会同步保存当时只读状态。
- 🔒 **多用户隔离与验证**：
  - 支持通过环境变量配置多用户认证，各用户数据物理隔离（生成独立的配置、数据与历史文件）。
  - 向下兼容单人密码验证模式和免密访客模式；支持浏览器自动记住密码与安全注销。

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式

需要同时启动前端和后端服务（前端已自动配置代理 `/api` 到 `localhost:3001`）：

```bash
# 启动前端开发服务器（Vite，默认端口 5173）
npm run dev

# 启动后端 API 服务（Express，默认端口 3001）
npm run server
```

### 3. 生产构建与启动

```bash
npm start
```
> 该命令会先执行 `npm run build` 打包前端，然后由后端 `3001` 端口直接托管静态包与 API 服务。访问：**[http://localhost:3001](http://localhost:3001)**

---

## 🐳 Docker 部署

### 1. Docker Run 运行

```bash
docker run -d \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  -e TZ=Asia/Shanghai \
  -e USERS_AUTH="张三:pass123,李四:pwd456" \
  --name altea-ledger \
  aichenk/altea-ledger:latest
```

### 2. Docker Compose 部署

使用项目根目录下的 `docker-compose.yml` 进行部署：

```yaml
version: '3.8'

services:
  altea-ledger:
    image: aichenk/altea-ledger:latest
    container_name: altea-ledger
    ports:
      - "3001:3001"
    volumes:
      - ./data:/app/data
    environment:
      - TZ=Asia/Shanghai
      - PORT=3001
      - USERS_AUTH=张三:pass123,李四:pwd456  # 多用户配置，格式为 "昵称1:密码1,昵称2:密码2"
      - ADMIN_PASSWORD=your_password        # 单人验证密码（仅在未设置 USERS_AUTH 时生效）
    restart: always
```

### 3. 环境变量说明

| 环境变量 | 描述 | 默认值 / 示例 |
| :--- | :--- | :--- |
| `TZ` | 容器时区，周期重置规则强依赖此配置 | `Asia/Shanghai` |
| `USERS_AUTH` | 多用户独立账本认证配置，逗号分隔，密码不能重复 | `昵称1:密码1,昵称2:密码2` |
| `ADMIN_PASSWORD` | 单人模式下的访问密码（可在网页配置中修改） | `your_password` |
| `PORT` | 服务端口 | `3001` |

> [!IMPORTANT]
> **数据持久化与初始化**：
> - 本项目的所有数据均保存在容器的 `/app/data` 目录中。请挂载 `-v $(pwd)/data:/app/data` 确保数据持久化。
> - **首次启动**：如果宿主机上的 `./data` 目录为空，请务必提前将项目源码中的 `data/config.json` 拷贝到挂载目录下，否则系统会因为缺少初始布局配置而无法正常展现默认数据。
