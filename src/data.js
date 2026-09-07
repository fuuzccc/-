// 全局数据层：缓存 + 增删改查 + 筛选 + 重复规则 + 进度联动
const Store = (() => {
  const api = window.futureMemo;
  let tasks = [];
  let goals = [];
  let notes = [];
  let settings = {
    autostart: true,
    notifications: true,
    remindMinutes: 10,
    theme: null, // 自定义色板，null 表示使用默认浅色
  };

  function pad(n) { return String(n).padStart(2, '0'); }
  function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function nowTimeStr() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function uid() { return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
  function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  async function load() {
    tasks = (await api.readData('tasks')) || [];
    goals = (await api.readData('goals')) || [];
    notes = (await api.readData('notes')) || [];
    settings = Object.assign(settings, (await api.readData('settings')) || {});
    // 兜底初始化 id
    tasks.forEach((t) => { if (!t.id) t.id = uid(); });
    goals.forEach((g) => { if (!g.id) g.id = uid(); });
    notes.forEach((n) => { if (!n.id) n.id = uid(); });
    // 旧数据结构迁移为「三层分组 + 家长指针」的层级
    const d = migrateGoals();
    if (d) persistGoals();
  }
  async function persistTasks() { await api.writeData('tasks', tasks); }
  async function persistGoals() { await api.writeData('goals', goals); }
  async function persistNotes() { await api.writeData('notes', notes); }
  async function persistSettings() { await api.writeData('settings', settings); }

  // ---------- 任务 ----------
  function addTask(t) {
    const task = Object.assign({
      id: uid(),
      title: '',
      desc: '',
      date: todayStr(),
      time: '',
      priority: 'lo', // hi|mid|lo
      tags: '',
      category: '',
      repeat: 'none', // none|daily|weekly|monthly
      reminder: true,
      completed: false,
      createdAt: new Date().toISOString(),
    }, t);
    tasks.push(task);
    persistTasks();
    return task;
  }
  function updateTask(id, patch) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return null;
    Object.assign(t, patch);
    persistTasks();
    return t;
  }
  function deleteTask(id) { tasks = tasks.filter((x) => x.id !== id); persistTasks(); }
  function toggleTask(id) {
    const t = tasks.find((x) => x.id === id);
    if (!t) return null;
    if (!t.completed) t.completed = true;
    // 重复任务：完成后生成下一次
    if (t.repeat && t.repeat !== 'none' && t.date) {
      let next = t.date;
      if (t.repeat === 'daily') next = addDays(t.date, 1);
      else if (t.repeat === 'weekly') next = addDays(t.date, 7);
      else {
        const d = new Date(t.date + 'T00:00:00');
        d.setMonth(d.getMonth() + 1);
        next = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
      tasks.push(Object.assign({}, t, { id: uid(), completed: false, date: next }));
    } else {
      t.completed = true;
    }
    persistTasks();
    return t;
  }
  function uncompleteTask(id) { const t = tasks.find((x) => x.id === id); if (t) { t.completed = false; persistTasks(); } }

  function getTasks() { return tasks; }

  function parseTags(str) {
    if (!str) return [];
    return String(str).split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean);
  }
  function allTags() { const s = new Set(); tasks.forEach((t) => parseTags(t.tags).forEach((tag) => s.add(tag))); return Array.from(s); }
  function allCategories() { const s = new Set(); tasks.forEach((t) => { if (t.category) s.add(t.category); }); return Array.from(s); }

  // 截止日状态
  function dateStatus(t) {
    const today = todayStr();
    if (t.completed) return 'done';
    if (!t.date) return 'none';
    if (t.date < today) return 'overdue';
    if (t.date === today) return 'today';
    return 'future';
  }

  // ---------- 目标 ----------
  // 目标三层分组：long 远期 / mid 中期 / short 短期
  const GROUPS = [
    { key: 'long',  label: '远期目标', icon: '🗂', hint: '一年以上' },
    { key: 'mid',   label: '中期目标', icon: '📆', hint: '一月到一年' },
    { key: 'short', label: '短期目标', icon: '🎯', hint: '一个月内' },
  ];
  function groupLabel(key) {
    const g = GROUPS.find((x) => x.key === key);
    return g ? g.label : '短期目标';
  }
  // 依据截止日期推断分组：≤30 天短期、≤365 天中期、其余远期；无截止日归短期
  function inferGroup(dl) {
    const r = goalRemainDays({ deadline: dl || '' });
    if (r === null) return 'short';
    if (r <= 30) return 'short';
    if (r <= 365) return 'mid';
    return 'long';
  }
  // 迁移旧目标数据；返回是否有改动
  function migrateGoals() {
    let changed = false;
    goals.forEach((g) => {
      if (!g.group) { g.group = inferGroup(g.deadline || g.date); changed = true; }
      if (g.parentId === undefined) { g.parentId = null; changed = true; }
      // 旧子任务迁移为流程图事务（方案 B：方块即任务）；迁移幂等
      if (Array.isArray(g.flow) && g.flow.length) return;
      if (Array.isArray(g.subtasks) && g.subtasks.length) {
        g.flow = g.subtasks.map((s) => ({
          id: s.id || uid(), title: s.title || '', duration: null, done: !!s.done, next: null,
        }));
        g.subtasks = [];
        changed = true;
      } else if (!Array.isArray(g.flow)) {
        g.flow = [];
        changed = true;
      }
    });
    return changed;
  }
  function addGoal(g) {
    const goal = Object.assign({
      id: uid(), title: '', desc: '', deadline: '', date: '', tags: '',
      progress: 0, flow: [], subtasks: [], parentId: null, group: '',
      createdAt: new Date().toISOString(),
    }, g);
    if (!goal.group) goal.group = inferGroup(goal.deadline || goal.date || todayStr());
    goals.push(goal);
    persistGoals();
    return goal;
  }
  function updateGoal(id, patch) {
    const g = goals.find((x) => x.id === id);
    if (!g) return null;
    Object.assign(g, patch);
    // 若直接改了截止日期而分组未显式指定，则按新日期重新归类
    if (patch && patch.deadline !== undefined && patch.group === undefined) {
      g.group = inferGroup(g.deadline || '');
    }
    recomputeProgress(g);
    persistGoals();
    return g;
  }
  function deleteGoal(id) { goals = goals.filter((x) => x.id !== id); persistGoals(); }
  function addSubtask(id, text) {
    const g = goals.find((x) => x.id === id);
    if (!g) return null;
    if (!g.subtasks) g.subtasks = [];
    g.subtasks.push({ id: uid(), title: text, done: false });
    recomputeProgress(g);
    persistGoals();
    return g;
  }
  function toggleSubtask(gid, sid) {
    const g = goals.find((x) => x.id === gid);
    if (!g) return null;
    const st = (g.subtasks || []).find((s) => s.id === sid);
    if (st) st.done = !st.done;
    recomputeProgress(g);
    persistGoals();
    return g;
  }
  function removeSubtask(gid, sid) {
    const g = goals.find((x) => x.id === gid);
    if (!g) return null;
    g.subtasks = (g.subtasks || []).filter((s) => s.id !== sid);
    recomputeProgress(g);
    persistGoals();
    return g;
  }
  function normalizeDur(d) { const n = Number(d); return (isFinite(n) && n >= 0) ? n : 0; }
  // 流程进度：已完成预计时间 ÷ 总预计时间；全空退化为按个数
  function getFlowProgress(g) {
    const f = g.flow || [];
    if (!f.length) return { progress: 0, doneMin: 0, totalMin: 0, total: 0, done: 0 };
    let doneMin = 0, totalMin = 0;
    f.forEach((n) => {
      const d = normalizeDur(n.duration);
      totalMin += d;
      if (n.done) doneMin += d;
    });
    let progress;
    if (totalMin > 0) {
      progress = Math.round((doneMin / totalMin) * 100);
    } else {
      const dc = f.filter((n) => n.done).length;
      progress = Math.round((dc / f.length) * 100);
    }
    return { progress, doneMin, totalMin, total: f.length, done: f.filter((n) => n.done).length };
  }
  function recomputeProgress(g) { g.progress = getFlowProgress(g).progress; }

  // ---------- 流程图事务 ----------
  function addFlow(gid, node) {
    const g = goals.find((x) => x.id === gid); if (!g) return null;
    if (!g.flow) g.flow = [];
    g.flow.push(Object.assign({ id: uid(), title: '', duration: null, done: false, next: null, zone: 0 }, node));
    recomputeProgress(g); persistGoals(); return g;
  }
  function updateFlow(gid, id, patch) {
    const g = goals.find((x) => x.id === gid); if (!g) return null;
    const n = (g.flow || []).find((x) => x.id === id); if (!n) return null;
    Object.assign(n, patch);
    if (n.next === id) n.next = null;
    recomputeProgress(g); persistGoals(); return g;
  }
  function deleteFlow(gid, id) {
    const g = goals.find((x) => x.id === gid); if (!g) return null;
    g.flow = (g.flow || []).filter((x) => x.id !== id);
    g.flow.forEach((x) => { if (x.next === id) x.next = null; });
    recomputeProgress(g); persistGoals(); return g;
  }
  function moveFlow(gid, id, dir) {
    const g = goals.find((x) => x.id === gid); if (!g) return null;
    const f = g.flow || []; const i = f.findIndex((x) => x.id === id); if (i < 0) return null;
    const j = i + dir; if (j < 0 || j >= f.length) return null;
    [f[i], f[j]] = [f[j], f[i]];
    recomputeProgress(g); persistGoals(); return g;
  }
  function linkFlow(gid, id, targetId) {
    const g = goals.find((x) => x.id === gid); if (!g) return null;
    const n = (g.flow || []).find((x) => x.id === id); if (!n) return null;
    if (targetId === id || n.next === targetId) n.next = null; else n.next = targetId;
    recomputeProgress(g); persistGoals(); return g;
  }

  // ---------- 备忘录 ----------
  function addNote(n) {
    const note = Object.assign({
      id: uid(), title: '', tags: '', body: '', date: todayStr(),
      createdAt: new Date().toISOString(),
    }, n);
    if (!note.date) note.date = todayStr();
    notes.push(note);
    persistNotes();
    return note;
  }
  function updateNote(id, patch) {
    const n = notes.find((x) => x.id === id);
    if (!n) return null;
    Object.assign(n, patch);
    persistNotes();
    return n;
  }
  function deleteNote(id) { notes = notes.filter((x) => x.id !== id); persistNotes(); }
  function getNotes() { return notes; }
  // 全部 tag 及其各自备忘录数量：返回 [{ tag, count }]，按数量降序
  function allNoteTags() {
    const map = {};
    notes.forEach((n) => Store.parseTags(n.tags).forEach((t) => { map[t] = (map[t] || 0) + 1; }));
    return Object.entries(map).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  function getGoals() { return goals; }
  function goalRemainDays(g) {
    const dl = g.deadline || g.date;
    if (!dl) return null;
    const a = new Date(todayStr() + 'T00:00:00');
    const b = new Date(dl + 'T00:00:00');
    return Math.ceil((b - a) / 86400000);
  }

  // ---------- 设置 ----------
  async function setSetting(patch) { Object.assign(settings, patch); await persistSettings(); }
  function getSettings() { return settings; }

  return {
    load, api, uid, pad, todayStr, nowTimeStr, addDays,
    addTask, updateTask, deleteTask, toggleTask, uncompleteTask, getTasks,
    parseTags, allTags, allCategories, dateStatus,
    addGoal, updateGoal, deleteGoal, addSubtask, toggleSubtask, removeSubtask, getGoals, goalRemainDays,
    addFlow, updateFlow, deleteFlow, moveFlow, linkFlow, getFlowProgress,
    addNote, updateNote, deleteNote, getNotes, allNoteTags,
    GROUPS, groupLabel, inferGroup,
    setSetting, getSettings,
  };
})();
