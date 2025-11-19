-- Crear función RPC para actualizar estado de transferencia
CREATE OR REPLACE FUNCTION update_estado_transferencia(p_id_venta INTEGER, p_estado VARCHAR(20))
RETURNS VOID AS $$
BEGIN
    UPDATE venta
    SET estado_transferencia = p_estado
    WHERE id_venta = p_id_venta
    AND tipo_pago = 'Transferencia';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venta con ID % no encontrada o no es una transferencia', p_id_venta;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;