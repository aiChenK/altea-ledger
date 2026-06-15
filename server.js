import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkAndReset, alignDataStructure } from './reset-check.js';

// 获取 ESM 下的 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, 'data');
const configPath = path.join(dataDir, 'config.json');
const dataPath = path.join(dataDir, 'data.json');
const historyPath = path.join(dataDir, 'history.json');

// 默认游戏配置，用作 config.json 缺失或损坏时的备选
const DEFAULT_CONFIG = {
  resetConfig: {
    dailyResetHour: 9,
    weeklyResetDay: 6,
    weeklyResetHour: 9
  },
  maxHistoryCount: 50,
  roles: [
    "风行",
    "影舞",
    "圣徒",
    "冰灵",
    "剑皇",
    "药剂",
    "灵魂"
  ],
  assets: [
    {
      key: "gold",
      name: "金币",
      type: "number"
    },
    {
      key: "fashion",
      name: "时装",
      type: "number"
    },
    {
      key: "goldenGoose",
      name: "黄金鹅",
      type: "datetime"
    }
  ],
  dailies: [
    {
      key: "checkin",
      name: "签到",
      type: "boolean"
    },
    {
      key: "potion",
      name: "喝药",
      type: "boolean"
    },
    {
      key: "dailyQuest",
      name: "每日",
      type: "boolean"
    },
    {
      key: "lucky",
      name: "幸运",
      type: "boolean"
    },
    {
      key: "afk",
      name: "挂机",
      type: "stage",
      maxStage: 4
    }
  ],
  weeklies: [
    {
      key: "warehouse",
      name: "仓库",
      baseCount: 1
    },
    {
      key: "expedition70",
      name: "远征70",
      baseCount: 1
    },
    {
      key: "dragonAbyss",
      name: "龙渊",
      baseCount: 1
    },
    {
      key: "greenDragonHard",
      name: "绿龙硬核",
      baseCount: 1
    },
    {
      key: "greenDragonClassic",
      name: "绿龙经典",
      baseCount: 1
    },
    {
      key: "sandDragonClassic",
      name: "沙龙经典",
      baseCount: 1
    },
    {
      key: "guardian",
      name: "守卫者",
      baseCount: 2
    },
    {
      key: "trial",
      name: "试炼",
      baseCount: 1
    },
    {
      key: "blackDragonP1",
      name: "黑龙P1",
      baseCount: 1
    },
    {
      key: "blackDragonP2",
      name: "黑龙P2",
      baseCount: 1
    },
    {
      key: "blackDragonP3",
      name: "黑龙P3",
      baseCount: 1
    },
    {
      key: "typhoonKimHell",
      name: "台风金地狱",
      baseCount: 1
    },
    {
      key: "profKHell",
      name: "K博士地狱",
      baseCount: 1
    }
  ]
};

// 辅助函数：读取并校验 JSON 文件
function readJsonFile(filePath, defaultContent = {}) {
  const isConfig = filePath === configPath;
  const actualDefault = isConfig ? DEFAULT_CONFIG : defaultContent;

  try {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(actualDefault, null, 2), 'utf-8');
      return JSON.parse(JSON.stringify(actualDefault));
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(data);

    // 如果读取的是配置文件，我们需要进行完整性校验以避免属性缺失崩溃
    if (isConfig) {
      let needsFix = false;
      if (!parsed.roles || !Array.isArray(parsed.roles)) {
        parsed.roles = [...DEFAULT_CONFIG.roles];
        needsFix = true;
      }
      if (!parsed.assets || !Array.isArray(parsed.assets)) {
        parsed.assets = [...DEFAULT_CONFIG.assets];
        needsFix = true;
      }
      if (!parsed.dailies || !Array.isArray(parsed.dailies)) {
        parsed.dailies = [...DEFAULT_CONFIG.dailies];
        needsFix = true;
      }
      if (!parsed.weeklies || !Array.isArray(parsed.weeklies)) {
        parsed.weeklies = [...DEFAULT_CONFIG.weeklies];
        needsFix = true;
      }
      if (!parsed.resetConfig || typeof parsed.resetConfig !== 'object') {
        parsed.resetConfig = { ...DEFAULT_CONFIG.resetConfig };
        needsFix = true;
      }
      if (needsFix) {
        fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8');
      }
    }
    return parsed;
  } catch (err) {
    console.error(`读取文件失败: ${filePath}`, err);
    return JSON.parse(JSON.stringify(actualDefault));
  }
}

// 辅助函数：保存 JSON 文件
function saveJsonFile(filePath, content) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`写入文件失败: ${filePath}`, err);
    return false;
  }
}

// 获取系统访问密码配置（优先读取 config.json 中的 adminPassword，次之读取环境变量）
function getSystemPassword() {
  const config = readJsonFile(configPath);
  if (config && config.adminPassword !== undefined) {
    return String(config.adminPassword).trim();
  }
  return (process.env.ADMIN_PASSWORD || '').trim();
}

// 密码验证中间件
function authMiddleware(req, res, next) {
  const sysPassword = getSystemPassword();
  // 若未设置密码，直接放行
  if (!sysPassword) {
    return next();
  }

  // 检测接口本身不拦截 (同时支持子路由匹配和完整Url匹配)
  if (req.path === '/auth-check' || req.originalUrl === '/api/auth-check') {
    return next();
  }

  // 提取客户端提供的凭证
  const authHeader = req.headers['authorization'];
  const clientPassword = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.substring(7)
    : (req.headers['x-admin-password'] || '');

  if (clientPassword.trim() === sysPassword) {
    return next();
  }

  return res.status(401).json({ error: 'unauthorized', message: '访问密码错误或已失效，请重新输入' });
}

// 应用密码校验中间件
app.use('/api', authMiddleware);

// 校验密码与系统安全状态接口
app.get('/api/auth-check', (req, res) => {
  const sysPassword = getSystemPassword();
  const hasPassword = !!sysPassword;

  const authHeader = req.headers['authorization'];
  const clientPassword = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.substring(7)
    : (req.headers['x-admin-password'] || '');

  const isCorrect = !hasPassword || (clientPassword.trim() === sysPassword);

  res.json({
    needPassword: hasPassword,
    success: isCorrect
  });
});

// 统一状态获取接口（获取配置 + 最新数据，并执行重置校验）
app.get('/api/status', (req, res) => {
  const config = readJsonFile(configPath);
  const data = readJsonFile(dataPath);

  const now = new Date();
  const resetTriggered = checkAndReset(data, config, now);
  if (resetTriggered) {
    saveJsonFile(dataPath, data);
  }

  res.json({
    config,
    data
  });
});

// 保存数据接口
app.post('/api/save', (req, res) => {
  const config = readJsonFile(configPath);
  const data = readJsonFile(dataPath);

  const { characters, globalMemo } = req.body;

  if (characters !== undefined) {
    data.characters = characters;
  }
  if (globalMemo !== undefined) {
    data.globalMemo = globalMemo;
  }

  const now = new Date();
  checkAndReset(data, config, now);

  saveJsonFile(dataPath, data);

  res.json({
    success: true,
    data
  });
});

// 保存配置接口（并在保存后重新校准数据结构）
app.post('/api/config', (req, res) => {
  const newConfig = req.body;
  if (!newConfig || !newConfig.roles || !newConfig.weeklies) {
    return res.status(400).json({ error: '无效的配置格式' });
  }

  saveJsonFile(configPath, newConfig);

  const data = readJsonFile(dataPath);
  // 用新配置进行结构校准
  alignDataStructure(data, newConfig);
  
  const now = new Date();
  checkAndReset(data, newConfig, now);
  saveJsonFile(dataPath, data);

  res.json({
    success: true,
    config: newConfig,
    data
  });
});

// 手动强制重置接口
app.post('/api/force-reset', (req, res) => {
  const { type } = req.body; // 'daily' 或 'weekly'
  const config = readJsonFile(configPath);
  const data = readJsonFile(dataPath);
  const now = new Date();

  if (type === 'daily') {
    for (const role of Object.keys(data.characters)) {
      const char = data.characters[role];
      for (const daily of config.dailies) {
        char.dailies[daily.key] = daily.type === 'stage' ? 0 : false;
      }
    }
    data.lastDailyReset = now.toISOString();
  } else if (type === 'weekly') {
    // 保存每周历史快照
    try {
      let history = readJsonFile(historyPath, []);
      const snapshot = {
        characters: JSON.parse(JSON.stringify(data.characters)),
        globalMemo: data.globalMemo
      };
      history.unshift({
        id: String(now.getTime()),
        resetTime: now.toISOString(),
        snapshot
      });
      const maxHistory = config.maxHistoryCount || 50;
      if (history.length > maxHistory) {
        history = history.slice(0, maxHistory);
      }
      saveJsonFile(historyPath, history);
      console.log(`[手动重置] 历史快照保存成功。当前历史条数: ${history.length}`);
    } catch (e) {
      console.error('[手动重置] 历史快照保存失败:', e);
    }

    for (const role of Object.keys(data.characters)) {
      const char = data.characters[role];
      for (const weekly of config.weeklies) {
        char.weeklies[weekly.key] = 0;
      }
    }
    data.lastWeeklyReset = now.toISOString();
  } else {
    return res.status(400).json({ error: '无效的重置类型' });
  }

  saveJsonFile(dataPath, data);
  res.json({ success: true, data });
});

// 获取历史记录接口
app.get('/api/history', (req, res) => {
  const history = readJsonFile(historyPath, []);
  res.json(history);
});

// 清空所有历史归档接口
app.post('/api/history/clear', (req, res) => {
  saveJsonFile(historyPath, []);
  res.json({ success: true });
});

// 托管前端构建后的静态文件
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // 任何未匹配的路由返回 index.html (支持单页路由 SPA)
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`服务端已启动，监听端口: ${PORT}`);
  if (fs.existsSync(distPath)) {
    console.log(`已成功托管前端静态文件目录: ${distPath}`);
  } else {
    console.log(`[提示] 未找到前端构建静态文件目录 (./dist)。开发模式下请配合 Vite Dev Server 使用。`);
  }
});
