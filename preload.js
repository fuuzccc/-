const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('futureMemo', {
  readData: (name) => ipcRenderer.invoke('data:read', name),
  writeData: (name, data) => ipcRenderer.invoke('data:write', name, data),
  setAutostart: (on) => ipcRenderer.invoke('settings:autostart', on),
  getAutostart: () => ipcRenderer.invoke('settings:getAutostart'),
  exportData: () => ipcRenderer.invoke('app:export'),
  importData: (mode) => ipcRenderer.invoke('app:import', mode),
  getVersion: () => ipcRenderer.invoke('app:version'),
  onShowAbout: (cb) => ipcRenderer.on('show-about', () => cb()),
  getNowString: () => new Date().toISOString(),
});
