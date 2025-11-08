import { supabase } from './src/config/database.js';

async function resetSequences() {
  try {
    // Reset detalle_recepcion_mercaderia sequence
    const detalleResult = await supabase.from('detalle_recepcion_mercaderia').select('id_detalle', { count: 'exact' });
    const detalleCount = detalleResult.count || 0;

    const { data: detalleData, error: detalleError } = await supabase.rpc('setval', {
      sequence_name: 'detalle_recepcion_mercaderia_id_detalle_seq',
      value: detalleCount + 1,
      is_called: false
    });

    if (detalleError) throw detalleError;
    console.log('Secuencia detalle_recepcion_mercaderia reseteada:', detalleData);

    // Also reset lote_insumo sequence if needed
    const loteResult = await supabase.from('lote_insumo').select('id_lote', { count: 'exact' });
    const loteCount = loteResult.count || 0;

    const { data: loteData, error: loteError } = await supabase.rpc('setval', {
      sequence_name: 'lote_insumo_id_lote_seq',
      value: loteCount + 1,
      is_called: false
    });

    if (loteError) throw loteError;
    console.log('Secuencia lote_insumo reseteada:', loteData);

  } catch (error) {
    console.error('Error:', error);
  }
}

resetSequences();