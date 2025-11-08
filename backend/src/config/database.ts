import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './env';
import { logger } from '../utils/logger';

// Cliente de Supabase con Service Role Key (bypass RLS)
export const supabase: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'apikey': config.supabase.serviceKey,
        'Authorization': `Bearer ${config.supabase.serviceKey}`
      }
    }
  }
);

// Función para verificar la conexión a la base de datos
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    // Verificación rápida: intentar obtener información de la conexión
    // En lugar de hacer una consulta completa, solo verificamos que podemos conectar
    const { error } = await supabase
      .from('rol_usuario')
      .select('count', { count: 'exact', head: true })
      .limit(0);

    if (error) {
      logger.error('Error al conectar con Supabase:', error.message);
      return false;
    }

    logger.info('✅ Conexión exitosa con Supabase PostgreSQL');
    return true;
  } catch (error) {
    logger.error('Error inesperado al conectar con Supabase:', error);
    return false;
  }
}

export default supabase;
