/* 专注力训练营 — Electron 主进程
   职责：加载 index.html，并把训练数据实时镜像到本地 JSON 文件，
   每天自动留一份轮换备份（保留最近 7 天）。这样清缓存、更新程序、重装都不丢数据。 */
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('专注力训练营');

function dataFile() { return path.join(app.getPath('userData'), 'data.json'); }
function backupDir() { return path.join(app.getPath('userData'), 'backups'); }
function ensureDir(d) { try { fs.mkdirSync(d, { recursive: true }); } catch (e) {} }

function loadData() {
  try { return fs.readFileSync(dataFile(), 'utf8'); }
  catch (e) { return null; }
}

function stamp() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function saveData(json) {
  const f = dataFile();
  ensureDir(path.dirname(f));
  try { fs.writeFileSync(f, json, 'utf8'); } catch (e) { console.error('数据保存失败', e); }
  rotateBackup(json);
}

function rotateBackup(json) {
  try {
    const dir = backupDir(); ensureDir(dir);
    const todayFile = path.join(dir, 'backup-' + stamp() + '.json');
    if (!fs.existsSync(todayFile)) fs.writeFileSync(todayFile, json, 'utf8');
    const files = fs.readdirSync(dir).filter(f => /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    while (files.length > 7) {
      try { fs.unlinkSync(path.join(dir, files.shift())); } catch (e) {}
    }
  } catch (e) { console.error('备份失败', e); }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100, height: 820, minWidth: 720, minHeight: 600,
    title: '专注力训练营',
    backgroundColor: '#f5f7fa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile('index.html');
}

app.whenReady().then(() => {
  ipcMain.on('fs-load', (e) => { e.returnValue = loadData(); });
  ipcMain.on('fs-save', (e, json) => { saveData(String(json || '')); e.returnValue = true; });
  ipcMain.on('fs-open-folder', () => { shell.openPath(app.getPath('userData')); });
  createWindow();
});

app.on('window-all-closed', () => { app.quit(); });
/* macOS 从 Finder 双击启动时，activate 可能早于 ready —— 必须等 app ready 后再建窗口 */
app.on('activate', () => {
  if (!app.isReady()) return;
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
