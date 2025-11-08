import { api } from "./apiClient";

export const deleteUsuario = async (usuarioId: string) => {
  const response = await api.delete(`/usuarios/${usuarioId}`);
  return response.data;
};
