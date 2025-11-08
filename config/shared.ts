// Configuración compartida para variables globales
// Este archivo contiene constantes que pueden ser compartidas entre frontend y backend
// cuando la base de datos y servicios sean globales

export const SHARED_CONFIG = {
  // Supabase (Base de datos global)
  SUPABASE_URL: 'https://cdrzomyyxyfhazkzuwou.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkcnpvbXl5eHlmaGF6a3p1d291Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyOTY0ODcsImV4cCI6MjA3NTg3MjQ4N30.UxQj1g9uRMi2Z0HRa_u-ksYJUI9o1H2Q-kTEa8RZqfo',

  // URLs de la aplicación
  API_BASE_URL: '/api',
  FRONTEND_URL: 'http://localhost:5173',

  // Configuración general
  APP_NAME: 'Shucway App',
  VERSION: '1.0.0',

  // Niveles de permisos (constantes globales)
  PERMISSIONS: {
    OWNER: 100,
    ADMIN: 80,
    CASHIER: 30,
    CLIENT: 10
  }
} as const;

// Función helper para obtener variables de entorno con fallback a shared
export const getEnvVar = (key: string, fallback?: string): string => {
  const envKey = `VITE_${key}`;
  return import.meta.env?.[envKey] || process.env[key] || fallback || SHARED_CONFIG[key as keyof typeof SHARED_CONFIG] as string || '';
};

// Nota: Este archivo puede ser importado en frontend y backend
// En frontend: usar getEnvVar() o variables VITE_ del .env para runtime
// En backend: usar las variables del .env del backend