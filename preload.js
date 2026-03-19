const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // Window controls
  minimize : () => ipcRenderer.send('window-minimize'),
  maximize : () => ipcRenderer.send('window-maximize'),
  close    : () => ipcRenderer.send('window-close'),

  // Navigation
  navBack   : () => ipcRenderer.send('nav-back'),
  navForward: () => ipcRenderer.send('nav-forward'),
  navHome   : () => ipcRenderer.send('nav-home'),
  navReload : () => ipcRenderer.send('nav-reload'),

  // DevTools
  openDevTools: () => ipcRenderer.send('open-devtools'),

  // Auth
  signOut: () => ipcRenderer.send('sign-out'),

  // Settings
  getSettings : ()  => ipcRenderer.invoke('get-settings'),
  saveSettings: (s) => ipcRenderer.send('save-settings', s),

  // Events from main → renderer
  on: (channel, cb) => {
    const allowed = ['loading','nav-state','title-changed','load-error','maximized'];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => cb(...args));
    }
  },
});
