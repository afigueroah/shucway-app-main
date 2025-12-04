-- Migración: Agregar función get_trigger_definitions
-- Fecha: 2025-12-03
-- Descripción: Agrega función para obtener definiciones completas de triggers

-- FUNCIÓN PARA OBTENER DEFINICIONES COMPLETAS DE TRIGGERS
CREATE OR REPLACE FUNCTION get_trigger_definitions()
RETURNS TABLE(trigger_name TEXT, definition TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.tgname::TEXT as trigger_name,
        pg_get_triggerdef(t.oid)::TEXT as definition
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
    AND t.tgenabled = 'O'
    AND t.tgisconstraint = false
    ORDER BY t.tgname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;