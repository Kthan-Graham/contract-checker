const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getCompanies: () => ipcRenderer.invoke('get-companies'),
  saveCompanies: (companies) => ipcRenderer.invoke('save-companies', companies),
  openEmailClient: (email, subject, body) => ipcRenderer.invoke('open-email-client', { email, subject, body })
});