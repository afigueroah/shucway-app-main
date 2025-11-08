import api from './apiClient';

export const getUsuario = async (id_perfil: string) => {
  try {
    const filters = encodeURIComponent(JSON.stringify({ id_perfil }));
    const resp = await api.get(`/dashboard/table-data/perfil_usuario?filters=${filters}`);
    if (!resp || resp.status >= 400) throw new Error('Error al obtener usuario');
    const js = resp.data || {};
    const rows = js.data || [];
    return rows.length ? rows[0] : null;
  } catch (err) {
    console.error('Error en getUsuario:', err);
    throw err;
  }
};
