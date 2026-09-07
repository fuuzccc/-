const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(app.getPath('userData'), 'data');
const FILES = {
  tasks: path.join(DATA_DIR, 'tasks.json'),
  goals: path.join(DATA_DIR, 'goals.json'),
  notes: path.join(DATA_DIR, 'notes.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
};

let mainWindow = null;
let tray = null;
let isQuitting = false;
let reminderTimer = null;
let notifiedKeys = new Set();

// ---------- 数据读写 ----------
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function defaultData(name) {
  if (name === 'tasks') return [];
  if (name === 'goals') return [];
  if (name === 'notes') return [];
  return { autostart: true, notifications: true, remindMinutes: 10, lastVersion: app.getVersion() };
}
function readData(name) {
  ensureDataDir();
  try {
    const p = FILES[name];
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) {
    console.error('readData error', name, e);
  }
  const d = defaultData(name);
  return d;
}
function writeData(name, data) {
  ensureDataDir();
  try {
    fs.writeFileSync(FILES[name], JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('writeData error', name, e);
    return false;
  }
}

// ---------- IPC ----------
function registerIpc() {
  ipcMain.handle('data:read', (e, name) => readData(name));
  ipcMain.handle('data:write', (e, name, data) => writeData(name, data));
  ipcMain.handle('settings:autostart', (e, on) => {
    try {
      app.setLoginItemSettings({ openAtLogin: !!on });
      const cur = readData('settings');
      cur.autostart = !!on;
      writeData('settings', cur);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  });
  ipcMain.handle('settings:getAutostart', () => {
    try { return app.getLoginItemSettings().openAtLogin; } catch (e) { return false; }
  });
  ipcMain.handle('app:version', () => {
    try { return app.getVersion(); } catch (e) { return '1.0.1'; }
  });
  ipcMain.handle('app:export', async (e) => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: readData('tasks'),
      goals: readData('goals'),
      notes: readData('notes'),
    };
    const stamp = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fname = `未来备忘录备份_${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.json`;
    const r = await dialog.showSaveDialog(mainWindow, {
      title: '导出数据备份',
      defaultPath: path.join(app.getPath('desktop'), fname),
      filters: [{ name: 'JSON 备份', extensions: ['json'] }],
    });
    if (r.canceled || !r.filePath) return { ok: false, canceled: true };
    try {
      fs.writeFileSync(r.filePath, JSON.stringify(data, null, 2), 'utf8');
      return { ok: true, path: r.filePath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
  ipcMain.handle('app:import', async (e, mode) => {
    const r = await dialog.showOpenDialog(mainWindow, {
      title: '选择备份文件',
      filters: [{ name: 'JSON 备份', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths || !r.filePaths.length) return { ok: false, canceled: true };
    try {
      const raw = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8'));
      const tasks = mergeUnique(readData('tasks'), raw.tasks || []);
      const goals = mergeUnique(readData('goals'), raw.goals || []);
      const notes = mergeUnique(readData('notes'), raw.notes || []);
      if (mode === 'overwrite') {
        writeData('tasks', raw.tasks || []);
        writeData('goals', raw.goals || []);
        writeData('notes', raw.notes || []);
      } else {
        writeData('tasks', tasks);
        writeData('goals', goals);
        writeData('notes', notes);
      }
      return { ok: true, source: r.filePaths[0], countTasks: tasks.length, countGoals: goals.length, countNotes: notes.length };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

function mergeUnique(existing, incoming) {
  const map = new Map();
  existing.forEach((item) => item && map.set(item.id, item));
  (incoming || []).forEach((item) => {
    if (item && item.id) map.set(item.id, item);
  });
  return Array.from(map.values());
}

// ---------- 提醒调度 ----------
function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function localTimeOf(task) {
  if (!task || !task.date) return null;
  // task.time 形如 "HH:MM"；注意：当用户只填日期不报提醒时间时用 23:59
  const hm = (task.time || '').split(':');
  const hour = hm.length >= 2 ? parseInt(hm[0], 10) : 23;
  const minute = hm.length >= 2 ? parseInt(hm[1], 10) : 59;
  return new Date(`${task.date}T${pad(hour)}:${pad(minute)}:00`);
}
function checkReminders() {
  const settings = readData('settings');
  if (!settings.notifications) { notifiedKeys.clear(); return; }
  const tasks = readData('tasks');
  const now = Date.now();
  const offset = Math.max(0, parseInt(settings.remindMinutes, 10) || 0) * 60000;

  tasks.forEach((t) => {
    if (t.completed || !t.reminder) return;
    const at = localTimeOf(t);
    if (!at) return;
    const remindAt = at.getTime() - offset;
    const key = t.id + '@' + at.getTime() + '@' + offset;
    // 到提醒时刻（且未过正式时间太多），弹出一次
    if (now >= remindAt && now < at.getTime() + 5 * 60000 && !notifiedKeys.has(key)) {
      notifiedKeys.add(key);
      if (!Notification.isSupported()) return;
      const n = new Notification({
        title: t.reminderTitle || t.title || '未来备忘录提醒',
        body: (t.desc ? t.desc : (t.priorityText || '')) || `计划在 ${t.date}${t.time ? ' ' + t.time : ''}`,
        icon: path.join(__dirname, 'assets', 'icon.png'),
      });
      n.show();
    }
  });
  // 清理过于久远的 key
  if (notifiedKeys.size > 500) notifiedKeys.clear();
}

// ---------- 窗口 ----------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 940,
    minHeight: 620,
    title: '未来备忘录',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#f5f6fa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      showTrayBalloon();
    }
  });
}
function showTrayBalloon() {
  if (tray && Notification.isSupported()) {
    try {
      tray.displayBalloon && tray.displayBalloon({ title: '未来备忘录', content: '已最小化到系统托盘，仍会按时提醒' });
    } catch (e) { /* 忽略 */ }
  }
}

// ---------- 托盘 ----------
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#1677ff"/><rect x="7" y="9" width="18" height="3.2" rx="1.6" fill="#fff"/><rect x="7" y="14" width="14" height="3.2" rx="1.6" fill="#fff" opacity=".85"/><rect x="7" y="19" width="16" height="3.2" rx="1.6" fill="#fff" opacity=".7"/></svg>`;
    icon = nativeImage.createFromDataURL('data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'));
  }
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('未来备忘录');
  const menu = Menu.buildFromTemplate([
    { label: '打开未来备忘录', click: () => showWindow() },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => showWindow());
}
function showWindow() {
  if (!mainWindow) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// ---------- 应用菜单 ----------
// 顶部菜单栏整体移除：不再有任何关于入口，版本与开发者信息见「设置 → 关于」

// ---------- 生命周期 ----------
app.whenReady().then(() => {
  ensureDataDir();
  registerIpc();
  createWindow();
  Menu.setApplicationMenu(null);
  createTray();

  // 应用自启设置对齐
  const settings = readData('settings');
  if (settings.autostart !== undefined) {
    try { app.setLoginItemSettings({ openAtLogin: !!settings.autostart }); } catch (e) {}
  }

  reminderTimer = setInterval(checkReminders, 20000);
  checkReminders();

  app.on('activate', () => showWindow());
});

app.on('window-all-closed', (e) => {
  // 保持托盘驻留
});
