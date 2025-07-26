const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const exeDir = process.cwd(); // The directory where the exe is running
const dataDir = path.join(exeDir, 'data');
const dataFilePath = path.join(dataDir, 'companies.json');

// Ensure the data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// On first run, copy default companies.json from packaged location if it doesn't exist
const packagedDataPath = path.join(app.getAppPath(), 'data', 'companies.json');
if (!fs.existsSync(dataFilePath)) {
    if (fs.existsSync(packagedDataPath)) {
        fs.copyFileSync(packagedDataPath, dataFilePath);
    } else {
        fs.writeFileSync(dataFilePath, '[]', 'utf-8');
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

  // Open dev tools if in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
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
  if (!fs.existsSync(dataFilePath)) return [];
  const raw = fs.readFileSync(dataFilePath, 'utf-8');
  return JSON.parse(raw);
});

ipcMain.handle('save-companies', async (event, companies) => {
  fs.writeFileSync(dataFilePath, JSON.stringify(companies, null, 2), 'utf-8');
  return true;
});

ipcMain.handle('open-email-client', (event, { email, subject, body }) => {
  shell.openExternal(`mailto:${email}?subject=${subject}&body=${body}`);
});

async function addCompany(newCompany) {
  const companies = await loadCompanies();
  console.log('Before:', companies);
  companies.push(newCompany);
  console.log('After:', companies);
  await saveCompanies(companies);
}

