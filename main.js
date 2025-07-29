const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const SheetsService = require('./src/sheets-service');

// Google Sheets configuration
const sheetsService = new SheetsService();
let sheetsInitialized = false;

// Configuration file paths
const configDir = path.join(process.cwd(), 'config');
const credentialsPath = path.join(configDir, 'credentials.json');
const configPath = path.join(configDir, 'config.json');

// Ensure config directory exists
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
}

async function initializeSheets() {
    try {
        // Check if credentials and config exist
        if (!fs.existsSync(credentialsPath) || !fs.existsSync(configPath)) {
            console.log('Google Sheets not configured yet');
            return false;
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const success = await sheetsService.initialize(credentialsPath, config.spreadsheetId);
        
        if (success) {
            sheetsInitialized = true;
            console.log('Google Sheets initialized successfully');
        }
        
        return success;
    } catch (error) {
        console.error('Failed to initialize Google Sheets:', error);
        return false;
    }
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false
    },
    icon: path.join(__dirname, 'build/icon.png')
  });

  mainWindow.loadFile('index.html');

  // Redirect console logs from renderer to main process
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER] ${message}`);
  });

  // Open dev tools if in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await initializeSheets();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC communication for database operations
ipcMain.handle('get-companies', async () => {
  console.log('get-companies called, sheetsInitialized:', sheetsInitialized);
  if (sheetsInitialized) {
    console.log('Using Google Sheets for getting companies');
    try {
      const result = await sheetsService.getCompanies();
      console.log('Google Sheets returned:', result?.length, 'companies');
      return result;
    } catch (error) {
      console.error('Error getting companies from Google Sheets:', error);
      // Fallback to local storage on error
      const dataDir = path.join(process.cwd(), 'data');
      const dataFilePath = path.join(dataDir, 'companies.json');
      
      if (!fs.existsSync(dataFilePath)) return [];
      const raw = fs.readFileSync(dataFilePath, 'utf-8');
      console.log('Falling back to local storage due to Google Sheets error');
      return JSON.parse(raw);
    }
  } else {
    console.log('Using local storage for getting companies');
    // Fallback to local JSON if sheets not configured
    const dataDir = path.join(process.cwd(), 'data');
    const dataFilePath = path.join(dataDir, 'companies.json');
    
    if (!fs.existsSync(dataFilePath)) return [];
    const raw = fs.readFileSync(dataFilePath, 'utf-8');
    return JSON.parse(raw);
  }
});

ipcMain.handle('save-companies', async (event, companies) => {
  console.log('🔽 save-companies called, sheetsInitialized:', sheetsInitialized);
  console.log('🔽 Attempting to save', companies?.length, 'companies');
  
  if (companies && companies.length > 0) {
    console.log('🔽 First company:', JSON.stringify(companies[0], null, 2));
    if (companies[0].milestones) {
      const completedMilestones = companies[0].milestones.filter(m => m.completed);
      console.log('🔽 First company has', completedMilestones.length, 'completed milestones');
    }
  }
  
  if (sheetsInitialized) {
    console.log('🔽 Using Google Sheets for saving companies');
    try {
      const result = await sheetsService.saveCompanies(companies);
      console.log('🔽 Google Sheets save result:', result);
      return result;
    } catch (error) {
      console.error('🔽 Error saving companies to Google Sheets:', error);
      // Fallback to local storage on error
      const dataDir = path.join(process.cwd(), 'data');
      const dataFilePath = path.join(dataDir, 'companies.json');
      
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(dataFilePath, JSON.stringify(companies, null, 2), 'utf-8');
      console.log('🔽 Saved to local storage due to Google Sheets error');
      return true;
    }
  } else {
    console.log('🔽 Using local storage for saving companies');
    // Fallback to local JSON if sheets not configured
    const dataDir = path.join(process.cwd(), 'data');
    const dataFilePath = path.join(dataDir, 'companies.json');
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(dataFilePath, JSON.stringify(companies, null, 2), 'utf-8');
    return true;
  }
});

ipcMain.handle('open-email-client', (event, { email, subject, body }) => {
  shell.openExternal(`mailto:${email}?subject=${subject}&body=${body}`);
});

// Google Sheets configuration handlers
ipcMain.handle('is-sheets-configured', () => {
  return sheetsInitialized;
});

ipcMain.handle('configure-sheets', async (event, { credentialsContent, spreadsheetId }) => {
  try {
    // Save credentials file
    fs.writeFileSync(credentialsPath, credentialsContent, 'utf-8');
    
    // Save config file
    const config = { spreadsheetId };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    // Initialize sheets
    const success = await initializeSheets();
    
    if (success) {
      return { success: true, message: 'Google Sheets configured successfully!' };
    } else {
      return { success: false, message: 'Failed to connect to Google Sheets. Please check your credentials and spreadsheet ID.' };
    }
  } catch (error) {
    console.error('Error configuring sheets:', error);
    return { success: false, message: `Configuration error: ${error.message}` };
  }
});

ipcMain.handle('reset-sheets-config', () => {
  try {
    if (fs.existsSync(credentialsPath)) {
      fs.unlinkSync(credentialsPath);
    }
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    sheetsInitialized = false;
    return { success: true, message: 'Google Sheets configuration reset successfully!' };
  } catch (error) {
    return { success: false, message: `Error resetting configuration: ${error.message}` };
  }
});

// Force refresh handler
ipcMain.handle('force-refresh-data', async () => {
  if (sheetsInitialized) {
    try {
      const companies = await sheetsService.forceRefresh();
      return { success: true, companies };
    } catch (error) {
      console.error('Error force refreshing data:', error);
      return { success: false, message: error.message };
    }
  } else {
    return { success: false, message: 'Google Sheets not configured' };
  }
});

// Clear all data handler
ipcMain.handle('clear-all-data', async () => {
  if (sheetsInitialized) {
    try {
      const result = await sheetsService.clearAllData();
      if (result) {
        return { success: true, message: 'All data cleared successfully!' };
      } else {
        return { success: false, message: 'Failed to clear data' };
      }
    } catch (error) {
      console.error('Error clearing data:', error);
      return { success: false, message: error.message };
    }
  } else {
    return { success: false, message: 'Google Sheets not configured' };
  }
});
