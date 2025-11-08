import winston from 'winston';
import { config } from '../config/env';
import path from 'path';
import fs from 'fs';

const isVercel = !!process.env.VERCEL;

// Carpeta de logs (solo se usa fuera de Vercel)
const logsDir = isVercel ? '/tmp/logs' : path.join(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
} catch {
  // En Vercel puede fallar la creación; ignoramos silenciosamente
}

// Formato personalizado
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    if (stack) return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
  })
);

// Transportes
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(winston.format.colorize(), customFormat),
});

const fileTransports = isVercel
  ? [] // En Vercel evitamos escribir archivos persistentes
  : [
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
      }),
    ];

export const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: customFormat,
  transports: [consoleTransport, ...fileTransports],
  exceptionHandlers: isVercel
    ? [consoleTransport]
    : [new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') })],
  rejectionHandlers: isVercel
    ? [consoleTransport]
    : [new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') })],
});

export default logger;
