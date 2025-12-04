// ================================================================
// 📦 TIPOS EXTENDIDOS DE EXPRESS
// ================================================================

import { Request } from 'express';

export interface AuthUser {
  id_perfil: string;
  nombre: string;
  email: string;
  username: string;
  role: {
    id_rol: number;
    nombre_rol: string;
    nivel_permisos: number;
  };
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  params: Record<string, string>;
}
