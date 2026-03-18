const {
  app, BrowserWindow, BrowserView, Menu, Tray,
  ipcMain, shell, session, nativeImage, globalShortcut, screen
} = require('electron');
const path = require('path');
const fs   = require('fs');

// ─────────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────────
const YT_MUSIC_URL  = 'https://music.youtube.com';
const APP_NAME      = 'YT Music';
const TITLEBAR_H    = 44;
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

// ─────────────────────────────────────────────────────────────────
//  Register "ytmusic://" deep-link protocol
//  → allows shortcuts / OS search to open the app
// ─────────────────────────────────────────────────────────────────
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('ytmusic', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('ytmusic');
}

// ─────────────────────────────────────────────────────────────────
//  Settings
// ─────────────────────────────────────────────────────────────────
function loadSettings () {
  try {
    if (fs.existsSync(SETTINGS_FILE))
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch (_) {}
  return {
    windowBounds  : null,      // null = maximized on first run
    maximized     : true,      // start maximized by default
    closeToTray   : true,
    startMinimized: false,
    hardwareAccel : true,
  };
}
function saveSettings () {
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2)); }
  catch (_) {}
}

let settings   = loadSettings();
let mainWindow = null;
let musicView  = null;
let tray       = null;
let isQuitting = false;

if (!settings.hardwareAccel) app.disableHardwareAcceleration();

// ─────────────────────────────────────────────────────────────────
//  Single-instance + deep-link handling
// ─────────────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Windows/Linux: second instance passes argv
  app.on('second-instance', (_, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show(); mainWindow.focus();
    }
    // Handle ytmusic:// deep link from second instance
    const url = argv.find(a => a.startsWith('ytmusic://'));
    if (url) handleDeepLink(url);
  });
}

// macOS: deep link via open-url event
app.on('open-url', (e, url) => {
  e.preventDefault();
  handleDeepLink(url);
});

function handleDeepLink (url) {
  // ytmusic:// → just show the app
  if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
}

// ─────────────────────────────────────────────────────────────────
//  Named session  (persist = stay logged in across restarts)
// ─────────────────────────────────────────────────────────────────
function getMusicSession () {
  return session.fromPartition('persist:ytmusic', { cache: true });
}

function spoofUA (ses) {
  ses.webRequest.onBeforeSendHeaders((details, cb) => {
    details.requestHeaders['User-Agent'] = CHROME_UA;
    cb({ requestHeaders: details.requestHeaders });
  });
}

// ─────────────────────────────────────────────────────────────────
//  App Icon helper  (used for taskbar / dock)
// ─────────────────────────────────────────────────────────────────
function getAppIcon () {
  // Priority: platform-specific asset, then generic png
  const candidates = process.platform === 'win32'
    ? [path.join(__dirname, 'assets', 'icon.ico'), path.join(__dirname, 'assets', 'icon.png')]
    : process.platform === 'darwin'
    ? [path.join(__dirname, 'assets', 'icon.icns'), path.join(__dirname, 'assets', 'icon.png')]
    : [path.join(__dirname, 'assets', 'icon.png')];

  for (const p of candidates) {
    if (fs.existsSync(p)) return nativeImage.createFromPath(p);
  }
  // Fallback: generate a red square icon programmatically so taskbar is never empty
  return buildFallbackIcon();
}

function buildFallbackIcon () {
  // 64×64 red icon with white note symbol, encoded as 1-bit PNG substitute via raw RGBA buffer
  // We'll create a simple 64x64 image using Electron's nativeImage
  const size = 64;
  const buf  = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const x = i % size, y = Math.floor(i / size);
    // Red background
    buf[i * 4 + 0] = 220; // R
    buf[i * 4 + 1] = 0;   // G
    buf[i * 4 + 2] = 30;  // B
    buf[i * 4 + 3] = 255; // A
    // White circle in center
    const dx = x - 32, dy = y - 32;
    if (Math.sqrt(dx*dx + dy*dy) < 18) {
      buf[i * 4 + 0] = 255;
      buf[i * 4 + 1] = 255;
      buf[i * 4 + 2] = 255;
    }
    // Red circle center
    if (Math.sqrt(dx*dx + dy*dy) < 7) {
      buf[i * 4 + 0] = 220;
      buf[i * 4 + 1] = 0;
      buf[i * 4 + 2] = 30;
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

// ─────────────────────────────────────────────────────────────────
//  BrowserView – the real YouTube Music Chromium tab
// ─────────────────────────────────────────────────────────────────
function createMusicView () {
  musicView = new BrowserView({
    webPreferences: {
      session          : getMusicSession(),
      nodeIntegration  : false,
      contextIsolation : true,
      sandbox          : true,
    },
  });

  mainWindow.addBrowserView(musicView);
  layoutMusicView();

  const wc = musicView.webContents;
  wc.setUserAgent(CHROME_UA);

  wc.setWindowOpenHandler(({ url }) => {
    const inApp = [
      'https://music.youtube.com',
      'https://www.youtube.com',
      'https://accounts.google.com',
      'https://myaccount.google.com',
      'https://support.google.com',
    ];
    if (inApp.some(t => url.startsWith(t))) { wc.loadURL(url); return { action: 'deny' }; }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  wc.on('page-title-updated', (_, title) => {
    const t = title && title !== 'YouTube Music' ? `${title} · YT Music` : 'YT Music';
    mainWindow.setTitle(t);
    mainWindow.webContents.send('title-changed', t);
  });

  wc.on('did-start-loading', () => mainWindow.webContents.send('loading', true));
  wc.on('did-stop-loading',  () => {
    mainWindow.webContents.send('loading', false);
    mainWindow.webContents.send('nav-state', { canBack: wc.canGoBack(), canForward: wc.canGoForward() });
    injectScrollbarCSS();
  });

  wc.on('did-fail-load', (_, errCode, errDesc) => {
    if (errCode === -3) return;
    mainWindow.webContents.send('load-error', { errCode, errDesc });
  });

  wc.loadURL(YT_MUSIC_URL);
}

function layoutMusicView () {
  if (!musicView || !mainWindow) return;
  const [w, h] = mainWindow.getContentSize();
  musicView.setBounds({ x: 0, y: TITLEBAR_H, width: w, height: h - TITLEBAR_H });
  musicView.setAutoResize({ width: true, height: true });
}

function injectScrollbarCSS () {
  if (!musicView) return;
  musicView.webContents.insertCSS(`
    ::-webkit-scrollbar            { width:6px; height:6px; }
    ::-webkit-scrollbar-track      { background:transparent; }
    ::-webkit-scrollbar-thumb      { background:rgba(255,255,255,.18); border-radius:3px; }
    ::-webkit-scrollbar-thumb:hover{ background:rgba(255,255,255,.35); }
  `).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────
//  Main Window
// ─────────────────────────────────────────────────────────────────
function createMainWindow () {
  // Get primary display size for default window sizing
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  // Use saved bounds if available, otherwise use screen size
  const savedBounds = settings.windowBounds;
  const winWidth    = savedBounds?.width  ?? screenW;
  const winHeight   = savedBounds?.height ?? screenH;
  const winX        = savedBounds?.x;
  const winY        = savedBounds?.y;

  const appIcon = getAppIcon();

  mainWindow = new BrowserWindow({
    width : winWidth,
    height: winHeight,
    x: winX,
    y: winY,
    minWidth : 820,
    minHeight: 560,
    title    : APP_NAME,
    icon     : appIcon,          // ← taskbar / dock icon
    backgroundColor: '#0f0f0f',
    show     : false,
    frame    : false,
    // macOS: show native traffic lights but hide the default title area
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : undefined,
    trafficLightPosition: { x: 14, y: 13 },   // macOS: position traffic lights in our bar
    webPreferences: {
      preload          : path.join(__dirname, 'preload.js'),
      nodeIntegration  : false,
      contextIsolation : true,
      sandbox          : false,
    },
  });

  // Set icon explicitly (belt-and-suspenders for Windows taskbar)
  if (!appIcon.isEmpty()) mainWindow.setIcon(appIcon);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (settings.startMinimized) return;
    mainWindow.show();
    // Maximize on first run OR if was maximized when last closed
    if (settings.maximized !== false) {
      mainWindow.maximize();
    }
    mainWindow.focus();
  });

  mainWindow.on('resize', () => {
    layoutMusicView();
    if (!mainWindow.isMaximized()) settings.windowBounds = mainWindow.getBounds();
    settings.maximized = mainWindow.isMaximized();
  });
  mainWindow.on('move', () => {
    if (!mainWindow.isMaximized()) settings.windowBounds = mainWindow.getBounds();
  });
  mainWindow.on('maximize',   () => { layoutMusicView(); mainWindow.webContents.send('maximized', true);  settings.maximized = true;  });
  mainWindow.on('unmaximize', () => { layoutMusicView(); mainWindow.webContents.send('maximized', false); settings.maximized = false; });

  mainWindow.on('close', e => {
    if (!isQuitting && settings.closeToTray) {
      e.preventDefault();
      mainWindow.hide();
      if (process.platform === 'darwin') app.dock.hide();
    } else {
      settings.windowBounds = mainWindow.isMaximized() ? settings.windowBounds : mainWindow.getBounds();
      saveSettings();
    }
  });

  mainWindow.webContents.once('did-finish-load', () => createMusicView());
  Menu.setApplicationMenu(null);
}

// ─────────────────────────────────────────────────────────────────
//  System Tray
// ─────────────────────────────────────────────────────────────────
const exec = js => musicView?.webContents.executeJavaScript(js).catch(() => {});

function createTray () {
  // Tray icon: prefer tray-specific asset, fall back to main icon resized
  let icon;
  const trayPath = path.join(__dirname, 'assets', 'tray-icon.png');
  if (fs.existsSync(trayPath)) {
    icon = nativeImage.createFromPath(trayPath);
    if (process.platform !== 'darwin') icon = icon.resize({ width: 16, height: 16 });
  } else {
    icon = getAppIcon().resize({ width: 16, height: 16 });
  }

  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
      if (process.platform === 'darwin') app.dock.hide();
    } else {
      mainWindow.show(); mainWindow.focus();
      if (process.platform === 'darwin') app.dock.show();
    }
  });

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '▶  Show YT Music', click: () => { mainWindow.show(); mainWindow.focus(); if (process.platform === 'darwin') app.dock.show(); } },
    { type: 'separator' },
    { label: '⏮  Previous',     click: () => exec(`document.querySelector('.previous-button')?.click()`) },
    { label: '⏯  Play / Pause', click: () => exec(`document.querySelector('.play-pause-button')?.click()`) },
    { label: '⏭  Next',         click: () => exec(`document.querySelector('.next-button')?.click()`) },
    { type: 'separator' },
    { label: '🏠  Home',         click: () => { mainWindow.show(); musicView?.webContents.loadURL(YT_MUSIC_URL); } },
    { label: '🔄  Reload',       click: () => { mainWindow.show(); musicView?.webContents.reload(); } },
    { type: 'separator' },
    { label: '✕  Quit',          click: () => { isQuitting = true; app.quit(); } },
  ]));
}

// ─────────────────────────────────────────────────────────────────
//  Global media-key shortcuts
// ─────────────────────────────────────────────────────────────────
function registerShortcuts () {
  const reg = (key, js) => { try { globalShortcut.register(key, () => exec(js)); } catch (_) {} };
  reg('MediaPlayPause',     `document.querySelector('.play-pause-button')?.click()`);
  reg('MediaNextTrack',     `document.querySelector('.next-button')?.click()`);
  reg('MediaPreviousTrack', `document.querySelector('.previous-button')?.click()`);
}

// ─────────────────────────────────────────────────────────────────
//  IPC
// ─────────────────────────────────────────────────────────────────
ipcMain.on('window-minimize',  () => mainWindow?.minimize());
ipcMain.on('window-maximize',  () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize());
ipcMain.on('window-close',     () => {
  if (settings.closeToTray) { mainWindow?.hide(); if (process.platform === 'darwin') app.dock.hide(); }
  else { isQuitting = true; app.quit(); }
});

ipcMain.on('nav-back',    () => musicView?.webContents.canGoBack()    && musicView.webContents.goBack());
ipcMain.on('nav-forward', () => musicView?.webContents.canGoForward() && musicView.webContents.goForward());
ipcMain.on('nav-home',    () => musicView?.webContents.loadURL(YT_MUSIC_URL));
ipcMain.on('nav-reload',  () => musicView?.webContents.reload());
ipcMain.on('open-devtools', () => musicView?.webContents.openDevTools());

ipcMain.handle('get-settings', () => settings);
ipcMain.on('save-settings', (_, s) => { settings = { ...settings, ...s }; saveSettings(); });

ipcMain.on('sign-out', async () => {
  const ses = getMusicSession();
  await ses.clearStorageData({ storages: ['cookies','localstorage','sessionstorage','indexdb','cachestorage','serviceworkers'] });
  musicView?.webContents.loadURL(YT_MUSIC_URL);
});

// ─────────────────────────────────────────────────────────────────
//  App lifecycle
// ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  spoofUA(getMusicSession());
  spoofUA(session.defaultSession);

  createMainWindow();
  createTray();
  registerShortcuts();

  app.on('activate', () => {
    mainWindow?.show(); mainWindow?.focus();
    if (process.platform === 'darwin') app.dock.show();
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

app.on('before-quit', () => {
  isQuitting = true;
  if (mainWindow && !mainWindow.isMaximized()) settings.windowBounds = mainWindow.getBounds();
  settings.maximized = mainWindow?.isMaximized() ?? true;
  saveSettings();
  globalShortcut.unregisterAll();
});
