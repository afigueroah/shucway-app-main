import api from './apiClient';

export const getRoles = async () => {
  const resp = await api.get('/dashboard/table-data/rol_usuario?limit=1000');
  if (!resp || resp.status >= 400) throw new Error('Error al obtener roles');
  const js = resp.data || {};
  const rows = (js.data || []) as Array<{ id_rol?: number; nombre?: string }>;
  return rows.map((r) => ({ id_rol: r.id_rol, nombre: r.nombre }));
};
