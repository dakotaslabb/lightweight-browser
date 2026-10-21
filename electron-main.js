const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow;
let serverProcess;

function startEmbeddedServer(callback) {
  // Start the internal express server for the proxy and bookmarks
  try {
    const expressApp = require('./server.js');
    // server.js starts listening on port 8080 by default
    setTimeout(callback, 500);
  } catch (err) {
    console.error('Failed to start embedded server:', err);
    callback();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: 'Light Browser',
    backgroundColor: '#121417',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL('http://localhost:8080');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startEmbeddedServer(() => {
    createWindow();
  });

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
