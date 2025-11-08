import { api } from "./apiClient";
import { UsuarioDataType } from "../types";

interface AddUsuarioParams {
  email: string;
  password: string;
  role: string; // Cambiado de "admin" | "user" a string para aceptar cualquier rol
  perfil: Omit<UsuarioDataType, "id_perfil" | "fecha_registro" | "auth_id">;
}

export const addUsuario = async ({
  email,
  password,
  role,
  perfil
}: AddUsuarioParams) => {
  try {
    // Crear el usuario usando el endpoint del backend
    const usuarioData = {
      email,
      password,
      nombre: `${perfil.primer_nombre} ${perfil.segundo_nombre || ''}`.trim(),
      username: perfil.username || email.split('@')[0], // Usar parte del email si no hay username
      telefono: perfil.telefono,
      direccion: perfil.direccion,
      fecha_nacimiento: perfil.fecha_nacimiento,
      avatar_url: perfil.avatar_url,
      primer_nombre: perfil.primer_nombre,
      segundo_nombre: perfil.segundo_nombre,
      primer_apellido: perfil.primer_apellido,
      segundo_apellido: perfil.segundo_apellido,
      rol: role, // Usar el nombre del rol directamente
    };

    const response = await api.post('/usuarios', usuarioData);

    return response.data.data;
  } catch (error: unknown) {
    console.error('Error al crear usuario:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    throw new Error(errorMessage);
  }
};
