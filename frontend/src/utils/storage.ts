// ================================================================
// 🔧 SERVICIO DE ALMACENAMIENTO OPTIMIZADO
// ================================================================
// Maneja localStorage, sessionStorage y cookies con mejor rendimiento y error handling

// Interfaces para configuración
interface StorageOptions {
  expires?: number; // tiempo en minutos para expiración
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

interface StorageItem<T = unknown> {
  value: T;
  timestamp: number;
  expires?: number;
}

// Constantes de configuración
const STORAGE_PREFIX = 'shucway_';
const COOKIE_PREFIX = 'shucway_cookie_';
const DEFAULT_EXPIRY_MINUTES = 60 * 24 * 7; // 7 días por defecto

// ================================================================
// LOCALSTORAGE OPTIMIZADO
// ================================================================
class OptimizedLocalStorage {
  private isAvailable(): boolean {
    try {
      if (typeof window === 'undefined') return false;
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  set<T>(key: string, value: T, options: StorageOptions = {}): boolean {
    if (!this.isAvailable()) return false;

    try {
      const item: StorageItem<T> = {
        value,
        timestamp: Date.now(),
        expires: options.expires ? Date.now() + (options.expires * 60 * 1000) : undefined
      };

      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(item));
      return true;
    } catch (error) {
      console.warn('Error saving to localStorage:', error);
      return false;
    }
  }

  get<T>(key: string, defaultValue?: T): T | null {
    if (!this.isAvailable()) return defaultValue || null;

    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (!raw) return defaultValue || null;

      const item: StorageItem<T> = JSON.parse(raw);

      // Verificar expiración
      if (item.expires && Date.now() > item.expires) {
        this.remove(key);
        return defaultValue || null;
      }

      return item.value;
    } catch (error) {
      console.warn('Error reading from localStorage:', error);
      return defaultValue || null;
    }
  }

  remove(key: string): boolean {
    if (!this.isAvailable()) return false;

    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      return true;
    } catch {
      return false;
    }
  }

  clear(): boolean {
    if (!this.isAvailable()) return false;

    try {
      // Solo limpiar keys con nuestro prefijo
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  // Limpiar items expirados
  cleanup(): void {
    if (!this.isAvailable()) return;

    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(STORAGE_PREFIX)) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const item: StorageItem = JSON.parse(raw);
              if (item.expires && Date.now() > item.expires) {
                localStorage.removeItem(key);
              }
            }
          } catch {
            // Remover items corruptos
            localStorage.removeItem(key);
          }
        }
      });
    } catch (error) {
      console.warn('Error during localStorage cleanup:', error);
    }
  }
}

// ================================================================
// SESSIONSTORAGE OPTIMIZADO
// ================================================================
class OptimizedSessionStorage {
  private isAvailable(): boolean {
    try {
      if (typeof window === 'undefined') return false;
      const test = '__session_test__';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  set<T>(key: string, value: T): boolean {
    if (!this.isAvailable()) return false;

    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('Error saving to sessionStorage:', error);
      return false;
    }
  }

  get<T>(key: string, defaultValue?: T): T | null {
    if (!this.isAvailable()) return defaultValue || null;

    try {
      const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
      return raw ? JSON.parse(raw) : (defaultValue || null);
    } catch (error) {
      console.warn('Error reading from sessionStorage:', error);
      return defaultValue || null;
    }
  }

  remove(key: string): boolean {
    if (!this.isAvailable()) return false;

    try {
      sessionStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      return true;
    } catch {
      return false;
    }
  }

  clear(): boolean {
    if (!this.isAvailable()) return false;

    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith(STORAGE_PREFIX)) {
          sessionStorage.removeItem(key);
        }
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ================================================================
// COOKIES OPTIMIZADAS
// ================================================================
class OptimizedCookies {
  private isAvailable(): boolean {
    return typeof document !== 'undefined' && !!document.cookie;
  }

  set(key: string, value: string, options: StorageOptions = {}): boolean {
    if (!this.isAvailable()) return false;

    try {
      const expires = options.expires || DEFAULT_EXPIRY_MINUTES;
      const expiryDate = new Date(Date.now() + (expires * 60 * 1000));

      let cookieString = `${COOKIE_PREFIX}${key}=${encodeURIComponent(value)}; expires=${expiryDate.toUTCString()}; path=/`;

      if (options.secure) {
        cookieString += '; secure';
      }

      if (options.sameSite) {
        cookieString += `; samesite=${options.sameSite}`;
      }

      document.cookie = cookieString;
      return true;
    } catch (error) {
      console.warn('Error setting cookie:', error);
      return false;
    }
  }

  get(key: string): string | null {
    if (!this.isAvailable()) return null;

    try {
      const name = `${COOKIE_PREFIX}${key}=`;
      const decodedCookie = decodeURIComponent(document.cookie);
      const cookies = decodedCookie.split(';');

      for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(name)) {
          return cookie.substring(name.length);
        }
      }
      return null;
    } catch (error) {
      console.warn('Error reading cookie:', error);
      return null;
    }
  }

  remove(key: string): boolean {
    if (!this.isAvailable()) return false;

    try {
      // Establecer expiración en el pasado para eliminar
      document.cookie = `${COOKIE_PREFIX}${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      return true;
    } catch {
      return false;
    }
  }

  clear(): boolean {
    if (!this.isAvailable()) return false;

    try {
      const cookies = document.cookie.split(';');
      cookies.forEach(cookie => {
        const name = cookie.split('=')[0].trim();
        if (name.startsWith(COOKIE_PREFIX)) {
          this.remove(name.replace(COOKIE_PREFIX, ''));
        }
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ================================================================
// INSTANCIAS GLOBALES
// ================================================================
export const localStore = new OptimizedLocalStorage();
export const sessionStore = new OptimizedSessionStorage();
export const cookieStore = new OptimizedCookies();

// ================================================================
// FUNCIONES DE COMPATIBILIDAD (para migración gradual)
// ================================================================
export const getFromStorage = localStore.get.bind(localStore);
export const setToStorage = localStore.set.bind(localStore);
export const removeFromStorage = localStore.remove.bind(localStore);

// ================================================================
// UTILIDADES DE RENDIMIENTO
// ================================================================

// Debounce para reducir llamadas excesivas
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle para controlar frecuencia de llamadas
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Cache con TTL para llamadas API
class ApiCache {
  private cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();

  set(key: string, data: unknown, ttlMinutes: number = 5): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

export const apiCache = new ApiCache();

// ================================================================
// INICIALIZACIÓN
// ================================================================

// Cleanup automático cada 5 minutos
if (typeof window !== 'undefined') {
  setInterval(() => {
    localStore.cleanup();
    apiCache.cleanup();
  }, 5 * 60 * 1000);
}

export default {
  localStore,
  sessionStore,
  cookieStore,
  apiCache,
  debounce,
  throttle
};