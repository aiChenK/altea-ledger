import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取上一个每日重置的时间点
export function getPrevDailyReset(now, resetHour) {
  const t = new Date(now);
  t.setHours(resetHour, 0, 0, 0);
  if (t > now) {
    t.setDate(t.getDate() - 1);
  }
  return t;
}

// 获取上一个每周重置的时间点
export function getPrevWeeklyReset(now, resetDay, resetHour) {
  const t = new Date(now);
  t.setHours(resetHour, 0, 0, 0);
  if (t > now) {
    t.setDate(t.getDate() - 1);
  }
  while (t.getDay() !== resetDay) {
    t.setDate(t.getDate() - 1);
  }
  return t;
}

// 同步校准数据结构，以防 config.json 新增/删除了角色或关卡
export function alignDataStructure(data, config) {
  let modified = false;

  // 1. 确保 characters 存在
  if (!data.characters) {
    data.characters = {};
    modified = true;
  }

  // 1.5. 确保 transactions 存在
  if (!data.transactions) {
    data.transactions = [];
    modified = true;
  }

  // 2. 移除不存在于配置中的角色，补充新角色
  const configuredRoles = new Set(config.roles);
  for (const role of Object.keys(data.characters)) {
    if (!configuredRoles.has(role)) {
      delete data.characters[role];
      modified = true;
    }
  }

  for (const role of config.roles) {
    if (!data.characters[role]) {
      data.characters[role] = {
        assets: {},
        dailies: {},
        weeklies: {}
      };
      modified = true;
    }

    const char = data.characters[role];

    // 校准 assets
    if (!char.assets) {
      char.assets = {};
      modified = true;
    }
    for (const asset of config.assets) {
      if (char.assets[asset.key] === undefined) {
        if (asset.type === 'number') {
          char.assets[asset.key] = 0;
        } else if (asset.type === 'stage') {
          char.assets[asset.key] = 0;
        } else {
          char.assets[asset.key] = '';
        }
        modified = true;
      }
    }

    // 校准 dailies
    if (!char.dailies) {
      char.dailies = {};
      modified = true;
    }
    for (const daily of config.dailies) {
      if (char.dailies[daily.key] === undefined) {
        char.dailies[daily.key] = daily.type === 'stage' ? 0 : false;
        modified = true;
      }
    }

    // 校准 weeklies
    if (!char.weeklies) {
      char.weeklies = {};
      modified = true;
    }
    for (const weekly of config.weeklies) {
      if (char.weeklies[weekly.key] === undefined) {
        char.weeklies[weekly.key] = 0;
        modified = true;
      }
    }

    // 校准 todos
    if (!char.todos) {
      char.todos = [];
      modified = true;
    }

    // 清理不存在于配置中的任务/关卡/资产
    const assetKeys = new Set(config.assets.map(a => a.key));
    for (const k of Object.keys(char.assets)) {
      if (!assetKeys.has(k)) { delete char.assets[k]; modified = true; }
    }

    const dailyKeys = new Set(config.dailies.map(d => d.key));
    for (const k of Object.keys(char.dailies)) {
      if (!dailyKeys.has(k)) { delete char.dailies[k]; modified = true; }
    }

    const weeklyKeys = new Set(config.weeklies.map(w => w.key));
    for (const k of Object.keys(char.weeklies)) {
      if (!weeklyKeys.has(k)) { delete char.weeklies[k]; modified = true; }
    }
  }

  return modified;
}

// 核心检查与重置逻辑
export function checkAndReset(data, config, now = new Date(), historyPath = null, onWeeklyReset = null) {
  let isChanged = alignDataStructure(data, config);

  const dailyResetHour = config.resetConfig.dailyResetHour;
  const weeklyResetDay = config.resetConfig.weeklyResetDay;
  const weeklyResetHour = config.resetConfig.weeklyResetHour;

  const prevDailyResetPoint = getPrevDailyReset(now, dailyResetHour);
  const prevWeeklyResetPoint = getPrevWeeklyReset(now, weeklyResetDay, weeklyResetHour);

  // 获取上一次重置的记录时间
  const lastDaily = data.lastDailyReset ? new Date(data.lastDailyReset) : new Date(0);
  const lastWeekly = data.lastWeeklyReset ? new Date(data.lastWeeklyReset) : new Date(0);

  // 1. 检查每日重置
  if (lastDaily < prevDailyResetPoint) {
    console.log(`[重置] 执行每日重置。上次每日重置时间: ${lastDaily.toISOString()}，重置线: ${prevDailyResetPoint.toISOString()}`);
    for (const role of Object.keys(data.characters)) {
      const char = data.characters[role];
      for (const daily of config.dailies) {
        char.dailies[daily.key] = daily.type === 'stage' ? 0 : false;
      }
    }
    data.lastDailyReset = prevDailyResetPoint.toISOString();
    isChanged = true;
  }

  // 2. 检查每周重置
  if (lastWeekly < prevWeeklyResetPoint) {
    console.log(`[重置] 执行每周重置。上次每周重置时间: ${lastWeekly.toISOString()}，重置线: ${prevWeeklyResetPoint.toISOString()}`);
    
    // 保存每周历史快照
    try {
      const defaultHistoryDir = path.join(__dirname, 'data');
      const targetHistoryPath = historyPath || path.join(defaultHistoryDir, 'history.json');
      const targetHistoryDir = path.dirname(targetHistoryPath);
      let history = [];
      if (fs.existsSync(targetHistoryPath)) {
        history = JSON.parse(fs.readFileSync(targetHistoryPath, 'utf-8') || '[]');
      }
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
      if (!fs.existsSync(targetHistoryDir)) {
        fs.mkdirSync(targetHistoryDir, { recursive: true });
      }
      fs.writeFileSync(targetHistoryPath, JSON.stringify(history, null, 2), 'utf-8');
      console.log(`[重置] 历史快照保存成功。当前历史条数: ${history.length}`);
      
      // 触发每周重置回调，例如发送邮件备份
      if (onWeeklyReset && typeof onWeeklyReset === 'function') {
        try {
          onWeeklyReset();
        } catch (callbackErr) {
          console.error('[重置] 每周重置回调执行失败:', callbackErr);
        }
      }
    } catch (e) {
      console.error('[重置] 历史快照保存失败:', e);
    }

    for (const role of Object.keys(data.characters)) {
      const char = data.characters[role];
      for (const weekly of config.weeklies) {
        char.weeklies[weekly.key] = 0;
      }
    }
    data.lastWeeklyReset = prevWeeklyResetPoint.toISOString();
    isChanged = true;
  }

  return isChanged;
}
