import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  host: process.env.SUPABASE_DB_HOST,
  port: process.env.SUPABASE_DB_PORT || 5432,
  database: process.env.SUPABASE_DB_NAME,
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function checkFunction() {
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname = 'fn_acumular_puntos_venta'
    `);
    
    if (result.rows.length > 0) {
      const definition = result.rows[0].definition;
      console.log('📄 Definición de la función fn_acumular_puntos_venta:');
      console.log(definition);
      
      if (definition.includes('NEW.total_venta')) {
        console.log('✅ La función usa correctamente NEW.total_venta');
      } else if (definition.includes('NEW.total')) {
        console.log('❌ La función aún usa NEW.total (incorrecto)');
      } else {
        console.log('⚠️ No se encontró referencia a NEW.total o NEW.total_venta');
      }
    } else {
      console.log('❌ Función fn_acumular_puntos_venta no encontrada');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkFunction();
