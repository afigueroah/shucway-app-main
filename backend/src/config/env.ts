import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Esquema de validación para las variables de entorno
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3002'),
  
  // Supabase (solo como base de datos PostgreSQL)
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  
  // PostgreSQL connection for pg_dump
  SUPABASE_DB_HOST: z.string().optional(),
  SUPABASE_DB_PORT: z.string().default('5432'),
  SUPABASE_DB_NAME: z.string().optional(),
  SUPABASE_DB_USER: z.string().optional(),
  SUPABASE_DB_PASSWORD: z.string().optional(),
  
  // JWT (autenticación personalizada)
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  
  // CORS (permite múltiples orígenes separados por coma)
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('1000')
});

// Validar variables de entorno
const envValidation = envSchema.safeParse(process.env);

if (!envValidation.success) {
  console.error('❌ Error en las variables de entorno:');
  console.error(envValidation.error.format());
  process.exit(1);
}

const env = envValidation.data;

// Exportar configuración tipada
export const config = {
  env: env.NODE_ENV,
  port: parseInt(env.PORT, 10),
  
  supabase: {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceKey: env.SUPABASE_SERVICE_KEY,
    dbHost: env.SUPABASE_DB_HOST,
    dbPort: env.SUPABASE_DB_PORT,
    dbName: env.SUPABASE_DB_NAME,
    dbUser: env.SUPABASE_DB_USER,
    dbPassword: env.SUPABASE_DB_PASSWORD
  },
  
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN as string,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN as string
  },
  
  cors: {
    origin: env.CORS_ORIGIN
  },
  
  rateLimit: {
    windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS, 10),
    maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10)
  }
};

export default config;
