import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const generateTxId = () => {
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
};

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

  // 通用时间类型资产弹窗状态
  const [activeDatetimeModal, setActiveDatetimeModal] = useState(null); // { role, key, name }
  const [datetimeInput, setDatetimeInput] = useState('');

  // 自定义资产配置状态
  const [newAssetInput, setNewAssetInput] = useState({ name: '', key: '', type: 'number', maxStage: 3 });
  const [draggedAssetIndex, setDraggedAssetIndex] = useState(null);

  // 配置抽屉状态
  const [isConfigDrawerOpen, setIsConfigDrawerOpen] = useState(false);
  const [drawerConfig, setDrawerConfig] = useState(null);
  const [newRoleInput, setNewRoleInput] = useState('');
  const [newWeeklyInput, setNewWeeklyInput] = useState({ name: '', key: '', baseCount: 1 });
  const [draggedWeeklyIndex, setDraggedWeeklyIndex] = useState(null);
  const [rolesWithId, setRolesWithId] = useState([]);
  const [draggedRoleIndex, setDraggedRoleIndex] = useState(null);

  // 历史记录状态
  const [historyList, setHistoryList] = useState([]);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

  // 备忘录标签输入绑定与 Ref
  const [newTagInput, setNewTagInput] = useState('');
  const memoInputRef = useRef(null);

  // 备忘录保存状态
  const [memoStatus, setMemoStatus] = useState('已保存');

  // 角色代办输入绑定
  const [todoInputs, setTodoInputs] = useState({});

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

  // 记账功能状态
  const [isLedgerDrawerOpen, setIsLedgerDrawerOpen] = useState(false);
  const [ledgerActiveTab, setLedgerActiveTab] = useState('list');
  const [newTxDate, setNewTxDate] = useState((new Date()).toISOString().split('T')[0]);
  const [newTxType, setNewTxType] = useState('expense');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxRemark, setNewTxRemark] = useState('');
  const [newTxIsGold, setNewTxIsGold] = useState(false);
  const [newTxGoldAmount, setNewTxGoldAmount] = useState('');
  const [newTxRatio, setNewTxRatio] = useState('');
  const [newTxFee, setNewTxFee] = useState('');
  const [importText, setImportText] = useState('');
  const [expandedYears, setExpandedYears] = useState({});

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
  const authFetch = useCallback(async (url, options = {}) => {
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
  }, []);

  // 统一从服务端获取最新配置与状态
  const fetchStatus = useCallback(async (isBackground = false) => {
    // 智能避让：如果处于后台刷新且用户正在输入（防抖定时器激活），则跳过本次刷新，防止覆盖用户输入
    if (isBackground && saveDebounceRef.current) {
      console.log('[自动刷新] 检测到用户正在输入中，已避让跳过本次自动刷新');
      return;
    }
    try {
      const res = await authFetch('/api/status');
      const result = await res.json();
      setNickname(result.nickname || '');
      setIsMultiUser(!!result.isMultiUser);
      setConfig(result.config);
      setData(result.data);
      setDrawerConfig(JSON.parse(JSON.stringify(result.config))); // 深拷贝供抽屉使用
      if (!isBackground) {
        setLoading(false);
      }
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') {
        if (!isBackground) {
          setLoading(false);
        }
      } else {
        console.error('获取服务端数据失败...', err);
      }
    }
  }, [authFetch]);

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
    // 首次载入拉取数据 (异步自执行避免 eslint 的同步 setState 警告)
    (async () => {
      await fetchStatus();
    })();

    // 如果处于等待输入密码状态，则不启动定时刷新
    if (needPassword) {
      return;
    }

    // 设置默认 10 分钟自动刷新
    const intervalId = setInterval(() => {
      fetchStatus(true);
    }, 10 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [needPassword, fetchStatus]);

  const handleOpenHistory = () => {
    setIsHistoryDrawerOpen(true);
    fetchHistory();
  };

  // 计算收支卡片总计
  const calculateLedgerSummary = () => {
    const txList = data?.transactions || [];
    let totalIncome = 0;
    let totalExpense = 0;
    let totalFee = 0;

    txList.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        totalIncome += amount;
        totalFee += (Number(tx.fee) || 0);
      } else {
        totalExpense += amount;
      }
    });

    const totalNet = totalIncome - totalExpense;
    return { totalIncome, totalExpense, totalFee, totalNet };
  };

  const { totalIncome, totalExpense, totalNet } = calculateLedgerSummary();

  const calculateYearStats = () => {
    const txList = data?.transactions || [];
    const stats = {};

    txList.forEach(tx => {
      const dateVal = tx.date || '';
      const year = dateVal.split('-')[0] || '未知年份';
      const month = dateVal.split('-')[1] || '未知月份';
      const amount = Number(tx.amount) || 0;
      const fee = Number(tx.fee) || 0;

      if (!stats[year]) {
        stats[year] = {
          net: 0,
          income: 0,
          expense: 0,
          fee: 0,
          months: {}
        };
      }

      if (!stats[year].months[month]) {
        stats[year].months[month] = {
          net: 0,
          income: 0,
          expense: 0,
          fee: 0
        };
      }

      if (tx.type === 'income') {
        stats[year].income += amount;
        stats[year].net += amount;
        stats[year].fee += fee;

        stats[year].months[month].income += amount;
        stats[year].months[month].net += amount;
        stats[year].months[month].fee += fee;
      } else {
        stats[year].expense += amount;
        stats[year].net -= amount;

        stats[year].months[month].expense += amount;
        stats[year].months[month].net -= amount;
      }
    });

    return stats;
  };

  const toggleYearExpand = (year) => {
    setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }));
  };

  // 添加收支交易记录
  const handleAddTransaction = () => {
    if (!newTxAmount || isNaN(Number(newTxAmount)) || Number(newTxAmount) <= 0) {
      showToast('请输入有效的金额（大于 0）', 'warning');
      return;
    }

    const feeVal = newTxFee && !isNaN(Number(newTxFee)) ? Number(newTxFee) : 0;
    if (feeVal < 0) {
      showToast('手续费不能为负数', 'warning');
      return;
    }

    // 智能自动备注
    let remarkVal = newTxRemark.trim();
    if (!remarkVal) {
      if (newTxIsGold) {
        remarkVal = newTxType === 'income' ? '卖金' : '买金';
      } else {
        remarkVal = newTxType === 'income' ? '普通收入' : '普通消费';
      }
    }

    const tx = {
      id: generateTxId(),
      date: newTxDate || (new Date()).toISOString().split('T')[0],
      type: newTxType,
      amount: Number(newTxAmount),
      remark: remarkVal,
      isGold: newTxIsGold,
      goldAmount: newTxIsGold && newTxGoldAmount ? Number(newTxGoldAmount) : '',
      ratio: newTxIsGold ? newTxRatio.trim() : '',
      fee: newTxIsGold && newTxType === 'income' ? feeVal : 0
    };

    const updatedTxList = [tx, ...(data?.transactions || [])];

    saveToServer(data.characters, data.globalMemo, updatedTxList);
    showToast('收支记录添加成功！', 'success');

    // 重置表单，但保留日期
    setNewTxAmount('');
    setNewTxRemark('');
    setNewTxIsGold(false);
    setNewTxGoldAmount('');
    setNewTxRatio('');
    setNewTxFee('');
  };

  // 删除收支交易记录（带确认）
  const handleDeleteTransaction = (id) => {
    triggerConfirm({
      title: '🗑️ 删除收支记录',
      message: '确定要彻底删除该笔收支记录吗？此操作不可撤销！',
      confirmText: '确定删除',
      danger: true,
      onConfirm: () => {
        const updatedTxList = (data?.transactions || []).filter(t => t.id !== id);
        saveToServer(data.characters, data.globalMemo, updatedTxList);
        showToast('记录已成功删除', 'success');
      }
    });
  };

  // 导入历史收支数据 (单行/多行文本，逗号分隔)
  const handleImportTransactions = (text) => {
    if (!text.trim()) {
      showToast('请输入要导入的数据', 'warning');
      return;
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const validTxs = [];
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    // eslint-disable-next-line react-hooks/purity
    const todayStr = (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];

    try {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#')) continue; // 跳过注释行

        const parts = line.replace(/，/g, ',').split(',').map(item => item.trim());

        // 1. 日期校验与处理
        let dateVal = parts[0] || '';
        if (!dateVal || dateVal === '-' || !/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(dateVal)) {
          if (dateVal && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
            // 标准格式保持原样
          } else {
            dateVal = todayStr;
          }
        }
        dateVal = dateVal.replace(/\//g, '-');

        // 2. 类型校验
        const typeText = parts[1] || '';
        let typeVal = '';
        if (typeText === '收入' || typeText === 'income') {
          typeVal = 'income';
        } else if (typeText === '支出' || typeText === '消费' || typeText === 'expense') {
          typeVal = 'expense';
        } else {
          showToast(`第 ${i + 1} 行导入失败：类型 "${typeText}" 不正确（必须是 收入/支出/消费）`, 'error');
          return;
        }

        // 3. 金额校验
        const amountVal = parts[2] ? Number(parts[2]) : NaN;
        if (isNaN(amountVal) || amountVal <= 0) {
          showToast(`第 ${i + 1} 行导入失败：金额 "${parts[2] || ''}" 不正确（必须是大于0的数字）`, 'error');
          return;
        }

        // 4. 是否为金币交易
        const isGoldText = parts[4] || '';
        const isGoldVal = isGoldText === '是' || isGoldText === 'true' || isGoldText === 'y' || isGoldText === '1';

        // 5. 金币相关数据
        const goldAmountVal = parts[5] && !isNaN(Number(parts[5])) ? Number(parts[5]) : '';
        const ratioVal = parts[6] || '';
        const feeVal = parts[7] && !isNaN(Number(parts[7])) ? Number(parts[7]) : 0;

        // 6. 备注处理
        let remarkVal = parts[3] || '';
        if (!remarkVal) {
          if (isGoldVal) {
            remarkVal = typeVal === 'income' ? '卖金' : '买金';
          } else {
            remarkVal = typeVal === 'income' ? '普通收入' : '普通消费';
          }
        }

        validTxs.push({
          // eslint-disable-next-line react-hooks/purity
          id: `tx_imported_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${i}`,
          date: dateVal,
          type: typeVal,
          amount: amountVal,
          remark: remarkVal,
          isGold: isGoldVal,
          goldAmount: isGoldVal ? goldAmountVal : '',
          ratio: isGoldVal ? ratioVal : '',
          fee: isGoldVal && typeVal === 'income' ? feeVal : 0
        });
      }

      if (validTxs.length === 0) {
        showToast('没有有效的账目数据可供导入', 'warning');
        return;
      }

      const currentList = data?.transactions || [];
      const updatedList = [...validTxs, ...currentList];

      saveToServer(data.characters, data.globalMemo, updatedList);
      showToast(`成功导入 ${validTxs.length} 条账目流水记录！`, 'success');
      setImportText('');
    } catch (err) {
      console.error('导入数据解析错误:', err);
      showToast('导入数据格式解析失败，请检查是否为逗号分隔的文本（如：日期, 类型, 金额...）。', 'error');
    }
  };

  // 导出历史收支数据 (设计一：逗号分隔单行/多行文本)
  const handleExportTransactions = () => {
    const txList = [...(data?.transactions || [])].sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date);
      if (dateDiff !== 0) return dateDiff;
      return b.id.localeCompare(a.id);
    });
    if (txList.length === 0) {
      showToast('当前没有收支流水记录可供导出', 'warning');
      return;
    }

    const cleanLines = txList.map(tx => {
      const dateStr = tx.date || '-';
      const typeStr = tx.type === 'income' ? '收入' : '支出';
      const amountStr = tx.amount;
      const remarkStr = tx.remark || '';

      if (tx.isGold) {
        const goldAmt = tx.goldAmount || '';
        const ratio = tx.ratio || '';
        if (tx.type === 'income') {
          const fee = tx.fee !== undefined ? tx.fee : 0;
          return `${dateStr}, ${typeStr}, ${amountStr}, ${remarkStr}, 是, ${goldAmt}, ${ratio}, ${fee}`;
        } else {
          return `${dateStr}, ${typeStr}, ${amountStr}, ${remarkStr}, 是, ${goldAmt}, ${ratio}`;
        }
      } else {
        return `${dateStr}, ${typeStr}, ${amountStr}, ${remarkStr}`;
      }
    });

    const fileContent = cleanLines.join('\n');
    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(fileContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `altea_ledger_transactions_${nickname || 'data'}.txt`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('收支记录已导出为文本备份，并已启动下载！', 'success');
  };

  // 辅助：执行保存（包含即时保存）
  const saveToServer = async (updatedCharacters, updatedMemo, updatedTransactions) => {
    try {
      const res = await authFetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characters: updatedCharacters !== undefined ? updatedCharacters : data?.characters,
          globalMemo: updatedMemo !== undefined ? updatedMemo : data?.globalMemo,
          transactions: updatedTransactions !== undefined ? updatedTransactions : data?.transactions
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
  const triggerDebouncedSave = (updatedCharacters, updatedMemo, updatedTransactions) => {
    setMemoStatus('正在保存...');
    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }
    saveDebounceRef.current = setTimeout(() => {
      saveToServer(updatedCharacters, updatedMemo, updatedTransactions).then(() => {
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

  // 7.5 角色代办添加（回车触发）
  const handleAddTodo = (role, e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = (todoInputs[role] || '').trim();
      if (val) {
        const charData = data.characters[role];
        const currentTodos = Array.isArray(charData.todos) ? [...charData.todos] : [];
        if (!currentTodos.includes(val)) {
          const updatedTodos = [...currentTodos, val];
          const updatedCharacters = {
            ...data.characters,
            [role]: {
              ...charData,
              todos: updatedTodos
            }
          };
          setData({ ...data, characters: updatedCharacters });
          setTodoInputs({ ...todoInputs, [role]: '' });
          saveToServer(updatedCharacters, data.globalMemo);
        } else {
          showToast('该代办已存在', 'warning');
        }
      }
    }
  };

  // 7.6 角色代办删除
  const handleRemoveTodo = (role, tagToRemove) => {
    const charData = data.characters[role];
    const currentTodos = Array.isArray(charData.todos) ? charData.todos : [];
    const updatedTodos = currentTodos.filter(t => t !== tagToRemove);
    const updatedCharacters = {
      ...data.characters,
      [role]: {
        ...charData,
        todos: updatedTodos
      }
    };
    setData({ ...data, characters: updatedCharacters });
    saveToServer(updatedCharacters, data.globalMemo);
  };

  // 8. 通用时间类型资产到期时间配置弹窗
  const openDatetimeModal = (role, asset) => {
    setActiveDatetimeModal({ role, key: asset.key, name: asset.name });
    const currentVal = data.characters[role].assets[asset.key] || '';
    if (currentVal) {
      const d = new Date(currentVal);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
      setDatetimeInput(localISOTime);
    } else {
      setDatetimeInput('');
    }
  };

  const handleSaveDatetime = () => {
    if (!activeDatetimeModal) return;
    const { role, key } = activeDatetimeModal;
    const updated = { ...data.characters };
    updated[role].assets[key] = datetimeInput ? new Date(datetimeInput).toISOString() : '';
    setData({ ...data, characters: updated });
    saveToServer(updated, data.globalMemo);
    setActiveDatetimeModal(null);
  };

  const handleQuickAddDatetimeDays = (days) => {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + days);
    const tzOffset = baseDate.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(baseDate.getTime() - tzOffset)).toISOString().slice(0, 16);
    setDatetimeInput(localISOTime);
  };

  const handleClearDatetime = () => {
    if (!activeDatetimeModal) return;
    const { role, key } = activeDatetimeModal;
    const updated = { ...data.characters };
    updated[role].assets[key] = '';
    setData({ ...data, characters: updated });
    saveToServer(updated, data.globalMemo);
    setActiveDatetimeModal(null);
  };

  // 8.5 资产阶段切换（0 -> 1 -> ... -> maxStage -> 0）
  const handleAssetStageChange = (role, key, maxStage) => {
    const updated = { ...data.characters };
    let current = updated[role].assets[key] || 0;
    current = (current + 1) % (maxStage + 1);
    updated[role].assets[key] = current;
    setData({ ...data, characters: updated });
    saveToServer(updated, data.globalMemo);
  };

  // 8.6 自定义资产管理操作
  const handleRenameAsset = (key, newName) => {
    const updatedAssets = drawerConfig.assets.map(a => {
      if (a.key === key) {
        return { ...a, name: newName };
      }
      return a;
    });
    setDrawerConfig({ ...drawerConfig, assets: updatedAssets });
  };

  const handleRemoveAsset = (key) => {
    if (['gold', 'fashion', 'goldenGoose'].includes(key)) return;
    const updatedAssets = drawerConfig.assets.filter(a => a.key !== key);
    setDrawerConfig({ ...drawerConfig, assets: updatedAssets });
  };

  const handleAddAsset = () => {
    if (!newAssetInput.name.trim() || !newAssetInput.key.trim()) {
      showToast('项目名称和英文Key不能为空', 'warning');
      return;
    }
    const key = newAssetInput.key.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      showToast('英文Key格式不正确（必须以小写字母开头，且仅包含小写字母、数字或下划线）', 'warning');
      return;
    }
    if (['gold', 'fashion', 'goldenGoose', 'todos', 'dailies', 'weeklies'].includes(key)) {
      showToast('该英文Key是保留关键字，不能使用', 'warning');
      return;
    }
    if (drawerConfig.assets.some(a => a.key === key)) {
      showToast('已存在相同英文Key的项目', 'warning');
      return;
    }

    const newAsset = {
      key,
      name: newAssetInput.name.trim(),
      type: newAssetInput.type,
      visible: true
    };

    if (newAssetInput.type === 'stage') {
      newAsset.maxStage = Math.max(1, Math.min(10, Number(newAssetInput.maxStage) || 3));
    }

    const updatedAssets = [...drawerConfig.assets, newAsset];
    setDrawerConfig({ ...drawerConfig, assets: updatedAssets });
    setNewAssetInput({
      name: '',
      key: '',
      type: 'number',
      maxStage: 3
    });
    showToast('自定义项目添加成功', 'success');
  };

  const handleAssetDragStart = (e, index) => {
    setDraggedAssetIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleAssetDragOver = (e, index) => {
    e.preventDefault();
    if (draggedAssetIndex === null || draggedAssetIndex === index) return;

    const updatedAssets = [...drawerConfig.assets];
    const draggedItem = updatedAssets[draggedAssetIndex];
    updatedAssets.splice(draggedAssetIndex, 1);
    updatedAssets.splice(index, 0, draggedItem);

    setDraggedAssetIndex(index);
    setDrawerConfig({
      ...drawerConfig,
      assets: updatedAssets
    });
  };

  const handleAssetDragEnd = () => {
    setDraggedAssetIndex(null);
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

  // 11. 配置抽屉的增删改查（角色管理升级支持拖拽排序与改名）
  const handleOpenConfigDrawer = () => {
    const cloned = JSON.parse(JSON.stringify(config));
    setDrawerConfig(cloned);
    setRolesWithId(cloned.roles.map(r => ({ id: r, name: r })));
    setIsConfigDrawerOpen(true);
  };

  const handleRemoveRole = (id) => {
    setRolesWithId(rolesWithId.filter(r => r.id !== id));
  };

  const handleAddRole = () => {
    if (!newRoleInput.trim()) return;
    const trimmed = newRoleInput.trim();
    if (rolesWithId.some(r => r.name === trimmed)) {
      showToast('该角色已存在', 'warning');
      return;
    }
    // eslint-disable-next-line react-hooks/purity
    const newId = `new_role_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    setRolesWithId([...rolesWithId, { id: newId, name: trimmed }]);
    setNewRoleInput('');
  };

  const handleRenameRole = (id, newName) => {
    setRolesWithId(rolesWithId.map(r => r.id === id ? { ...r, name: newName } : r));
  };

  const handleRoleDragStart = (e, index) => {
    setDraggedRoleIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleRoleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedRoleIndex === null || draggedRoleIndex === index) return;

    const updatedRoles = [...rolesWithId];
    const draggedItem = updatedRoles[draggedRoleIndex];
    updatedRoles.splice(draggedRoleIndex, 1);
    updatedRoles.splice(index, 0, draggedItem);

    setDraggedRoleIndex(index);
    setRolesWithId(updatedRoles);
  };

  const handleRoleDragEnd = () => {
    setDraggedRoleIndex(null);
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
    const names = rolesWithId.map(r => r.name.trim()).filter(Boolean);
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      showToast('角色名称不能重复且不能为空', 'warning');
      return;
    }

    // 生成改名映射 renameMap
    const renameMap = {};
    rolesWithId.forEach(r => {
      if (!r.id.startsWith('new_role_') && r.id !== r.name.trim()) {
        renameMap[r.id] = r.name.trim();
      }
    });

    const finalConfig = {
      ...drawerConfig,
      roles: names
    };

    try {
      const res = await authFetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: finalConfig,
          renameMap
        })
      });
      const result = await res.json();
      if (result.success) {
        if (finalConfig.adminPassword !== undefined) {
          localStorage.setItem('altea_ledger_password', finalConfig.adminPassword);
        }
        setConfig(result.config);
        setData(result.data);
        setIsConfigDrawerOpen(false);
        showToast('配置修改成功！角色数据已安全迁移。', 'success');
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

  // 渲染辅助函数：时间类型资产 Buff 状态文本
  const renderDatetimeAsset = (role, assetKey) => {
    const gooseVal = data.characters[role]?.assets?.[assetKey];
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

  // 渲染辅助：获取时间到期样式类
  const getDatetimeCellClass = (role, assetKey) => {
    const gooseVal = data.characters[role]?.assets?.[assetKey];
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
          <div className="brand-subtitle">角色周常与日常状态记录管理系统</div>
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
          <button className="btn-icon" title="设置" onClick={handleOpenConfigDrawer}>⚙️</button>
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
                  <th className="col-item-name">角色</th>
                  {config.roles.map(role => (
                    <th key={role} className="col-role-header">{role}</th>
                  ))}
                </tr>
              </thead>
              <tbody>

                {/* 角色资产及自定义项目渲染 */}
                {config.assets.filter(asset => asset.visible !== false).map(asset => {
                  if (asset.type === 'datetime') {
                    return (
                      <tr key={asset.key}>
                        <td className="col-item-name">{asset.name}</td>
                        {config.roles.map(role => (
                          <td key={role}>
                            <div
                              className={`goose-cell ${getDatetimeCellClass(role, asset.key)}`}
                              onClick={() => openDatetimeModal(role, asset)}
                            >
                              {renderDatetimeAsset(role, asset.key)}
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  }
                  if (asset.type === 'stage') {
                    const maxStage = asset.maxStage || 3;
                    return (
                      <tr key={asset.key}>
                        <td className="col-item-name">{asset.name}</td>
                        {config.roles.map(role => {
                          const stage = data.characters[role]?.assets?.[asset.key] || 0;
                          const isComplete = stage === maxStage;
                          return (
                            <td key={role}>
                              <div
                                className="stage-cell"
                                onClick={() => handleAssetStageChange(role, asset.key, maxStage)}
                              >
                                <div className="stage-dots">
                                  {Array.from({ length: maxStage }).map((_, idx) => {
                                    const dotIndex = idx + 1;
                                    return (
                                      <div
                                        key={dotIndex}
                                        className={`stage-dot ${stage >= dotIndex ? (isComplete ? 'all-filled' : 'filled') : ''}`}
                                      />
                                    );
                                  })}
                                </div>
                                <span className={`stage-label ${isComplete ? 'completed' : ''}`}>
                                  {stage}/{maxStage}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }
                  // 默认 number 类型
                  return (
                    <tr key={asset.key}>
                      <td className="col-item-name">{asset.name}</td>
                      {config.roles.map(role => {
                        const val = data.characters[role]?.assets?.[asset.key] || 0;
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

                {/* 角色代办 */}
                {config.showTodo !== false && (
                  <tr>
                    <td className="col-item-name">角色代办</td>
                    {config.roles.map(role => {
                      const todos = data.characters[role]?.todos || [];
                      const inputVal = todoInputs[role] || '';
                      return (
                        <td key={role}>
                          <div className="todo-cell">
                            {todos.length > 0 && (
                              <div className="todo-tags-list">
                                {todos.map((todo, idx) => (
                                  <div className="todo-tag" key={idx}>
                                    <span>{todo}</span>
                                    <button
                                      type="button"
                                      className="btn-remove-todo-tag"
                                      onClick={() => handleRemoveTodo(role, todo)}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <input
                              type="text"
                              className="todo-input"
                              placeholder="新代办..."
                              value={inputVal}
                              onChange={(e) => setTodoInputs({ ...todoInputs, [role]: e.target.value })}
                              onKeyDown={(e) => handleAddTodo(role, e)}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )}

                {/* 每日重置行分割 */}
                <tr className="row-divider">
                  <td className="col-item-name">
                    <span className="row-divider-label">每日重置</span>
                  </td>
                  {config.roles.map(role => (
                    <td key={role}></td>
                  ))}
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
                  <td className="col-item-name">
                    <span className="row-divider-label">每周重置</span>
                  </td>
                  {config.roles.map(role => (
                    <td key={role}></td>
                  ))}
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
          {/* 💰 游戏收支总览卡片 */}
          <div className="ledger-card glass-panel">
            <h2>💰 游戏收支</h2>
            <div className="ledger-quick-stats">
              <div className="ledger-stat-item">
                <span className="ledger-label">总净收益</span>
                <span className={`ledger-value ${totalNet >= 0 ? 'positive' : 'negative'}`}>
                  {totalNet >= 0 ? '+' : ''}{totalNet.toFixed(2)} 元
                </span>
              </div>
              <div className="ledger-detail-grid">
                <div className="grid-item">
                  <span className="grid-label">总收入</span>
                  <span className="grid-val pos">+{totalIncome.toFixed(2)}</span>
                </div>
                <div className="grid-item">
                  <span className="grid-label">总支出</span>
                  <span className="grid-val neg">-{totalExpense.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <button className="btn-primary ledger-btn" style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }} onClick={() => setIsLedgerDrawerOpen(true)}>
              📊 收支明细与统计
            </button>
          </div>

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

      {/* 通用时间类型资产设置弹窗 */}
      {activeDatetimeModal && (
        <div className="modal-backdrop">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h3>🦢 配置 【{activeDatetimeModal.role}】 的 {activeDatetimeModal.name}</h3>
              <button style={{ fontSize: '1.2rem' }} onClick={() => setActiveDatetimeModal(null)}>×</button>
            </div>

            <div className="input-label-group">
              <label>手动选择到期日期 和 时间：</label>
              <input
                type="datetime-local"
                value={datetimeInput}
                onChange={(e) => setDatetimeInput(e.target.value)}
              />
            </div>

            <div className="quick-days-btns">
              <button className="btn-quick-day" onClick={() => handleQuickAddDatetimeDays(7)}>+7 天</button>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setActiveDatetimeModal(null)}>取消</button>
              <button className="btn-danger" onClick={handleClearDatetime}>清除</button>
              <button className="btn-success btn-primary" onClick={handleSaveDatetime}>保存</button>
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
            <div className="drawer-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                      <th className="col-item-name">角色</th>
                      {Object.keys(selectedHistoryItem.snapshot.characters).map(role => (
                        <th key={role} className="col-role-header">{role}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>

                    {/* 角色资产及自定义项目（只读历史） */}
                    {config.assets.filter(asset => asset.visible !== false).map(asset => {
                      if (asset.type === 'datetime') {
                        return (
                          <tr key={asset.key}>
                            <td className="col-item-name">{asset.name}</td>
                            {Object.keys(selectedHistoryItem.snapshot.characters).map(role => {
                              const char = selectedHistoryItem.snapshot.characters[role];
                              const val = char?.assets?.[asset.key];
                              return (
                                <td key={role} style={{ fontSize: '0.75rem', opacity: val ? 1 : 0.4 }}>
                                  {val ? new Date(val).toLocaleDateString('zh-CN') : '未启用'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      }
                      if (asset.type === 'stage') {
                        const maxStage = asset.maxStage || 3;
                        return (
                          <tr key={asset.key}>
                            <td className="col-item-name">{asset.name}</td>
                            {Object.keys(selectedHistoryItem.snapshot.characters).map(role => {
                              const char = selectedHistoryItem.snapshot.characters[role];
                              const stage = char?.assets?.[asset.key] || 0;
                              const isComplete = stage === maxStage;
                              return (
                                <td key={role}>
                                  <div className="stage-cell" style={{ cursor: 'default' }}>
                                    <div className="stage-dots">
                                      {Array.from({ length: maxStage }).map((_, idx) => {
                                        const dotIndex = idx + 1;
                                        return (
                                          <div
                                            key={dotIndex}
                                            className={`stage-dot ${stage >= dotIndex ? (isComplete ? 'all-filled' : 'filled') : ''}`}
                                          />
                                        );
                                      })}
                                    </div>
                                    <span className={`stage-label ${isComplete ? 'completed' : ''}`}>
                                      {stage}/{maxStage}
                                    </span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      }
                      // 默认 number 类型
                      return (
                        <tr key={asset.key}>
                          <td className="col-item-name">{asset.name}</td>
                          {Object.keys(selectedHistoryItem.snapshot.characters).map(role => {
                            const char = selectedHistoryItem.snapshot.characters[role];
                            const val = char?.assets?.[asset.key] || 0;
                            return <td key={role} style={{ fontWeight: '600' }}>{val}</td>;
                          })}
                        </tr>
                      );
                    })}

                    {/* 角色代办（只读历史） */}
                    {config.showTodo !== false && (
                      <tr>
                        <td className="col-item-name">角色代办</td>
                        {Object.keys(selectedHistoryItem.snapshot.characters).map(role => {
                          const char = selectedHistoryItem.snapshot.characters[role];
                          const todos = char?.todos || [];
                          return (
                            <td key={role}>
                              {todos.length === 0 ? (
                                <span style={{ opacity: 0.3, fontSize: '0.7rem' }}>—</span>
                              ) : (
                                <div className="todo-cell" style={{ cursor: 'default', minHeight: 'auto' }}>
                                  <div className="todo-tags-list">
                                    {todos.map((todo, idx) => (
                                      <div className="todo-tag" key={idx} style={{ cursor: 'default' }}>
                                        <span>{todo}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    )}

                    {/* 周常重置分割 */}
                    <tr className="row-divider">
                      <td className="col-item-name">
                        <span className="row-divider-label">周常关卡状态（归档）</span>
                      </td>
                      {Object.keys(selectedHistoryItem.snapshot.characters).map(role => (
                        <td key={role}></td>
                      ))}
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

            <div className="drawer-body">
              {/* 角色管理 */}
              <div className="config-section">
                <h3>角色管理</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                  {rolesWithId.map((r, index) => {
                    const isDragging = index === draggedRoleIndex;
                    return (
                      <div
                        className={`config-list-item ${isDragging ? 'dragging' : ''}`}
                        key={r.id}
                        draggable
                        onDragStart={(e) => handleRoleDragStart(e, index)}
                        onDragOver={(e) => handleRoleDragOver(e, index)}
                        onDragEnd={handleRoleDragEnd}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                          <span className="drag-handle" title="拖动排序">⋮⋮</span>
                          <input
                            type="text"
                            className="role-edit-input"
                            value={r.name}
                            onChange={(e) => handleRenameRole(r.id, e.target.value)}
                            draggable={false}
                            onDragStart={(e) => e.preventDefault()}
                          />
                        </div>
                        <div className="config-list-item-actions" onDragStart={(e) => e.preventDefault()} draggable={false}>
                          <button className="btn-delete-item" onClick={() => handleRemoveRole(r.id)}>删除</button>
                        </div>
                      </div>
                    );
                  })}
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

              {/* 展示与自定义项目管理 */}
              <div className="config-section">
                <h3>展示与自定义项目</h3>

                {/* 默认开关部分 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '6px 0', borderBottom: '1px dashed rgba(255,255,255,0.06)', marginBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={drawerConfig.showTodo !== false}
                      onChange={(e) => setDrawerConfig({ ...drawerConfig, showTodo: e.target.checked })}
                    />
                    显示角色待办
                  </label>
                </div>

                {/* 资产/项目列表（支持可见控制、改名、拖拽排序） */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
                  {drawerConfig.assets.map((asset, index) => {
                    const isDragging = index === draggedAssetIndex;
                    const isDefault = ['gold', 'fashion', 'goldenGoose'].includes(asset.key);

                    let typeLabel = '数字';
                    if (asset.type === 'datetime') typeLabel = '时间';
                    if (asset.type === 'stage') typeLabel = `进度 (${asset.maxStage}阶)`;

                    return (
                      <div
                        className={`config-list-item ${isDragging ? 'dragging' : ''}`}
                        key={asset.key}
                        draggable
                        onDragStart={(e) => handleAssetDragStart(e, index)}
                        onDragOver={(e) => handleAssetDragOver(e, index)}
                        onDragEnd={handleAssetDragEnd}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          <span className="drag-handle" title="拖动排序">⋮⋮</span>
                          <input
                            type="checkbox"
                            checked={asset.visible !== false}
                            onChange={(e) => {
                              const updatedAssets = drawerConfig.assets.map(a =>
                                a.key === asset.key ? { ...a, visible: e.target.checked } : a
                              );
                              setDrawerConfig({ ...drawerConfig, assets: updatedAssets });
                            }}
                          />
                          <input
                            type="text"
                            className="role-edit-input"
                            style={{ flex: 1 }}
                            value={asset.name}
                            onChange={(e) => handleRenameAsset(asset.key, e.target.value)}
                            draggable={false}
                            onDragStart={(e) => e.preventDefault()}
                          />
                          <span style={{ fontSize: '0.75rem', opacity: 0.45, whiteSpace: 'nowrap' }}>
                            ({typeLabel})
                          </span>
                        </div>
                        <div className="config-list-item-actions" onDragStart={(e) => e.preventDefault()} draggable={false}>
                          {!isDefault && (
                            <button className="btn-delete-item" onClick={() => handleRemoveAsset(asset.key)}>删除</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 添加自定义项目表单 */}
                <div className="add-input-group" style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="text"
                      placeholder="项目名称 (如: 特殊积分)"
                      value={newAssetInput.name}
                      onChange={(e) => setNewAssetInput({ ...newAssetInput, name: e.target.value })}
                      style={{ width: '40%' }}
                    />
                    <input
                      type="text"
                      placeholder="英文Key (如: score)"
                      value={newAssetInput.key}
                      onChange={(e) => setNewAssetInput({ ...newAssetInput, key: e.target.value })}
                      style={{ width: '35%' }}
                    />
                    <select
                      value={newAssetInput.type}
                      onChange={(e) => setNewAssetInput({ ...newAssetInput, type: e.target.value })}
                      style={{
                        width: '25%',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '4px'
                      }}
                    >
                      <option value="number">数字</option>
                      <option value="datetime">时间</option>
                      <option value="stage">进度</option>
                    </select>
                  </div>

                  {newAssetInput.type === 'stage' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', opacity: 0.8 }}>
                      <span>阶段数 (1-10)：</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={newAssetInput.maxStage}
                        onChange={(e) => setNewAssetInput({ ...newAssetInput, maxStage: Number(e.target.value) || 3 })}
                        style={{ width: '60px', padding: '2px 4px' }}
                      />
                    </div>
                  )}

                  <button className="btn-primary" style={{ width: '100%', padding: '6px' }} onClick={handleAddAsset}>
                    添加项目
                  </button>
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
            </div>

            <div className="drawer-footer">
              <button className="btn-save-config btn-primary" onClick={handleSaveConfig}>
                保存并应用新配置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 游戏收支管理侧边抽屉 */}
      {isLedgerDrawerOpen && (
        <div className="drawer-backdrop" onClick={() => setIsLedgerDrawerOpen(false)}>
          <div className="drawer-content ledger-drawer" onClick={(e) => e.stopPropagation()} style={{ width: '480px', maxWidth: '95%' }}>
            <div className="drawer-header">
              <h2>💰 游戏收支管理</h2>
              <button style={{ fontSize: '1.5rem', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }} onClick={() => setIsLedgerDrawerOpen(false)}>×</button>
            </div>

            {/* 标签切换 */}
            <div className="ledger-tabs" style={{ display: 'flex', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <button
                className={`ledger-tab ${ledgerActiveTab === 'list' ? 'active' : ''}`}
                onClick={() => setLedgerActiveTab('list')}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  background: ledgerActiveTab === 'list' ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                  border: 'none',
                  color: ledgerActiveTab === 'list' ? '#c084fc' : '#a1a1aa',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  borderBottom: ledgerActiveTab === 'list' ? '2px solid #c084fc' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                📝 流水与记账
              </button>
              <button
                className={`ledger-tab ${ledgerActiveTab === 'stats' ? 'active' : ''}`}
                onClick={() => setLedgerActiveTab('stats')}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  background: ledgerActiveTab === 'stats' ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                  border: 'none',
                  color: ledgerActiveTab === 'stats' ? '#c084fc' : '#a1a1aa',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  borderBottom: ledgerActiveTab === 'stats' ? '2px solid #c084fc' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                📊 年月累计统计
              </button>
              <button
                className={`ledger-tab ${ledgerActiveTab === 'import' ? 'active' : ''}`}
                onClick={() => setLedgerActiveTab('import')}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  background: ledgerActiveTab === 'import' ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                  border: 'none',
                  color: ledgerActiveTab === 'import' ? '#c084fc' : '#a1a1aa',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  borderBottom: ledgerActiveTab === 'import' ? '2px solid #c084fc' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                📥 导入/导出
              </button>
            </div>

            <div className="drawer-body">
              {ledgerActiveTab === 'list' && (
                <>
                  {/* 新增记账表单 */}
                  <div className="ledger-form glass-panel" style={{ padding: '12px', marginBottom: '14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <h3 style={{ fontSize: '0.82rem', marginTop: 0, marginBottom: '8px', color: '#c084fc' }}>添加收支记录</h3>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setNewTxType('expense')}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.76rem',
                          background: newTxType === 'expense' ? '#ef4444' : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          fontWeight: '600'
                        }}
                      >
                        支出 (消费)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTxType('income')}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.76rem',
                          background: newTxType === 'income' ? '#10b981' : 'rgba(255,255,255,0.06)',
                          color: '#fff',
                          fontWeight: '600'
                        }}
                      >
                        收入
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <input
                        type="date"
                        value={newTxDate}
                        onChange={(e) => setNewTxDate(e.target.value)}
                        style={{ padding: '6px', fontSize: '0.76rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff' }}
                      />
                      <input
                        type="number"
                        placeholder="人民币金额 (元)"
                        value={newTxAmount}
                        onChange={(e) => setNewTxAmount(e.target.value)}
                        style={{ padding: '6px', fontSize: '0.76rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff' }}
                      />
                    </div>

                    {/* 金币交易切换项 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.76rem', cursor: 'pointer' }} onClick={() => setNewTxIsGold(!newTxIsGold)}>
                      <input
                        type="checkbox"
                        checked={newTxIsGold}
                        onChange={() => { }}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ color: '#fbbf24', opacity: 0.9 }}>
                        {newTxType === 'income' ? '💰 这是卖金（出金）交易' : '💰 这是买金交易'}
                      </span>
                    </div>

                    {newTxIsGold && (
                      <div style={{
                        background: 'rgba(251, 191, 36, 0.05)',
                        border: '1px solid rgba(251, 191, 36, 0.15)',
                        borderRadius: '6px',
                        padding: '8px',
                        marginBottom: '8px',
                        display: 'grid',
                        gridTemplateColumns: newTxType === 'income' ? '1fr 1.2fr 1fr' : '1fr 1.2fr',
                        gap: '6px'
                      }}>
                        <input
                          type="number"
                          placeholder="金币数量"
                          value={newTxGoldAmount}
                          onChange={(e) => setNewTxGoldAmount(e.target.value)}
                          style={{ padding: '4px 6px', fontSize: '0.72rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '4px', color: '#fff' }}
                        />
                        <input
                          type="text"
                          placeholder="例：23.6（每￥1对应的金币）"
                          value={newTxRatio}
                          onChange={(e) => setNewTxRatio(e.target.value)}
                          style={{ padding: '4px 6px', fontSize: '0.72rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '4px', color: '#fff' }}
                        />
                        {newTxType === 'income' && (
                          <input
                            type="number"
                            placeholder="手续费(金币)"
                            value={newTxFee}
                            onChange={(e) => setNewTxFee(e.target.value)}
                            style={{ padding: '4px 6px', fontSize: '0.72rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '4px', color: '#fff' }}
                          />
                        )}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="备注说明 (选填，留空智能填充)"
                        value={newTxRemark}
                        onChange={(e) => setNewTxRemark(e.target.value)}
                        style={{ flex: 1, padding: '6px', fontSize: '0.76rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '4px', color: '#fff' }}
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleAddTransaction}
                        style={{ padding: '6px 12px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)' }}
                      >
                        ➕ 记一笔
                      </button>
                    </div>
                  </div>

                  {/* 历史流水明细 */}
                  <div className="ledger-history" style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                    <h3 style={{ fontSize: '0.82rem', margin: '0 0 4px 0', color: '#a1a1aa' }}>历史收支流水</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                      {(!data?.transactions || data.transactions.length === 0) ? (
                        <div style={{ padding: '20px 0', textDict: 'center', opacity: 0.4, fontSize: '0.76rem', textAlign: 'center' }}>
                          暂无收支明细记录
                        </div>
                      ) : (
                        [...data.transactions]
                          .sort((a, b) => {
                            const dateDiff = b.date.localeCompare(a.date);
                            if (dateDiff !== 0) return dateDiff;
                            return b.id.localeCompare(a.id);
                          })
                          .map((tx) => (
                            <div
                              key={tx.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 10px',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.04)',
                                borderRadius: '6px'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '0.76rem', fontWeight: '700', color: '#fff' }}>{tx.remark}</span>
                                  {tx.isGold && (
                                    <span style={{
                                      background: 'rgba(251, 191, 36, 0.12)',
                                      color: '#fbbf24',
                                      border: '1px solid rgba(251, 191, 36, 0.25)',
                                      borderRadius: '4px',
                                      padding: '1px 4px',
                                      fontSize: '0.62rem'
                                    }}>
                                      🪙 {tx.goldAmount}金 | {tx.ratio}
                                      {tx.fee > 0 && ` | 手续费 ${tx.fee}金`}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: '0.65rem', opacity: 0.4 }}>{tx.date}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{
                                  fontSize: '0.82rem',
                                  fontWeight: '700',
                                  color: tx.type === 'income' ? '#34d399' : '#fca5a5'
                                }}>
                                  {tx.type === 'income' ? '+' : '-'}{Number(tx.amount).toFixed(2)} 元
                                </span>
                                <button
                                  type="button"
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem', opacity: 0.6 }}
                                  onMouseEnter={(e) => e.target.style.opacity = 1}
                                  onMouseLeave={(e) => e.target.style.opacity = 0.6}
                                  onClick={() => handleDeleteTransaction(tx.id)}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {ledgerActiveTab === 'stats' && (
                <div className="ledger-stats-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
                  {(!data?.transactions || data.transactions.length === 0) ? (
                    <div style={{ padding: '20px 0', opacity: 0.4, fontSize: '0.76rem', textAlign: 'center' }}>
                      暂无统计数据，请先在流水中记账或批量导入。
                    </div>
                  ) : (
                    Object.entries(calculateYearStats())
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .map(([year, yearData]) => {
                        const isExpanded = !!expandedYears[year];
                        return (
                          <div className="year-stats-card glass-panel" key={year} style={{
                            background: 'rgba(255, 255, 255, 0.01)',
                            border: '1px solid rgba(255, 255, 255, 0.03)',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            marginBottom: '4px'
                          }}>
                            <div className="year-header" onClick={() => toggleYearExpand(year)} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 12px',
                              background: 'rgba(255, 255, 255, 0.02)',
                              cursor: 'pointer',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
                            }}>
                              <div className="year-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', fontWeight: '700', color: '#c084fc' }}>
                                <span className="arrow" style={{ fontSize: '0.75rem', display: 'inline-block', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
                                <span>{year} 年累计</span>
                              </div>
                              <div className="year-summary" style={{ fontSize: '0.85rem' }}>
                                净额: <span style={{ fontWeight: '700', color: yearData.net >= 0 ? '#34d399' : '#fca5a5' }}>{yearData.net >= 0 ? '+' : ''}{yearData.net.toFixed(2)} 元</span>
                              </div>
                            </div>

                            {/* 年份汇总条 */}
                            <div className="year-details-bar" style={{
                              display: 'flex',
                              justifyContent: 'space-around',
                              padding: '8px 12px',
                              fontSize: '0.75rem',
                              color: 'rgba(255, 255, 255, 0.6)',
                              background: 'rgba(0, 0, 0, 0.1)',
                              borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.03)' : 'none'
                            }}>
                              <span>收入: <b style={{ color: '#34d399' }}>+{yearData.income.toFixed(2)}</b></span>
                              <span>支出: <b style={{ color: '#fca5a5' }}>-{yearData.expense.toFixed(2)}</b></span>
                              <span>手续费: <b style={{ color: '#fbbf24' }}>{yearData.fee} 金</b></span>
                            </div>

                            {isExpanded && (
                              <div className="stats-months-list" style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(0, 0, 0, 0.15)' }}>
                                {Object.entries(yearData.months)
                                  .sort((a, b) => b[0].localeCompare(a[0]))
                                  .map(([month, mData]) => (
                                    <div className="stats-month-row" key={month} style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '6px',
                                      padding: '8px 12px',
                                      borderBottom: '1px solid rgba(255, 255, 255, 0.02)'
                                    }}>
                                      <div className="month-name" style={{ fontSize: '0.78rem', fontWeight: '600', color: '#c084fc', textAlign: 'left' }}>{month} 月</div>
                                      <div className="month-data-grid" style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr 1fr 1fr',
                                        gap: '6px',
                                        textAlign: 'center'
                                      }}>
                                        <div className="data-col" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <span className="lbl" style={{ fontSize: '0.65rem', opacity: 0.4 }}>收入</span>
                                          <span className="val pos" style={{ fontSize: '0.76rem', fontWeight: '600', color: '#34d399' }}>+{mData.income.toFixed(2)}</span>
                                        </div>
                                        <div className="data-col" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <span className="lbl" style={{ fontSize: '0.65rem', opacity: 0.4 }}>支出</span>
                                          <span className="val neg" style={{ fontSize: '0.76rem', fontWeight: '600', color: '#fca5a5' }}>-{mData.expense.toFixed(2)}</span>
                                        </div>
                                        <div className="data-col" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <span className="lbl" style={{ fontSize: '0.65rem', opacity: 0.4 }}>手续费</span>
                                          <span className="val" style={{ fontSize: '0.76rem', fontWeight: '600', color: '#fbbf24' }}>{mData.fee} 金</span>
                                        </div>
                                        <div className="data-col" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                          <span className="lbl" style={{ fontSize: '0.65rem', opacity: 0.4 }}>净收益</span>
                                          <span className={`val ${mData.net >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: '0.76rem', fontWeight: '700', color: mData.net >= 0 ? '#34d399' : '#fca5a5' }}>
                                            {mData.net >= 0 ? '+' : ''}{mData.net.toFixed(2)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
              )}

              {ledgerActiveTab === 'import' && (
                <div className="ledger-import-container" style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'left' }}>
                  <div className="config-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                    <h3 style={{ fontSize: '0.85rem', color: '#c084fc', marginBottom: '6px' }}>📥 批量导入收支流水</h3>
                    <p style={{ fontSize: '0.74rem', opacity: 0.6, lineHeight: '1.4', marginBottom: '8px' }}>
                      支持多行文本，一行为一笔流水，各字段间用中文或英文逗号分隔。
                    </p>

                    {/* 整合版：推荐格式及复制示例卡片 */}
                    <div style={{
                      background: 'rgba(192, 132, 252, 0.05)',
                      border: '1px solid rgba(192, 132, 252, 0.15)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: '0.72rem',
                      lineHeight: '1.45',
                      color: '#e9d5ff',
                      marginBottom: '12px'
                    }}>
                      <strong style={{ color: '#d8b4fe', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem' }}>
                        💡 数据导入格式指南
                      </strong>
                      <div style={{ margin: '6px 0', fontSize: '0.7rem', opacity: 0.85 }}>
                        依次为：<code>日期, 类型(收入/支出), 金额, 备注, 是否金币交易, 金币数量, 兑换比例, 手续费</code>
                      </div>

                      <div style={{ fontSize: '0.7rem', opacity: 0.75, paddingLeft: '8px', borderLeft: '2px solid rgba(192, 132, 252, 0.3)', margin: '8px 0' }}>
                        • <strong>日期</strong>：选填。支持 <code>YYYY-MM-DD</code>，留空或 <code>-</code> 自动使用今天。<br />
                        • <strong>类型与金额</strong>：必填。<code>收入</code> 或 <code>支出</code> (或 <code>消费</code>)；金额为大于 0 的数字。<br />
                        • <strong>备注</strong>：选填。留空时系统将根据类型智能自动补全。<br />
                        • <strong>金币交易</strong>：选填。如属买金/出金，第 5 列写 <code>是</code>，随后填写金币数、比例、手续费(仅出金)。
                      </div>

                      <div style={{ marginTop: '8px' }}>
                        <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>📋 复制示例并修改：</span>
                        <pre style={{
                          margin: '4px 0 0 0',
                          padding: '6px 8px',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '4px',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          fontSize: '0.72rem',
                          color: '#a7f3d0',
                          fontFamily: 'monospace',
                          overflowX: 'auto',
                          lineHeight: '1.4'
                        }}>
                          {`# 1. 卖金交易记录 (日期,类型,金额,备注,是否金币,金币数,比例,手续费)
2026-06-17, 收入, 2118.64, 卖金收益, 是, 50000, 23.6, 200

# 2. 买金交易记录
2026-06-16, 支出, 423.73, 买金一万, 是, 10000, 23.6

# 3. 普通消费 (省略日期以使用当天)
-, 支出, 30.00, 战神月卡`}
                        </pre>
                      </div>
                    </div>

                    <textarea
                      rows="5"
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="请在此处粘贴或输入满足格式的文本..."
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '8px',
                        fontSize: '0.76rem',
                        fontFamily: 'monospace',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => handleImportTransactions(importText)}
                      style={{ width: '100%', justifyContent: 'center', marginTop: '8px', padding: '8px', border: 'none', cursor: 'pointer' }}
                    >
                      🚀 确认导入数据
                    </button>
                  </div>

                  <div className="config-section" style={{ borderBottom: 'none', paddingTop: 0 }}>
                    <h3 style={{ fontSize: '0.85rem', color: '#fda4af', marginBottom: '6px' }}>📤 备份导出</h3>
                    <p style={{ fontSize: '0.74rem', opacity: 0.6, lineHeight: '1.4', marginBottom: '8px' }}>
                      将当前的全部收支流水记录导出并下载为文本文件（`.txt`，符合设计一格式），方便您保存或以后复制导入。
                    </p>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleExportTransactions}
                      style={{
                        width: '100%',
                        justifyContent: 'center',
                        padding: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
                        boxShadow: '0 1px 4px rgba(244, 63, 94, 0.2)'
                      }}
                      onMouseEnter={(e) => e.target.style.boxShadow = '0 3px 8px rgba(244, 63, 94, 0.3)'}
                      onMouseLeave={(e) => e.target.style.boxShadow = '0 1px 4px rgba(244, 63, 94, 0.2)'}
                    >
                      💾 一键导出收支文本备份
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="drawer-footer">
              <button className="btn-save-config btn-primary" style={{ background: 'rgba(255,255,255,0.06)', width: '100%', display: 'block', textAlign: 'center', border: 'none', cursor: 'pointer' }} onClick={() => setIsLedgerDrawerOpen(false)}>
                关闭收支面板
              </button>
            </div>
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
