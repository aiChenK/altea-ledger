# 🐉 Alteia Ledger (altea-ledger)

This is a **high-density, dark frosted glass (Glassmorphism) style** character weekly and daily status tracking system designed specifically for Dragon Nest players. It completely replaces cumbersome, hard-to-use traditional Excel sheets, providing a more intuitive multi-character comparison, automatic cycle reset, online configuration management, and weekly history archiving & backup features.

### 📸 Preview

| Main Tracker | Configuration Panel |
| :---: | :---: |
| ![Main Tracker](screenshots/main_interface.png) | ![Configuration Panel](screenshots/config_panel.png) |

---

## ✨ Core Features

- 🎮 **Multi-Character Ultra-Narrow Horizontal Comparison**: Specially optimized for 1080p and various resolutions with a high-density layout. Character column width is locked at `76px`, allowing quick horizontal comparisons on a single screen.
- ⚡ **Smart Reset Mechanism**:
  - **Daily Reset**: Automatically resets daily states (Attendance, Potion, Daily Quest, Lucky Zone, AFK stage, etc.) every day at **09:00 AM**.
  - **Weekly Reset**: Automatically resets weekly dungeons/stages every Saturday at **09:00 AM**.
  - **Auto Trigger**: The backend automatically compares the current standard time with the last reset timestamp upon each request, performing silent resets and data alignment seamlessly.
- 🦢 **Asset & Buff Management**:
  - Track assets such as Gold and Costume Sets for each character.
  - Visualize Golden Goose Buff expiration times with support for quick extension (+7 days) and precise countdown alerts.
- ⏳ **Weekly History Archiving**:
  - Upon weekly resets (either automatic or manually forced), the system automatically creates a **historical snapshot** of all states and memos for the current week.
  - Dynamically configurable archive limit (defaults to keeping the latest 50 versions), automatically purging the oldest archives when the limit is exceeded.
  - Features a sliding sidebar archive drawer and a read-only detailed table modal, along with a secure option to clear all archives with a single click.
- 📌 **Flowing Memo Tags**:
  - Global memo utilizes a sticker tag design. Simply press Enter to generate a tag, and click the `×` on the tag tail to delete it anytime.
  - Read-only archived memo tags are also displayed in the history snapshot detailed modal.
- ⚙️ **Online Visual Configuration**:
  - Allows direct creation or deletion of characters and weekly dungeons on the webpage, with support for fine-tuning base clears for each dungeon (e.g., Green Dragon HC: 1 clear, Guardian Nest: 2 clears, etc.).
  - Configures daily/weekly reset hours and the historical record limit directly from the frontend panel.
- 🔒 **Secure Access Validation**:
  - **Default Passwordless**: Direct entry into the system if no password is configured.
  - **Environment Variable Injection**: Set an initial access password via the `ADMIN_PASSWORD` environment variable (Docker compatible).
  - **System Panel Modification**: Modify or clear the access password directly in the configuration drawer.
  - **Browser Remembers Password**: The browser remembers the correct password using `LocalStorage`, preventing repeated logins on the same device.

---

## 🛠️ Technology Stack

- **Frontend**: React (Vite) + Hooks (`useState`, `useEffect`, `useRef`) + Vanilla CSS (Glassmorphism Visual System)
- **Backend**: Node.js + Express + CORS
- **Database**: Lightweight local JSON file storage, writing and syncing data in real time.

---

## 🚀 Quick Start

### 1. Install Dependencies

Run the following command in the project root directory:

```bash
npm install
```

### 2. Local Development Mode

Start the frontend Vite development server and the backend Express API server simultaneously:

- Start the frontend development server (supports Hot Module Replacement, running on port `5173` by default, with `/api` proxied to the backend):
  ```bash
  npm run dev
  ```
- Start the backend API service (running on port `3001` by default):
  ```bash
  npm run server
  ```

### 3. Production Build & Start (Single-Command Run)

If you want to compile the program and host it on a server or a local area network, run:

```bash
npm start
```
> This command will first run `npm run build` to package the frontend, and then the backend on port `3001` will serve the static files and API services directly.
> Once started, visit in your browser: **[http://localhost:3001](http://localhost:3001)**

### 4. Docker Deployment (Recommended)

The official Docker image for this project is hosted on Docker Hub: **[aichenk/altea-ledger](https://hub.docker.com/r/aichenk/altea-ledger)**.

Pull and run the container directly (mount local data directory, set local timezone, and configure the access password):
```bash
docker run -d \
  -p 3001:3001 \
  -v $(pwd)/data:/app/data \
  -e TZ=Asia/Shanghai \
  -e ADMIN_PASSWORD=your_password \
  --name altea-ledger \
  aichenk/altea-ledger:latest
```

> [!IMPORTANT]
> **Access Password Validation (`ADMIN_PASSWORD`)**
> - You can pass the `-e ADMIN_PASSWORD=your_password` environment variable to configure the initial password. Leave it blank for passwordless mode.
> - Once logged in, you can modify or clear the access password in the Configuration Panel. The changes will overwrite the environment variable and persist locally.
> - The browser remembers the correct password using `LocalStorage`, so you won't need to retype it on the same device.
>
> **Timezone Configuration (`TZ`)**
> The automatic daily (09:00 AM) and weekly (Saturday 09:00 AM) reset triggers heavily rely on the container's local system time. Please specify your timezone using the `-e TZ=Asia/Shanghai` environment variable (change it to your local timezone if needed).
>
> **Data Persistence**
> All data is stored in the `/app/data` directory. Mounting `-v $(pwd)/data:/app/data` ensures that your characters' configurations and progresses are not lost when the container restarts.
> If the mounted `./data` directory on the host is empty on the first run, make sure to copy the `data/config.json` template file from the source code to the mounted folder first. Otherwise, the system will initialize with an empty config due to the missing layout description.

### 5. Docker Compose Deployment (Recommended)

If you have Docker Compose installed, you can use the `docker-compose.yml` file in the project root for one-command deployment.

#### Start Service
Simply run in the root directory:
```bash
docker compose up -d
```

#### `docker-compose.yml` configuration:
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
      - ADMIN_PASSWORD=your_password  # Access password. Leave blank for passwordless mode. Can also be modified via settings drawer.
    restart: always
```

---

## ⚙️ Reset Rules

- **Reset Check**: The system has no background persistent timer, avoiding multi-process conflicts. Each time the frontend fetches data (`GET /api/status`) or saves data, the backend automatically invokes `checkAndReset`, performing swift and safe cross-cycle evaluations.
- **Configuration Sync**: When you add or delete characters or dungeons via the "Configuration Management Panel", the system automatically aligns the data structures in `data.json`, removing deprecated fields and populating new fields with default values, preventing page crashes due to malformed data.
