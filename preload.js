const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Configuration API
  getApiKey: () => ipcRenderer.invoke('config:get-api-key'),
  setApiKey: (key) => ipcRenderer.invoke('config:set-api-key', key),
  
  // Logs API
  listLogs: () => ipcRenderer.invoke('logs:list'),
  readLog: (filename) => ipcRenderer.invoke('logs:read', filename),
  
  // AI Generation API
  generateCommand: (prompt) => ipcRenderer.invoke('ai:generate', prompt),
  
  // Node-PTY API
  initPty: (cols, rows) => ipcRenderer.send('pty:init', { cols, rows }),
  writePty: (data) => ipcRenderer.send('pty:write', data),
  resizePty: (cols, rows) => ipcRenderer.send('pty:resize', { cols, rows }),
  
  // PTY Event Listeners
  onPtyData: (callback) => ipcRenderer.on('pty:data', (event, data) => callback(data)),
  
  // Custom Execution Pipeline Trigger
  executeAiCommand: (prompt, command) => ipcRenderer.send('ai:execute', { prompt, command }),

  // Generic link open
  openExternalLink: (url) => ipcRenderer.send('app:open-external', url),

  // Window Management API
  startDrag: () => ipcRenderer.send('window-start-drag'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close')
});
