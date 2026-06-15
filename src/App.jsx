import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [config, setConfig] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // 密码访问验证状态
  const [needPassword, setNeedPassword] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [nickname, setNickname] = useState('');
  const [isMultiUser, setIsMultiUser] = useState(false);

  // 黄金鹅弹窗状态
  const [activeGooseRole, setActiveGooseRole] = useState(null);
  const [gooseDateInput, setGooseDateInput] = useState('');

  // 配置抽屉状态
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);
  const [drawerConfig, setDrawerConfig] = useState(null);
  const [newRoleInput, setNewRoleInput] = useState('');
  const [newWeeklyInput, setNewWeeklyInput] = useState({ name: '', key: '', baseCount: 1 });
  const [draggedWeeklyIndex, setDraggedWeeklyIndex] = useState(null);

  // 历史记录状态
  const [historyList, setHistoryList] = useState([]);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  // 备忘录标签输入绑定与 Ref
  const [newTagInput, setNewTagInput] = useState('');
  const memoInputRef = useRef(null);

  // 备忘录保存状态
  const [memoStatus, setMemoStatus] = useState('已保存');

  // 防抖 Ref
  const saveDebounceRef = useRef(null);

  // 自定义确认弹窗状态
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: '确认',
    cancelText: '取消',
    danger: false
  });

  // 全局 Toast 提示状态
  const [toast, setToast] = useState({
    show: false,
    message: '',
    type: 'success' // 'success' | 'error' | 'warning'
  });
  const toastTimerRef = useRef(null);

  // 触发 Toast 提示
  const showToast = (message, type = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ show: true, message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // 封装统一授权请求方法
  const authFetch = async (url, options = {}) => {
    const password = localStorage.getItem('altea_ledger_password') || '';
    const headers = {
      ...options.headers,
    };
    if (password) {
      headers['Authorization'] = `Bearer ${password}`;
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      localStorage.removeItem('altea_ledger_password');
      setNeedPassword(true);
      throw new Error('UNAUTHORIZED');
    }
    return res;
  };

  // 处理登录密码校验提交
  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!loginPassword.trim()) {
      setLoginError('请输入访问密码');
      return;
    }

    setLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/status', {
        headers: {
          'Authorization': `Bearer ${loginPassword}`
        }
      });

      if (res.status === 401) {
        setLoading(false);
        setLoginError('密码错误，请重新输入');
        return;
      }

      if (!res.ok) {
        setLoading(false);
        setLoginError('网络错误，请稍后重试');
        return;
      }

      const result = await res.json();
      localStorage.setItem('altea_ledger_password', loginPassword);
      setNickname(result.nickname || '');
      setIsMultiUser(!!result.isMultiUser);
      setConfig(result.config);
      setData(result.data);
      setDrawerConfig(JSON.parse(JSON.stringify(result.config)));
      setNeedPassword(false);
      setLoading(false);
      showToast('验证成功，已进入系统', 'success');
    } catch (err) {
      console.error(err);
      setLoading(false);
      setLoginError('连接服务端失败，请检查网络');
    }
  };

  // 打开确认弹窗的辅助方法
  const triggerConfirm = ({ title, message, onConfirm, confirmText = '确认', cancelText = '取消', danger = false }) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
      confirmText,
      cancelText,
      danger
    });
  };

  // 获取历史版本列表
  const fetchHistory = async () => {
    try {
      const res = await authFetch('/api/history');
      const result = await res.json();
      setHistoryList(result);
    } catch (err) {
      console.error('获取历史记录失败:', err);
    }
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await authFetch('/api/status');
        const result = await res.json();
        setNickname(result.nickname || '');
        setIsMultiUser(!!result.isMultiUser);
        setConfig(result.config);
        setData(result.data);
        setDrawerConfig(JSON.parse(JSON.stringify(result.config))); // 深拷贝供抽屉使用
        setLoading(false);
      } catch (err) {
        if (err.message === 'UNAUTHORIZED') {
          setLoading(false);
        } else {
          console.error('获取服务端数据失败，正在尝试重试...', err);
        }
      }
    };
    fetchStatus();
  }, []);

  const handleOpenHistory = () => {
    setIsHistoryDrawerOpen(true);
    fetchHistory();
  };

  // 辅助：执行保存（包含即时保存）
  const saveToServer = async (updatedCharacters, updatedMemo) => {
    try {
      const res = await authFetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characters: updatedCharacters,
          globalMemo: updatedMemo
        })
      });
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (err) {
      console.error('保存数据失败:', err);
    }
  };

  // 辅助：防抖保存（针对文本/数值输入）
  const triggerDebouncedSave = (updatedCharacters, updatedMemo) => {
    setMemoStatus('正在保存...');
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }
    saveDebounceRef.current = setTimeout(() => {
      saveToServer(updatedCharacters, updatedMemo).then(() => {
        setMemoStatus('已保存');
      });
    }, 600);
  };

  // 1. 资产变动处理（防抖）
  const handleAssetChange = (role, key, val) => {
    const updated = { ...data.characters };
    updated[role].assets[key] = val;
    setData({ ...data, characters: updated });
    triggerDebouncedSave(updated, data.globalMemo);
  };

  // 2. 每日单项 Toggle 按钮（立即保存）
  const handleDailyToggle = (role, key) => {
    const updated = { ...data.characters };
    updated[role].dailies[key] = !updated[role].dailies[key];
    setData({ ...data, characters: updated });
    saveToServer(updated, data.globalMemo);
  };

  // 3. 每日挂机阶段切换（0 -> 1 -> 2 -> 3 -> 4 -> 0，立即保存）
  const handleStageChange = (role, key, maxStage) => {
    const updated = { ...data.characters };
    let current = updated[role].dailies[key] || 0;
    current = (current + 1) % (maxStage + 1);
    updated[role].dailies[key] = current;
    setData({ ...data, characters: updated });
    saveToServer(updated, data.globalMemo);
  };

  // 4. 周常关卡点击（通关数 + 1，直到 baseCount + 1，再重置为 0，立即保存）
  const handleWeeklyClick = (role, key, baseCount) => {
    const updated = { ...data.characters };
    let current = updated[role].weeklies[key] || 0;
    const maxLimit = baseCount + 1;
    current = (current + 1) % (maxLimit + 1);
    updated[role].weeklies[key] = current;
    setData({ ...data, characters: updated });
    saveToServer(updated, data.globalMemo);
  };

  // 5. 周常关卡微调：加减操作（立即保存）
  const handleWeeklyAdjust = (e, role, key, amount) => {
    e.stopPropagation();
    const updated = { ...data.characters };
    let current = updated[role].weeklies[key] || 0;
    current = Math.max(0, current + amount);
    updated[role].weeklies[key] = current;
    setData({ ...data, characters: updated });
    saveToServer(updated, data.globalMemo);
  };

  // 6. 备忘录标签添加（回车触发）
  const handleAddMemoTag = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tag = newTagInput.trim();
      if (tag) {
        const currentMemo = Array.isArray(data.globalMemo)
          ? [...data.globalMemo]
          : typeof data.globalMemo === 'string' && data.globalMemo
            ? [data.globalMemo]
            : [];
        if (!currentMemo.includes(tag)) {
          const updatedMemo = [...currentMemo, tag];
          setData({ ...data, globalMemo: updatedMemo });
          setNewTagInput('');
          saveToServer(data.characters, updatedMemo);
        } else {
          showToast('该备忘标签已存在', 'warning');
        }
      }
    }
  };

  // 7. 备忘录标签删除
  const handleRemoveMemoTag = (tagToRemove) => {
    const currentMemo = Array.isArray(data.globalMemo)
      ? data.globalMemo
      : typeof data.globalMemo === 'string' && data.globalMemo
        ? [data.globalMemo]
        : [];
    const updatedMemo = currentMemo.filter(t => t !== tagToRemove);
    setData({ ...data, globalMemo: updatedMemo });
    saveToServer(data.characters, updatedMemo);
  };

  // 8. 黄金鹅到期时间配置弹窗
  const openGooseModal = (role) => {
    setActiveGooseRole(role);
    const currentVal = data.characters[role].assets.goldenGoose || '';
    if (currentVal) {
      const d = new Date(currentVal);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
      setGooseDateInput(localISOTime);
    } else {
      setGooseDateInput('');
    }
  };

  const handleSaveGooseDate = () => {
    if (!activeGooseRole) return;
    const updated = { ...data.characters };
    updated[activeGooseRole].assets.goldenGoose = gooseDateInput ? new Date(gooseDateInput).toISOString() : '';
    setData({ ...data, characters: updated });
    saveToServer(updated, data.globalMemo);
    setActiveGooseRole(null);
  };

  const handleQuickAddGooseDays = (days) => {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + days);
    const tzOffset = baseDate.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(baseDate.getTime() - tzOffset)).toISOString().slice(0, 16);
    setGooseDateInput(localISOTime);
  };

  const handleClearGoose = (role) => {
    const updated = { ...data.characters };
    updated[role].assets.goldenGoose = '';
    setData({ ...data, characters: updated });
    saveToServer(updated, data.globalMemo);
    setActiveGooseRole(null);
  };

  // 9. 手动强制重置
  const handleForceReset = async (type) => {
    try {
      const res = await authFetch('/api/force-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        showToast('重置成功！', 'success');
      } else {
        showToast('重置失败：' + (result.message || '未知错误'), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('操作失败，请检查网络或后端服务', 'error');
    }
  };

  // 10. 一键清空所有历史归档记录
  const handleClearAllHistory = async () => {
    try {
      const res = await authFetch('/api/history/clear', {
        method: 'POST'
      });
      const result = await res.json();
      if (result.success) {
        setHistoryList([]);
        showToast('所有历史归档已被成功清空！', 'success');
      }
    } catch (err) {
      console.error('清空历史归档失败:', err);
      showToast('操作失败，请检查后端服务', 'error');
    }
  };

  // 注销登录并回到验证锁屏
  const handleLogout = () => {
    triggerConfirm({
      title: '🚪 退出登录',
      message: '确定要退出当前账号并切换身份吗？',
      confirmText: '确认退出',
      onConfirm: () => {
        localStorage.removeItem('altea_ledger_password');
        setNickname('');
        setIsMultiUser(false);
        setConfig(null);
        setData(null);
        setNeedPassword(true);
        showToast('已安全退出登录', 'success');
      }
    });
  };

  // 11. 配置抽屉的增删改查
  const handleRemoveRole = (role) => {
    const updatedRoles = drawerConfig.roles.filter(r => r !== role);
    setDrawerConfig({ ...drawerConfig, roles: updatedRoles });
  };

  const handleAddRole = () => {
    if (!newRoleInput.trim()) return;
    if (drawerConfig.roles.includes(newRoleInput.trim())) {
      showToast('该角色已存在', 'warning');
      return;
    }
    const updatedRoles = [...drawerConfig.roles, newRoleInput.trim()];
    setDrawerConfig({ ...drawerConfig, roles: updatedRoles });
    setNewRoleInput('');
  };

  const handleRemoveWeekly = (key) => {
    const updatedWeeklies = drawerConfig.weeklies.filter(w => w.key !== key);
    setDrawerConfig({ ...drawerConfig, weeklies: updatedWeeklies });
  };

  const handleAddWeekly = () => {
    if (!newWeeklyInput.name.trim() || !newWeeklyInput.key.trim()) return;
    if (drawerConfig.weeklies.some(w => w.key === newWeeklyInput.key.trim())) {
      showToast('已存在相同英文Key的关卡', 'warning');
      return;
    }
    const updatedWeeklies = [...drawerConfig.weeklies, {
      key: newWeeklyInput.key.trim(),
      name: newWeeklyInput.name.trim(),
      baseCount: Number(newWeeklyInput.baseCount) || 1
    }];
    setDrawerConfig({ ...drawerConfig, weeklies: updatedWeeklies });
    setNewWeeklyInput({ name: '', key: '', baseCount: 1 });
  };

  const handleAdjustWeeklyBaseCount = (key, amount) => {
    const updatedWeeklies = drawerConfig.weeklies.map(w => {
      if (w.key === key) {
        return { ...w, baseCount: Math.max(1, w.baseCount + amount) };
      }
      return w;
    });
    setDrawerConfig({ ...drawerConfig, weeklies: updatedWeeklies });
  };

  const handleSaveConfig = async () => {
    try {
      const res = await authFetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(drawerConfig)
      });
      const result = await res.json();
      if (result.success) {
        if (drawerConfig.adminPassword !== undefined) {
          localStorage.setItem('altea_ledger_password', drawerConfig.adminPassword);
        }
        setConfig(result.config);
        setData(result.data);
        setIsConfigDrawerOpen(false);
        showToast('配置修改成功！已安全清理数据。', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('修改配置失败，请检查网络', 'error');
    }
  };

  const handleWeeklyDragStart = (e, index) => {
    setDraggedWeeklyIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleWeeklyDragOver = (e, index) => {
    e.preventDefault();
    if (draggedWeeklyIndex === null || draggedWeeklyIndex === index) return;

    const updatedWeeklies = [...drawerConfig.weeklies];
    const draggedItem = updatedWeeklies[draggedWeeklyIndex];
    updatedWeeklies.splice(draggedWeeklyIndex, 1);
    updatedWeeklies.splice(index, 0, draggedItem);

    setDraggedWeeklyIndex(index);
    setDrawerConfig({
      ...drawerConfig,
      weeklies: updatedWeeklies
    });
  };

  const handleWeeklyDragEnd = () => {
    setDraggedWeeklyIndex(null);
  };

  // 渲染辅助函数：黄金鹅 Buff 状态文本
  const renderGoldenGoose = (role) => {
    const gooseVal = data.characters[role].assets.goldenGoose;
    if (!gooseVal) return <span style={{ opacity: 0.4 }}>未启用</span>;

    const expiration = new Date(gooseVal);
    const now = new Date();
    const diffMs = expiration - now;

    if (diffMs <= 0) {
      return <span className="goose-expired-txt">已过期</span>;
    }

    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const diffHours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (diffDays > 0) {
      return <span>剩 {diffDays}天{diffHours}时</span>;
    }
    return <span>剩 {diffHours}小时</span>;
  };

  // 渲染辅助：获取黄金鹅到期样式类
  const getGooseCellClass = (role) => {
    const gooseVal = data.characters[role].assets.goldenGoose;
    if (!gooseVal) return '';
    const expiration = new Date(gooseVal);
    const now = new Date();
    return expiration > now ? 'goose-active' : 'goose-expired';
  };

  // 解析当前标签备忘列表
  const getMemoTags = () => {
    if (!data || !data.globalMemo) return [];
    if (Array.isArray(data.globalMemo)) return data.globalMemo;
    if (typeof data.globalMemo === 'string') {
      return data.globalMemo.split('\n').filter(Boolean);
    }
    return [];
  };

  if (loading) {
    return (
      <div className="loading-container" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#fff',
        fontFamily: 'sans-serif',
        background: '#121214'
      }}>
        <div className="loading-spinner" style={{
          border: '4px solid rgba(255,255,255,0.1)',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          borderLeftColor: '#c084fc',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <div style={{ marginTop: '16px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
          正在加载阿尔特里亚大陆考勤簿...
        </div>
      </div>
    );
  }

  if (needPassword) {
    return (
      <div className="login-container">
        <div className="login-card glass-panel">
          <div className="login-header">
            <span className="lock-icon">🔒</span>
            <h2>阿尔特里亚大陆考勤簿</h2>
            <p>系统已启用访问验证，请输入密码以继续</p>
          </div>
          <form onSubmit={handleLoginSubmit} className="login-form">
            <input
              type="password"
              placeholder="请输入系统访问密码"
              value={loginPassword}
              onChange={(e) => {
                setLoginPassword(e.target.value);
                setLoginError('');
              }}
              autoFocus
            />
            {loginError && <div className="login-error-msg">{loginError}</div>}
            <button type="submit" className="btn-primary login-btn">
              验证并进入
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!config || !data) {
    return (
      <div className="loading-container" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#fff',
        fontFamily: 'sans-serif',
        background: '#121214'
      }}>
        <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
          加载数据失败，请刷新页面重试。
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* 顶部 Header */}
      <header className="app-header glass-panel">
        <div className="brand-section">
          <h1>🐉 阿尔特里亚大陆考勤簿</h1>
          <div className="brand-subtitle">每日 09:00 重置 · 每周六 09:00 重置 | 本地 JSON 安全存储</div>
        </div>
        <div className="header-actions">
          {nickname && (
            <div className="user-info">
              <span className="user-avatar">👤</span>
              <span className="user-name">{nickname}</span>
              <button
                className="btn-logout"
                title="注销/切换账号"
                onClick={handleLogout}
              >
                🚪
              </button>
            </div>
          )}
          <button
            className="btn-icon"
            title="强制每日重置"
            onClick={() => triggerConfirm({
              title: '☀️ 强制每日重置',
              message: '确定要强制清除所有角色的【每日签到挂机】进度吗？',
              confirmText: '确认重置',
              danger: true,
              onConfirm: () => handleForceReset('daily')
            })}
          >
            ☀️
          </button>
          <button
            className="btn-icon"
            title="强制每周重置"
            onClick={() => triggerConfirm({
              title: '📅 强制每周重置',
              message: '确定要强制清除所有角色的【每周关卡】进度吗？',
              confirmText: '确认重置',
              danger: true,
              onConfirm: () => handleForceReset('weekly')
            })}
          >
            📅
          </button>
          <button className="btn-icon" title="历史记录" onClick={handleOpenHistory}>⏳</button>
          <button className="btn-icon" title="设置" onClick={() => setIsConfigDrawerOpen(true)}>⚙️</button>
        </div>
      </header>

      {/* 主布局 */}
      <main className="main-layout">

        {/* 左侧大表格 */}
        <section className="tracker-panel glass-panel">
          <div className="table-wrapper">
            <table className="tracker-table">
              <thead>
                <tr>
                  <th className="col-item-name">项目 \ 角色</th>
                  {config.roles.map(role => (
                    <th key={role} className="col-role-header">{role}</th>
                  ))}
                </tr>
              </thead>
              <tbody>

                {/* 角色资产渲染 (金币、时装) */}
                {config.assets.map(asset => {
                  if (asset.type === 'datetime') {
                    return null;
                  }
                  return (
                    <tr key={asset.key}>
                      <td className="col-item-name">{asset.name}</td>
                      {config.roles.map(role => {
                        const val = data.characters[role]?.assets[asset.key] || 0;
                        return (
                          <td key={role}>
                            <div className="asset-input-wrapper">
                              <input
                                type="number"
                                className="asset-input"
                                value={val || ''}
                                onChange={(e) => handleAssetChange(role, asset.key, Number(e.target.value))}
                                placeholder="0"
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* 黄金鹅 Buff 状态 */}
                <tr>
                  <td className="col-item-name">黄金鹅</td>
                  {config.roles.map(role => {
                    return (
                      <td key={role}>
                        <div
                          className={`goose-cell ${getGooseCellClass(role)}`}
                          onClick={() => openGooseModal(role)}
                        >
                          {renderGoldenGoose(role)}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* 每日重置行分割 */}
                <tr className="row-divider">
                  <td colSpan={config.roles.length + 1}>
                    <div className="row-divider-label">每日重置 (09:00)</div>
                  </td>
                </tr>

                {/* 每日任务行 */}
                {config.dailies.map(daily => {
                  if (daily.type === 'stage') {
                    return null;
                  }
                  return (
                    <tr key={daily.key}>
                      <td className="col-item-name">{daily.name}</td>
                      {config.roles.map(role => {
                        const isActive = data.characters[role]?.dailies[daily.key] || false;
                        return (
                          <td key={role}>
                            <div
                              className={`toggle-cell ${isActive ? 'active' : ''}`}
                              onClick={() => handleDailyToggle(role, daily.key)}
                            >
                              {isActive ? '✓' : ''}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* 挂机阶段任务 */}
                {config.dailies.filter(d => d.type === 'stage').map(daily => (
                  <tr key={daily.key}>
                    <td className="col-item-name">{daily.name}</td>
                    {config.roles.map(role => {
                      const stage = data.characters[role]?.dailies[daily.key] || 0;
                      const isComplete = stage === daily.maxStage;
                      return (
                        <td key={role}>
                          <div
                            className="stage-cell"
                            onClick={() => handleStageChange(role, daily.key, daily.maxStage)}
                          >
                            <div className="stage-dots">
                              {[1, 2, 3, 4].map(idx => (
                                <div
                                  key={idx}
                                  className={`stage-dot ${stage >= idx ? (isComplete ? 'all-filled' : 'filled') : ''}`}
                                />
                              ))}
                            </div>
                            <span className={`stage-label ${isComplete ? 'completed' : ''}`}>
                              {stage}/{daily.maxStage}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* 每周重置行分割 */}
                <tr className="row-divider">
                  <td colSpan={config.roles.length + 1}>
                    <div className="row-divider-label">每周重置 (周六 09:00)</div>
                  </td>
                </tr>

                {/* 每周关卡渲染 */}
                {config.weeklies.map(weekly => {
                  return (
                    <tr key={weekly.key}>
                      <td className="col-item-name">{weekly.name}</td>
                      {config.roles.map(role => {
                        const count = data.characters[role]?.weeklies[weekly.key] || 0;
                        const baseCount = weekly.baseCount;

                        let cellClass = '';
                        if (count > 0) {
                          if (count >= baseCount) {
                            cellClass = 'complete glow-complete';
                          } else {
                            cellClass = 'in-progress glow-progress';
                          }
                        }

                        return (
                          <td key={role}>
                            <div
                              className={`weekly-cell ${cellClass}`}
                              onClick={() => handleWeeklyClick(role, weekly.key, baseCount)}
                            >
                              {count > 0 ? `${count}/${baseCount}` : '—'}

                              {/* 微调按钮组 */}
                              <div className="cell-adjust-btns">
                                <button
                                  className="adjust-btn"
                                  onClick={(e) => handleWeeklyAdjust(e, role, weekly.key, 1)}
                                >
                                  +
                                </button>
                                <button
                                  className="adjust-btn"
                                  onClick={(e) => handleWeeklyAdjust(e, role, weekly.key, -1)}
                                >
                                  -
                                </button>
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

              </tbody>
            </table>
          </div>
        </section>

        {/* 右侧边栏：全局备忘 (流式标签版) */}
        <aside className="sidebar-panel">

          <div
            className="memo-card glass-panel"
            onClick={() => memoInputRef.current && memoInputRef.current.focus()}
          >
            <h2>📌 全局备忘</h2>
            <div className="memo-tags-list">
              {getMemoTags().map((tag, idx) => (
                <div className="memo-tag" key={idx} onClick={(e) => e.stopPropagation()}>
                  <span>{tag}</span>
                  <button
                    className="btn-remove-memo-tag"
                    onClick={() => handleRemoveMemoTag(tag)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <input
                ref={memoInputRef}
                type="text"
                className="memo-input"
                placeholder={getMemoTags().length === 0 ? "输入备忘后回车..." : ""}
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={handleAddMemoTag}
              />
            </div>
            <div className="memo-status">{memoStatus}</div>
          </div>

        </aside>
      </main>

      {/* 黄金鹅 Buff 设置弹窗 */}
      {activeGooseRole && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h3>🦢 配置 【{activeGooseRole}】 的黄金鹅 Buff</h3>
              <button style={{ fontSize: '1.2rem' }} onClick={() => setActiveGooseRole(null)}>×</button>
            </div>

            <div className="input-label-group">
              <label>手动选择到期日期 和 时间：</label>
              <input
                type="datetime-local"
                value={gooseDateInput}
                onChange={(e) => setGooseDateInput(e.target.value)}
              />
            </div>

            <div className="quick-days-btns">
              <button className="btn-quick-day" onClick={() => handleQuickAddGooseDays(7)}>+7 天</button>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setActiveGooseRole(null)}>取消</button>
              <button className="btn-danger" onClick={() => handleClearGoose(activeGooseRole)}>清除 Buff</button>
              <button className="btn-success btn-primary" onClick={handleSaveGooseDate}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 历史记录侧边抽屉 */}
      {isHistoryDrawerOpen && (
        <div className="drawer-backdrop" onClick={() => setIsHistoryDrawerOpen(false)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h2>⏳ 历史周常存档</h2>
              <button style={{ fontSize: '1.5rem' }} onClick={() => setIsHistoryDrawerOpen(false)}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {historyList.length === 0 ? (
                <div style={{ textAlign: 'center', opacity: 0.4, padding: '40px 0', fontSize: '0.9rem' }}>
                  暂无已保存的周常历史存档
                </div>
              ) : (
                historyList.map(item => (
                  <div className="config-list-item" key={item.id}>
                    <div>
                      <div style={{ fontWeight: '600' }}>
                        {new Date(item.resetTime).toLocaleString('zh-CN', { hour12: false })}
                      </div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.4, marginTop: 2 }}>
                        归档角色数: {Object.keys(item.snapshot.characters).length} 个
                      </div>
                    </div>
                    <button
                      className="btn-primary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      onClick={() => setSelectedHistoryItem(item)}
                    >
                      👁️ 查看
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 历史快照详情 Modal 弹窗 */}
      {selectedHistoryItem && (
        <div className="modal-backdrop" style={{ zIndex: 300 }} onClick={() => setSelectedHistoryItem(null)}>
          <div
            className="modal-content glass-panel"
            style={{ width: '1000px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
              <h3 style={{ color: '#c084fc', fontSize: '1.1rem' }}>
                ⏳ 归档快照详情 ({new Date(selectedHistoryItem.resetTime).toLocaleString('zh-CN', { hour12: false })})
              </h3>
              <button style={{ fontSize: '1.5rem' }} onClick={() => setSelectedHistoryItem(null)}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 12, marginTop: 12 }}>

              {/* 只读表格 */}
              <div className="table-wrapper" style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                <table className="tracker-table">
                  <thead>
                    <tr>
                      <th className="col-item-name">项目 \ 角色</th>
                      {Object.keys(selectedHistoryItem.snapshot.characters).map(role => (
                        <th key={role} className="col-role-header">{role}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>

                    {/* 资产 */}
                    {config.assets.filter(a => a.type !== 'datetime').map(asset => (
                      <tr key={asset.key}>
                        <td className="col-item-name">{asset.name}</td>
                        {Object.keys(selectedHistoryItem.snapshot.characters).map(role => {
                          const char = selectedHistoryItem.snapshot.characters[role];
                          const val = char?.assets?.[asset.key] || 0;
                          return <td key={role} style={{ fontWeight: '600' }}>{val}</td>;
                        })}
                      </tr>
                    ))}

                    {/* 黄金鹅 */}
                    <tr>
                      <td className="col-item-name">黄金鹅</td>
                      {Object.keys(selectedHistoryItem.snapshot.characters).map(role => {
                        const char = selectedHistoryItem.snapshot.characters[role];
                        const val = char?.assets?.goldenGoose;
                        return (
                          <td key={role} style={{ fontSize: '0.75rem', opacity: val ? 1 : 0.4 }}>
                            {val ? new Date(val).toLocaleDateString('zh-CN') : '未启用'}
                          </td>
                        );
                      })}
                    </tr>

                    {/* 周常重置分割 */}
                    <tr className="row-divider">
                      <td colSpan={Object.keys(selectedHistoryItem.snapshot.characters).length + 1}>
                        <div className="row-divider-label">周常关卡状态（归档）</div>
                      </td>
                    </tr>

                    {/* 周常关卡 */}
                    {config.weeklies.map(weekly => (
                      <tr key={weekly.key}>
                        <td className="col-item-name">{weekly.name}</td>
                        {Object.keys(selectedHistoryItem.snapshot.characters).map(role => {
                          const char = selectedHistoryItem.snapshot.characters[role];
                          const count = char?.weeklies?.[weekly.key] || 0;
                          const baseCount = weekly.baseCount;

                          let cellClass = '';
                          if (count > 0) {
                            if (count >= baseCount) {
                              cellClass = 'complete';
                            } else {
                              cellClass = 'in-progress';
                            }
                          }
                          return (
                            <td key={role}>
                              <div className={`weekly-cell ${cellClass}`} style={{ cursor: 'default' }}>
                                {count > 0 ? `${count}/${baseCount}` : '—'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                  </tbody>
                </table>
              </div>

              {/* 归档备忘 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <h4 style={{ color: '#fda4af', fontSize: '0.85rem', fontWeight: '700' }}>📌 归档全局备忘</h4>
                <div style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  padding: 8,
                  borderRadius: 8,
                  maxHeight: '340px',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(() => {
                      const rawMemo = selectedHistoryItem.snapshot.globalMemo;
                      const memoArray = Array.isArray(rawMemo)
                        ? rawMemo
                        : typeof rawMemo === 'string' && rawMemo
                          ? rawMemo.split('\n').filter(Boolean)
                          : [];
                      if (memoArray.length === 0) {
                        return <span style={{ opacity: 0.4, fontSize: '0.8rem' }}>（无备忘内容）</span>;
                      }
                      return memoArray.map((tag, idx) => (
                        <div className="memo-tag" key={idx} style={{ cursor: 'default' }}>
                          <span>{tag}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
                <button
                  className="btn-primary"
                  style={{ background: 'rgba(255,255,255,0.05)', boxShadow: 'none', width: '100%', padding: '8px' }}
                  onClick={() => setSelectedHistoryItem(null)}
                >
                  关闭详情
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 在线配置抽屉 */}
      {isConfigDrawerOpen && drawerConfig && (
        <div className="drawer-backdrop" onClick={() => setIsConfigDrawerOpen(false)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h2>⚙️ 配置管理面板</h2>
              <button style={{ fontSize: '1.5rem' }} onClick={() => setIsConfigDrawerOpen(false)}>×</button>
            </div>

            {/* 角色管理 */}
            <div className="config-section">
              <h3>角色管理</h3>
              <div className="roles-tags">
                {drawerConfig.roles.map(r => (
                  <div className="role-tag" key={r}>
                    <span>{r}</span>
                    <button className="btn-remove-tag" onClick={() => handleRemoveRole(r)}>×</button>
                  </div>
                ))}
              </div>
              <div className="add-input-group">
                <input
                  type="text"
                  placeholder="新角色名称"
                  value={newRoleInput}
                  onChange={(e) => setNewRoleInput(e.target.value)}
                />
                <button className="btn-primary" style={{ padding: '6px 14px' }} onClick={handleAddRole}>新增</button>
              </div>
            </div>

            {/* 关卡管理 */}
            <div className="config-section">
              <h3>周常关卡配置</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                {drawerConfig.weeklies.map((w, index) => {
                  const isDragging = index === draggedWeeklyIndex;
                  return (
                    <div
                      className={`config-list-item ${isDragging ? 'dragging' : ''}`}
                      key={w.key}
                      draggable
                      onDragStart={(e) => handleWeeklyDragStart(e, index)}
                      onDragOver={(e) => handleWeeklyDragOver(e, index)}
                      onDragEnd={handleWeeklyDragEnd}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="drag-handle" title="拖动排序">⋮⋮</span>
                        <span>{w.name} <span style={{ opacity: 0.4, fontSize: '0.8rem' }}>({w.key})</span></span>
                      </div>
                      <div className="config-list-item-actions" onDragStart={(e) => e.preventDefault()} draggable={false}>
                        <div className="count-adjuster">
                          <button className="btn-count-adjust" onClick={() => handleAdjustWeeklyBaseCount(w.key, -1)}>-</button>
                          <span>基准:{w.baseCount}</span>
                          <button className="btn-count-adjust" onClick={() => handleAdjustWeeklyBaseCount(w.key, 1)}>+</button>
                        </div>
                        <button className="btn-delete-item" onClick={() => handleRemoveWeekly(w.key)}>删除</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="add-input-group" style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  placeholder="关卡中文名 (如: 绿龙)"
                  value={newWeeklyInput.name}
                  onChange={(e) => setNewWeeklyInput({ ...newWeeklyInput, name: e.target.value })}
                  style={{ width: '40%' }}
                />
                <input
                  type="text"
                  placeholder="英文Key (如: green)"
                  value={newWeeklyInput.key}
                  onChange={(e) => setNewWeeklyInput({ ...newWeeklyInput, key: e.target.value })}
                  style={{ width: '35%' }}
                />
                <input
                  type="number"
                  placeholder="基准数"
                  value={newWeeklyInput.baseCount}
                  onChange={(e) => setNewWeeklyInput({ ...newWeeklyInput, baseCount: Number(e.target.value) || 1 })}
                  style={{ width: '20%' }}
                />
                <button className="btn-primary" style={{ padding: '6px' }} onClick={handleAddWeekly}>添加</button>
              </div>
            </div>

            {/* 重置时间配置 */}
            <div className="config-section">
              <h3>重置规则配置</h3>
              <div className="reset-inputs-row">
                <div className="input-label-group">
                  <label>每日重置时间（点）</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={drawerConfig.resetConfig.dailyResetHour}
                    onChange={(e) => setDrawerConfig({
                      ...drawerConfig,
                      resetConfig: { ...drawerConfig.resetConfig, dailyResetHour: Number(e.target.value) }
                    })}
                  />
                </div>
                <div className="input-label-group">
                  <label>每周重置星期（6=周六）</label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    value={drawerConfig.resetConfig.weeklyResetDay}
                    onChange={(e) => setDrawerConfig({
                      ...drawerConfig,
                      resetConfig: { ...drawerConfig.resetConfig, weeklyResetDay: Number(e.target.value) }
                    })}
                  />
                </div>
              </div>
              <div className="reset-inputs-row" style={{ marginTop: 8 }}>
                <div className="input-label-group">
                  <label>每周重置时间（点）</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={drawerConfig.resetConfig.weeklyResetHour}
                    onChange={(e) => setDrawerConfig({
                      ...drawerConfig,
                      resetConfig: { ...drawerConfig.resetConfig, weeklyResetHour: Number(e.target.value) }
                    })}
                  />
                </div>
              </div>
            </div>

            {/* 历史版本配置区块 */}
            <div className="config-section">
              <h3>历史归档与上限设置</h3>
              <div className="input-label-group">
                <label>最多保留历史版本数量（上限）</label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={drawerConfig.maxHistoryCount || 50}
                  onChange={(e) => setDrawerConfig({
                    ...drawerConfig,
                    maxHistoryCount: Number(e.target.value) || 50
                  })}
                />
              </div>
              <div style={{ marginTop: '6px', paddingTop: '10px', borderTop: '1px dashed rgba(255,255,255,0.06)' }}>
                <button
                  className="btn-danger"
                  style={{ width: '100%', padding: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '6px', fontSize: '0.78rem' }}
                  onClick={() => triggerConfirm({
                    title: '🗑️ 清空所有历史归档',
                    message: '警告：确定要彻底清空所有的每周历史归档记录吗？该操作不可撤销！',
                    confirmText: '彻底清空',
                    danger: true,
                    onConfirm: handleClearAllHistory
                  })}
                >
                  🗑️ 清空所有历史归档记录
                </button>
              </div>
            </div>

            {/* 安全验证与密码设置 */}
            <div className="config-section">
              <h3>安全与访问密码设置</h3>
              <div className="input-label-group">
                {isMultiUser ? (
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.45)', padding: '6px 0', lineHeight: '1.4' }}>
                    👥 多用户模式下，访问密码由系统管理员在环境变量 <code>USERS_AUTH</code> 中统一配置，此处不支持自助修改。
                  </div>
                ) : (
                  <>
                    <label>系统访问密码（留空表示不需要密码验证）</label>
                    <input
                      type="password"
                      placeholder="留空表示免密直接访问"
                      value={drawerConfig.adminPassword || ''}
                      onChange={(e) => setDrawerConfig({
                        ...drawerConfig,
                        adminPassword: e.target.value
                      })}
                    />
                  </>
                )}
              </div>
            </div>

            <button className="btn-save-config btn-primary" onClick={handleSaveConfig}>
              保存并应用新配置
            </button>
          </div>
        </div>
      )}

      {/* 确认模态框 */}
      {confirmModal.isOpen && (
        <div className="modal-backdrop confirm-modal-backdrop" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="modal-content glass-panel confirm-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{confirmModal.title}</h3>
              <button className="btn-close-modal" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }} onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>×</button>
            </div>
            <div className="modal-body confirm-modal-body" style={{ margin: '15px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '0.95rem', color: '#f3f4f6', lineHeight: '1.6' }}>{confirmModal.message}</p>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>
                {confirmModal.cancelText}
              </button>
              <button
                className={`btn-primary ${confirmModal.danger ? 'btn-danger' : ''}`}
                style={{
                  background: confirmModal.danger
                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                  boxShadow: confirmModal.danger
                    ? '0 2px 8px rgba(239, 68, 68, 0.3)'
                    : '0 2px 8px rgba(139, 92, 246, 0.3)'
                }}
                onClick={confirmModal.onConfirm}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 全局 Toast 提示 */}
      {toast.show && (
        <div className={`toast-container toast-${toast.type}`}>
          <div className="toast-icon">
            {toast.type === 'success' && '✓'}
            {toast.type === 'error' && '✗'}
            {toast.type === 'warning' && '⚠'}
          </div>
          <div className="toast-message">{toast.message}</div>
        </div>
      )}
    </div>
  );
}

export default App;
