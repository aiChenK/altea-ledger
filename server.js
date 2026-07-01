import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkAndReset, alignDataStructure, recordGoldHistory } from './reset-check.js';
import nodemailer from 'nodemailer';


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
  emailBackupConfig: {
    email: "",
    autoBackupOnReset: true
  },
  roles: [
    "角色1",
    "角色2",
    "角色3",
    "角色4"
  ],
  showTodo: true,
  assets: [
    {
      key: "gold",
      name: "金币",
      type: "number",
      visible: true
    },
    {
      key: "fashion",
      name: "时装收集",
      type: "number",
      visible: true
    },
    {
      key: "goldenGoose",
      name: "黄金鹅",
      type: "datetime",
      visible: true
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
      "key": "afk",
      "name": "挂机",
      "type": "stage",
      "maxStage": 4,
      "resetHour": 0
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
      if (parsed.showTodo === undefined) {
        parsed.showTodo = true;
        needsFix = true;
      }
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
      if (!parsed.emailBackupConfig || typeof parsed.emailBackupConfig !== 'object') {
        parsed.emailBackupConfig = { ...DEFAULT_CONFIG.emailBackupConfig };
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

// 异步发送用户备份邮件
async function sendEmailBackup(nickname) {
  const { configPath, dataPath, historyPath } = getUserPaths(nickname);
  const config = readJsonFile(configPath);
  const receiver = config.emailBackupConfig?.email;

  if (!receiver) {
    console.log(`[邮件备份] 用户 "${nickname}" 未配置备份邮箱，跳过备份。`);
    return { success: false, reason: '未配置邮箱' };
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn(`[邮件备份] 系统环境变量未配置 SMTP_USER 或 SMTP_PASS，无法为用户 "${nickname}" 发送备份。`);
    return { success: false, reason: '系统未配置SMTP发信凭证' };
  }

  console.log(`[邮件备份] 正在尝试为用户 "${nickname}" 发送备份邮件至 ${receiver}...`);

  try {
    const transporter = nodemailer.createTransport({
      host: host || 'smtp.qq.com',
      port: parseInt(port || '465'),
      secure: parseInt(port || '465') === 465,
      auth: { user, pass }
    });

    const attachments = [];
    if (fs.existsSync(configPath)) {
      attachments.push({ filename: `config_${nickname}.json`, content: fs.readFileSync(configPath) });
    }
    if (fs.existsSync(dataPath)) {
      attachments.push({ filename: `data_${nickname}.json`, content: fs.readFileSync(dataPath) });
    }
    if (fs.existsSync(historyPath)) {
      attachments.push({ filename: `history_${nickname}.json`, content: fs.readFileSync(historyPath) });
    }

    const mailOptions = {
      from: `"阿尔特里亚备份服务" <${user}>`,
      to: receiver,
      subject: `【数据备份】阿尔特里亚大陆考勤簿 - ${nickname} - ${new Date().toLocaleDateString()}`,
      text: `您好，这是您在阿尔特里亚大陆考勤簿的用户数据备份。\n\n备份生成时间：${new Date().toLocaleString()}\n用户昵称：${nickname}\n\n附件中包含了您的配置、角色进度以及每周历史快照，如有需要，可将附件文件覆盖到服务器 data/ 目录下对应的文件进行恢复。`,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[邮件备份] 用户 "${nickname}" 的数据备份邮件发送成功！(MessageID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[邮件备份] 发送备份邮件失败:`, err);
    return { success: false, error: err.message };
  }
}


// 获取系统访问密码配置（优先读取 config.json 中的 adminPassword，次之读取环境变量）
function getSystemPassword() {
  const config = readJsonFile(configPath);
  if (config && config.adminPassword !== undefined) {
    return config.adminPassword;
  }
  return process.env.ADMIN_PASSWORD || '';
}

// 解析多用户配置，格式为: nickname1:passwd1,nickname2:passwd2
function parseUsersAuth() {
  const authStr = process.env.USERS_AUTH || '';
  if (!authStr) return {};

  const users = {};
  const pairs = authStr.split(',');
  for (const pair of pairs) {
    const parts = pair.split(':');
    if (parts.length === 2) {
      const nickname = parts[0].trim();
      const password = parts[1].trim();
      if (nickname && password) {
        users[password] = nickname;
      }
    }
  }
  return users;
}

// 获取当前的密码-用户映射表，并做向下兼容
function getUsers() {
  const users = parseUsersAuth();
  if (Object.keys(users).length === 0) {
    const sysPassword = getSystemPassword();
    if (sysPassword) {
      users[sysPassword] = '管理员';
    }
  }
  return users;
}

// 动态获取特定用户的物理文件路径
function getUserPaths(nickname) {
  if (!nickname || nickname === '访客') {
    return {
      configPath,
      dataPath,
      historyPath
    };
  }
  // 安全过滤字符，防止目录穿越
  const safeNickname = nickname.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
  return {
    configPath: path.join(dataDir, `config_${safeNickname}.json`),
    dataPath: path.join(dataDir, `data_${safeNickname}.json`),
    historyPath: path.join(dataDir, `history_${safeNickname}.json`)
  };
}

// 获取或动态初始化用户专属文件
function getOrInitUserFiles(nickname) {
  const paths = getUserPaths(nickname);

  // 1. 如果用户专属配置不存在，从全局 config.json 拷贝
  if (!fs.existsSync(paths.configPath)) {
    console.log(`[初始化] 正在为用户 "${nickname}" 复制默认配置文件...`);
    let baseConfig;
    if (fs.existsSync(configPath)) {
      baseConfig = readJsonFile(configPath);
    } else {
      baseConfig = {
        resetConfig: { dailyResetHour: 9, weeklyResetDay: 6, weeklyResetHour: 9 },
        maxHistoryCount: 50,
        roles: [],
        assets: [],
        dailies: [],
        weeklies: []
      };
    }
    saveJsonFile(paths.configPath, baseConfig);
  }

  // 2. 如果用户专属数据不存在，自动初始化角色状态
  if (!fs.existsSync(paths.dataPath)) {
    console.log(`[初始化] 正在为用户 "${nickname}" 创建初始进度数据文件...`);
    const userConfig = readJsonFile(paths.configPath);
    const baseData = {
      lastDailyReset: new Date(0).toISOString(),
      lastWeeklyReset: new Date(0).toISOString(),
      globalMemo: [],
      characters: {}
    };
    alignDataStructure(baseData, userConfig);
    saveJsonFile(paths.dataPath, baseData);
  }

  return paths;
}

// 密码验证与多用户绑定中间件
function authMiddleware(req, res, next) {
  const users = getUsers();
  const hasPassword = Object.keys(users).length > 0;

  // 若未设置密码，直接以访客身份放行
  if (!hasPassword) {
    req.nickname = '访客';
    return next();
  }

  // 检测接口本身不拦截
  if (req.path === '/api/auth-check') {
    return next();
  }

  // 提取客户端提供的凭证
  const authHeader = req.headers['authorization'];
  let clientPassword;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    clientPassword = authHeader.substring(7);
  } else {
    clientPassword = req.headers['x-admin-password'] || '';
  }

  const nickname = users[clientPassword];
  if (nickname) {
    req.nickname = nickname;
    return next();
  }

  return res.status(401).json({ error: 'unauthorized', message: '访问密码错误或已失效，请重新输入' });
}

// 应用密码校验中间件
app.use('/api', authMiddleware);

// 校验密码与系统安全状态接口
app.get('/api/auth-check', (req, res) => {
  const users = getUsers();
  const hasPassword = Object.keys(users).length > 0;
  const isMulti = !!process.env.USERS_AUTH;

  const authHeader = req.headers['authorization'];
  let clientPassword;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    clientPassword = authHeader.substring(7);
  } else {
    clientPassword = req.headers['x-admin-password'] || '';
  }

  const nickname = users[clientPassword];
  const isCorrect = !hasPassword || !!nickname;

  res.json({
    needPassword: hasPassword,
    success: isCorrect,
    nickname: nickname || (hasPassword ? '' : '访客'),
    isMultiUser: isMulti
  });
});

// 统一状态获取接口（获取配置 + 最新数据，并执行重置校验）
app.get('/api/status', (req, res) => {
  const { configPath, dataPath, historyPath } = getOrInitUserFiles(req.nickname);
  const config = readJsonFile(configPath);
  const data = readJsonFile(dataPath);

  const now = new Date();
  const resetTriggered = checkAndReset(data, config, now, historyPath, () => {
    if (config.emailBackupConfig?.email && config.emailBackupConfig?.autoBackupOnReset) {
      sendEmailBackup(req.nickname);
    }
  });
  if (resetTriggered) {
    saveJsonFile(dataPath, data);
  }

  res.json({
    config,
    data,
    nickname: req.nickname,
    isMultiUser: !!process.env.USERS_AUTH
  });
});

// 保存数据接口
app.post('/api/save', (req, res) => {
  const { configPath, dataPath, historyPath } = getOrInitUserFiles(req.nickname);
  const config = readJsonFile(configPath);
  const data = readJsonFile(dataPath);

  const { characters, globalMemo, transactions } = req.body;

  if (characters !== undefined) {
    data.characters = characters;
  }
  if (globalMemo !== undefined) {
    data.globalMemo = globalMemo;
  }
  if (transactions !== undefined) {
    data.transactions = transactions;
  }

  const now = new Date();
  checkAndReset(data, config, now, historyPath, () => {
    if (config.emailBackupConfig?.email && config.emailBackupConfig?.autoBackupOnReset) {
      sendEmailBackup(req.nickname);
    }
  });

  saveJsonFile(dataPath, data);

  res.json({
    success: true,
    data
  });
});

// 保存配置接口（并在保存后重新校准数据 structure）
app.post('/api/config', (req, res) => {
  const { configPath, dataPath, historyPath } = getOrInitUserFiles(req.nickname);

  let newConfig = req.body;
  let renameMap = null;

  // 支持新 payload 格式以适配角色改名：{ config, renameMap }
  if (req.body && req.body.config && req.body.config.roles) {
    newConfig = req.body.config;
    renameMap = req.body.renameMap;
  }

  if (!newConfig || !newConfig.roles || !newConfig.weeklies) {
    return res.status(400).json({ error: '无效的配置格式' });
  }

  saveJsonFile(configPath, newConfig);

  const data = readJsonFile(dataPath);

  // 如果提供了重命名映射，并且数据中存在角色列表，进行重命名
  if (renameMap && data.characters) {
    for (const [oldName, newName] of Object.entries(renameMap)) {
      if (oldName !== newName && data.characters[oldName]) {
        console.log(`[改名] 用户 "${req.nickname}"：角色名从 "${oldName}" 重命名为 "${newName}"`);
        data.characters[newName] = data.characters[oldName];
        delete data.characters[oldName];
      }
    }
  }

  // 同步替换金币历史记录中的角色名
  if (renameMap && data.goldHistory && Array.isArray(data.goldHistory)) {
    for (const record of data.goldHistory) {
      if (record.roles) {
        for (const [oldName, newName] of Object.entries(renameMap)) {
          if (oldName !== newName && record.roles[oldName] !== undefined) {
            record.roles[newName] = record.roles[oldName];
            delete record.roles[oldName];
          }
        }
      }
    }
  }

  // 同步替换历史记录文件中的角色名
  if (renameMap && fs.existsSync(historyPath)) {
    try {
      let history = JSON.parse(fs.readFileSync(historyPath, 'utf-8') || '[]');
      let historyChanged = false;
      for (const item of history) {
        if (item.snapshot && item.snapshot.characters) {
          for (const [oldName, newName] of Object.entries(renameMap)) {
            if (oldName !== newName && item.snapshot.characters[oldName]) {
              item.snapshot.characters[newName] = item.snapshot.characters[oldName];
              delete item.snapshot.characters[oldName];
              historyChanged = true;
            }
          }
        }
      }
      if (historyChanged) {
        saveJsonFile(historyPath, history);
        console.log(`[改名] 历史归档中的角色名已成功同步更新`);
      }
    } catch (e) {
      console.error('[改名] 同步更新历史归档中的角色名失败:', e);
    }
  }

  // 用新配置进行结构校准
  alignDataStructure(data, newConfig);

  const now = new Date();
  checkAndReset(data, newConfig, now, historyPath, () => {
    if (newConfig.emailBackupConfig?.email && newConfig.emailBackupConfig?.autoBackupOnReset) {
      sendEmailBackup(req.nickname);
    }
  });
  saveJsonFile(dataPath, data);

  res.json({
    success: true,
    config: newConfig,
    data
  });
});

// 手动强制重置接口
app.post('/api/force-reset', (req, res) => {
  const { configPath, dataPath, historyPath } = getOrInitUserFiles(req.nickname);
  const { type } = req.body; // 'daily' 或 'weekly'
  const config = readJsonFile(configPath);
  const data = readJsonFile(dataPath);
  const now = new Date();

  if (type === 'daily') {
    // 强制每日重置时，记录金币快照
    try {
      recordGoldHistory(data, now);
    } catch (err) {
      console.error('[手动重置] 记录金币历史快照失败:', err);
    }

    for (const role of Object.keys(data.characters)) {
      const char = data.characters[role];
      for (const daily of config.dailies) {
        char.dailies[daily.key] = daily.type === 'stage' ? 0 : false;
      }
    }
    data.lastDailyReset = now.toISOString();
    
    // 更新各小时的分组每日重置时间戳
    if (!data.lastDailyResets) {
      data.lastDailyResets = {};
    }
    const dailyResetHour = config.resetConfig.dailyResetHour;
    data.lastDailyResets[dailyResetHour] = now.toISOString();
    for (const daily of config.dailies) {
      const hour = daily.resetHour !== undefined ? daily.resetHour : dailyResetHour;
      data.lastDailyResets[hour] = now.toISOString();
    }
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
      if (config.emailBackupConfig?.email && config.emailBackupConfig?.autoBackupOnReset) {
        sendEmailBackup(req.nickname);
      }
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
  const { historyPath } = getOrInitUserFiles(req.nickname);
  const history = readJsonFile(historyPath, []);
  res.json(history);
});

// 清空所有历史归档接口
app.post('/api/history/clear', (req, res) => {
  const { historyPath } = getOrInitUserFiles(req.nickname);
  saveJsonFile(historyPath, []);
  res.json({ success: true });
});

// 清空金币历史记录接口
app.post('/api/gold-history/clear', (req, res) => {
  const { dataPath } = getOrInitUserFiles(req.nickname);
  const data = readJsonFile(dataPath);
  data.goldHistory = [];
  saveJsonFile(dataPath, data);
  res.json({ success: true, data });
});

// 手动测试/即时发送邮件备份接口
app.post('/api/backup/email-test', async (req, res) => {
  const { configPath } = getOrInitUserFiles(req.nickname);
  const config = readJsonFile(configPath);
  const receiver = config.emailBackupConfig?.email;

  if (!receiver) {
    return res.status(400).json({ error: 'invalid_email', message: '您尚未配置接收备份的邮箱地址，请先在配置中填写。' });
  }

  const result = await sendEmailBackup(req.nickname);
  if (result.success) {
    res.json({ success: true, message: `已成功向 ${receiver} 发送数据备份邮件` });
  } else {
    res.status(500).json({ error: 'send_failed', message: `发送备份邮件失败：${result.error || result.reason}` });
  }
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
