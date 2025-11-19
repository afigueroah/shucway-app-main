import { app, BrowserWindow } from 'electron';
import path from 'path';
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import net from 'net';
import fs from 'fs';
import express from 'express';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Debug log (escribimos después de inicializar __dirname)
fs.writeFileSync(path.join(__dirname, 'debug.log'), 'Main.js started at ' + new Date().toISOString() + '\n');

// Función para loggear a archivo
function logToFile(message) {
  const logPath = path.join(__dirname, 'electron-log.txt');
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
}

logToFile('=== APPLICATION START ===');
logToFile('__dirname: ' + __dirname);
logToFile('Platform: ' + process.platform);
logToFile('Node version: ' + process.version);
logToFile('Electron version: ' + process.versions.electron);

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
  
  // Fallback para SPA routing - servir index.html para cualquier ruta no encontrada
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
  
  frontendServer = app.listen(3001, () => {
    console.log('Frontend server running on http://localhost:3001');
    logToFile('Frontend server started successfully');
  });
  frontendServer.on('error', (err) => {
    console.error('Error starting frontend server:', err);
    logToFile('Error starting frontend server: ' + err.message);
  });
}

function createWindow() {
  logToFile('Creating window...');
  console.log('Creating window...');
  
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
    show: false, // No mostrar hasta que esté listo
  });
  
  logToFile('Window created, loading URL...');
  console.log('Window created, loading URL...');

  // Cargar el frontend inmediatamente desde el servidor local
  logToFile('Cargando frontend desde http://localhost:3001');
  console.log('Cargando frontend desde http://localhost:3001');
  mainWindow.loadURL('http://localhost:3001');
  // Abrir DevTools para debug
  mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-finish-load', () => {
    logToFile('Frontend loaded successfully, showing window...');
    console.log('Frontend loaded successfully, showing window...');
    mainWindow.show(); // Mostrar la ventana cuando esté lista
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logToFile('Failed to load frontend: ' + errorDescription);
    console.error('Failed to load frontend:', errorDescription);
  });

  mainWindow.on('ready-to-show', () => {
    logToFile('Window ready to show');
    console.log('Window ready to show');
  });

  mainWindow.on('show', () => {
    logToFile('Window shown');
    console.log('Window shown');
  });

  mainWindow.on('closed', () => {
    logToFile('Window closed');
    console.log('Window closed');
    mainWindow = null;
  });
}

function startBackend() {
  logToFile('Starting backend...');
  console.log('Starting backend...');
  
  const backendPath = path.join(__dirname, 'backend', 'dist', 'index.js');
  logToFile('Backend path: ' + backendPath);
  console.log('Backend path:', backendPath);
  
  // Verificar si el archivo existe
  if (!fs.existsSync(backendPath)) {
    logToFile('Backend file not found at: ' + backendPath);
    console.error('Backend file not found at:', backendPath);
    return;
  }
  
  const cwdPath = path.join(__dirname, 'backend');
  logToFile('CWD: ' + cwdPath);
  
  // Detectar Node.js disponible
  let nodePath = 'node'; // Por defecto usar 'node' del PATH
  
  // En Windows, intentar rutas específicas si 'node' no está en PATH
  if (process.platform === 'win32') {
    const possiblePaths = [
      'C:\\Program Files\\nodejs\\node.exe',
      'C:\\Program Files (x86)\\nodejs\\node.exe',
      path.join(__dirname, 'node.exe'), // En el directorio del ejecutable
      path.join(__dirname, '..', 'node.exe') // Un directorio arriba
    ];
    
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        nodePath = testPath;
        logToFile('Found Node.js at: ' + nodePath);
        break;
      }
    }
  }
  
  logToFile('Using Node.js path: ' + nodePath);
  
  try {
    // Cambiar a spawn para mejor control del proceso
    const args = [backendPath];
    logToFile('Spawning backend with args: ' + JSON.stringify(args));
    
    backendProcess = spawn(nodePath, args, {
      cwd: cwdPath,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        SKIP_DB_CHECK: 'true',
        PORT: '3002'
      },
      stdio: ['pipe', 'pipe', 'pipe'] // Para capturar stdout/stderr
    });
    
    backendProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      logToFile('Backend stdout: ' + msg);
      console.log('Backend stdout:', msg);
    });
    
    backendProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      logToFile('Backend stderr: ' + msg);
      console.error('Backend stderr:', msg);
    });
    
    backendProcess.on('exit', (code, signal) => {
      logToFile(`Backend process exited with code ${code} and signal ${signal}`);
      console.log(`Backend process exited with code ${code} and signal ${signal}`);
    });
    
    backendProcess.on('error', (err) => {
      logToFile('Backend process error: ' + err.message);
      console.error('Backend process error:', err);
    });
    
    logToFile('Backend process started successfully');
    console.log('Backend process started successfully');
    
  } catch (error) {
    logToFile('Failed to start backend process: ' + error.message);
    console.error('Failed to start backend process:', error);
  }
}

app.whenReady().then(() => {
  logToFile('App ready, starting services...');
  console.log('App ready, starting services...');
  
  startFrontendServer();
  startBackend();
  createWindow();

  app.on('activate', () => {
    logToFile('App activated');
    console.log('App activated');
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