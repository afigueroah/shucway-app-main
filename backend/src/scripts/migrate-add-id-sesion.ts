import { supabase } from '../config/database';

async function runMigration() {
  try {
    console.log('🚀 Ejecutando migración: add_id_sesion_to_arqueo_caja');

    // SQL para agregar la columna id_sesion
    const migrationSQL = `
      -- Agregar columna id_sesion a arqueo_caja para relacionarla con caja_sesion
      ALTER TABLE arqueo_caja ADD COLUMN IF NOT EXISTS id_sesion INTEGER REFERENCES caja_sesion(id_sesion);

      -- Crear índice para mejorar rendimiento de consultas JOIN
      CREATE INDEX IF NOT EXISTS idx_arqueo_caja_id_sesion ON arqueo_caja(id_sesion);
    `;

    console.log('📄 Ejecutando SQL:');
    console.log(migrationSQL);

    // Ejecutar usando Supabase client (rpc function o raw SQL)
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      console.error('❌ Error al ejecutar migración:', error);
      return;
    }

    console.log('✅ Migración ejecutada exitosamente');
    console.log('Resultado:', data);

  } catch (error) {
    console.error('❌ Error al ejecutar migración:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runMigration();
}

export { runMigration };