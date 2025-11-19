import { supabase } from './src/config/database.js';

async function resetSequences() {
  console.log('Iniciando reset de secuencias...');

  try {
    // Try to reset sequence using raw SQL
    console.log('Intentando resetear secuencia con SQL...');

    // Use the postgres extension to execute raw SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      query: "SELECT setval('categoria_producto_id_categoria_seq', 8, false)"
    });

    if (error) {
      console.error('Error reseteando secuencia:', error);

      // Try to advance sequence by calling nextval multiple times
      console.log('Intentando avanzar secuencia manualmente...');

      // Since we can't reset directly, let's try to manually advance the sequence
      // by attempting inserts until we get past the conflict
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const tempName = `temp_advance_${Date.now()}_${attempts}`;
        const { error: tempError } = await supabase
          .from('categoria_producto')
          .insert({
            nombre_categoria: tempName,
            estado: 'desactivado'
          });

        if (tempError) {
          if (tempError.code === '23505') {
            console.log(`Conflicto en intento ${attempts + 1}, continuando...`);
            attempts++;
          } else {
            console.error('Error diferente:', tempError);
            break;
          }
        } else {
          console.log('Secuencia avanzada exitosamente');

          // Delete the temp record
          await supabase
            .from('categoria_producto')
            .delete()
            .eq('nombre_categoria', tempName);

          break;
        }
      }

      if (attempts >= maxAttempts) {
        console.log('No se pudo avanzar la secuencia automáticamente');
        console.log('Solución manual: Ejecutar en Supabase SQL Editor:');
        console.log('SELECT setval(\'categoria_producto_id_categoria_seq\', 8, false);');
      }
    } else {
      console.log('Secuencia reseteada exitosamente:', data);
    }

  } catch (error) {
    console.error('Error general:', error);
  }
}

resetSequences();