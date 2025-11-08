import React, { useState } from 'react';
import { supabase } from '../../../../api/supabaseClient';

const ConsultasSQL: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const executeQuery = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      // Nota: Supabase no permite queries SQL arbitrarias por seguridad, solo select en tablas públicas
      // Para queries complejas, usar rpc o ajustar permisos
      const { data, error } = await supabase.rpc('execute_sql', { sql: query });
      if (error) throw error;
      setResult(JSON.stringify(data, null, 2));
    } catch (error: unknown) {
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <header className="w-full max-w-6xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Consultas SQL</h1>
        <p className="text-sm text-gray-600 mt-1">Ejecuta consultas personalizadas en la base de datos</p>
      </header>

      <div className="w-full max-w-6xl mx-auto bg-white rounded-xl shadow p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Consulta SQL</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={10}
            className="w-full p-2 border border-gray-300 rounded-md font-mono"
            placeholder="Ingresa tu consulta SQL aquí..."
          />
        </div>

        <button
          onClick={executeQuery}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded-md disabled:opacity-50"
        >
          {loading ? 'Ejecutando...' : 'Ejecutar Consulta'}
        </button>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Resultado</label>
          <pre className="w-full p-2 border border-gray-300 rounded-md bg-gray-100 font-mono text-sm overflow-auto max-h-96">
            {result || 'El resultado aparecerá aquí...'}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ConsultasSQL;
