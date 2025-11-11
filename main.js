import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import express from 'express';
import { fileURLToPath } from 'url';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Función para verificar si el puerto está abierto
function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.connect(port, host, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

let mainWindow;
let backendProcess;
let frontendServer;

function startFrontendServer() {
  console.log('Starting frontend server...');
  const app = express();
  const staticPath = path.join(__dirname, 'frontend', 'dist');
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
    icon: path.join(__dirname, 'frontend', 'public', 'logo.png'), // Si tienes un ícono
  });

  // Esperar a que el backend esté listo
  const checkBackend = async () => {
    const isReady = await checkPort(3002);
    if (isReady) {
      console.log('Backend listo, cargando frontend...');
      const indexPath = path.join(__dirname, 'frontend', 'dist', 'index.html');
      mainWindow.loadFile(indexPath);
      // Abrir DevTools para debug
      mainWindow.webContents.openDevTools();
    } else {
      console.log('Backend no listo, esperando...');
      setTimeout(checkBackend, 1000);
    }
  };

  checkBackend();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  console.log('Starting backend...');
  const backendPath = path.join(__dirname, 'backend', 'dist', 'index.js');
  console.log('Backend path:', backendPath);
  backendProcess = spawn('node', [backendPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production' },
    cwd: path.join(__dirname, 'backend'),
  });
  backendProcess.stdout.on('data', (data) => {
    console.log('Backend stdout:', data.toString());
  });
  backendProcess.stderr.on('data', (data) => {
    console.error('Backend stderr:', data.toString());
  });
  backendProcess.on('exit', (code, signal) => {
    console.log(`Backend process exited with code ${code} and signal ${signal}`);
  });
  backendProcess.on('error', (err) => {
    console.error('Backend process error:', err);
  });
  console.log('Backend process started');
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
  // Cerrar el backend y frontend server cuando se cierren todas las ventanas
  if (backendProcess) {
    backendProcess.kill();
  }
  if (frontendServer) {
    frontendServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Asegurar que el backend y frontend server se cierren
  if (backendProcess) {
    backendProcess.kill();
  }
  if (frontendServer) {
    frontendServer.close();
  }
});