import { Pool } from 'pg';
import { config } from '../config/env';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  let pool: Pool | null = null;

  try {
    console.log('🚀 Ejecutando migración: add_acumula_puntos_to_venta');

    // Verificar que tenemos las credenciales de PostgreSQL
    if (!config.supabase.dbHost || !config.supabase.dbUser || !config.supabase.dbPassword) {
      console.error('❌ Credenciales de PostgreSQL no configuradas');
      console.log('Necesitas configurar SUPABASE_DB_HOST, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD en el archivo .env');
      process.exit(1);
    }

    // Crear pool de conexión
    pool = new Pool({
      host: config.supabase.dbHost,
      port: parseInt(config.supabase.dbPort),
      database: config.supabase.dbName || 'postgres',
      user: config.supabase.dbUser,
      password: config.supabase.dbPassword,
      ssl: { rejectUnauthorized: false }
    });

    // Leer el archivo de migración
    const migrationPath = join(__dirname, '../../../migrations/20251119_add_acumula_puntos_to_venta.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Contenido de la migración:');
    console.log(migrationSQL);

    // Ejecutar la migración
    const client = await pool.connect();
    try {
      await client.query(migrationSQL);
      console.log('✅ Migración ejecutada exitosamente');
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error al ejecutar migración:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runMigration();
}

export { runMigration };