const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getCompanies: () => ipcRenderer.invoke('get-companies'),
  saveCompanies: (companies) => ipcRenderer.invoke('save-companies', companies),
  openEmailClient: (email, subject, body) => ipcRenderer.invoke('open-email-client', { email, subject, body }),
  
  // Google Sheets configuration
  isSheetsConfigured: () => ipcRenderer.invoke('is-sheets-configured'),
  configureSheets: (credentialsContent, spreadsheetId) => ipcRenderer.invoke('configure-sheets', { credentialsContent, spreadsheetId }),
  resetSheetsConfig: () => ipcRenderer.invoke('reset-sheets-config'),
  
  // Cache management
  forceRefreshData: () => ipcRenderer.invoke('force-refresh-data'),
  getCacheStatus: () => ipcRenderer.invoke('get-cache-status'),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  clearAllData: () => ipcRenderer.invoke('clear-all-data')
});