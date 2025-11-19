-- Migration: Create function fn_consultar_puntos

BEGIN;

DROP FUNCTION IF EXISTS fn_consultar_puntos(INTEGER);

CREATE OR REPLACE FUNCTION fn_consultar_puntos(p_id_cliente INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_puntos INTEGER := 0;
BEGIN
    SELECT COALESCE(puntos_acumulados, 0) INTO v_puntos
    FROM cliente
    WHERE id_cliente = p_id_cliente;

    RETURN v_puntos;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
