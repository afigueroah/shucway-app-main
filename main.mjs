import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import express from 'express';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prevenir múltiples instancias
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

let mainWindow;
let frontendServer;

function startFrontendServer() {
  console.log('Starting frontend server...');
  const app = express();
  const staticPath = path.join(process.resourcesPath, 'app', 'frontend', 'dist');
  console.log('Static path:', staticPath);
  app.use(express.static(staticPath));
  frontendServer = app.listen(3001, () => {
    console.log('Frontend server running on http://localhost:3001');
  });
}

function createWindow() {
  // Crear la ventana principal
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
    },
    icon: path.join(process.resourcesPath, 'app', 'frontend', 'public', 'logo.png'), // Si tienes un ícono
  });

  // Cargar el frontend desde el servidor local
  mainWindow.loadURL('http://localhost:3001');

  // Abrir DevTools para debug
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  console.log('Starting backend...');
  const backendPath = path.join(process.resourcesPath, 'app', 'backend', 'dist', 'index.js');
  console.log('Backend path:', backendPath);
  try {
    require(backendPath);
    console.log('Backend loaded successfully');
  } catch (err) {
    console.error('Backend load error:', err);
  }
}

app.whenReady().then(() => {
  startFrontendServer();
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Cerrar el frontend server cuando se cierren todas las ventanas
  if (frontendServer) {
    frontendServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Asegurar que el frontend server se cierre
  if (frontendServer) {
    frontendServer.close();
  }
});