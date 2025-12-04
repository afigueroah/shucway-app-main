import bcrypt from 'bcrypt';
import { jwt } from '../utils/jwt';                 // ⬅️ usa el wrapper
import { supabase } from '../config/database';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../middlewares/errorHandler.middleware';
import {
  LoginCredentials,
  LoginResponse,
  UsuarioConRol,
  AuthUser
} from '../types';

interface DatabaseUser {
  id_perfil: string;
  nombre: string;
  email: string;
  username: string;
  password_hash: string;
  estado: string;
  ultimo_acceso?: string;
}

const JWT_SECRET = config.jwt.secret;

export class AuthService {
  // Registrar nuevo usuario
  async register(userData: {
    email: string;
    password: string;
    primer_nombre: string;
    primer_apellido: string;
    segundo_nombre?: string;
    segundo_apellido?: string;
    telefono?: string;
    direccion?: string;
    username?: string;
  }): Promise<UsuarioConRol> {
    try {
      // Verificar si el correo ya existe
      const { data: existingUser } = await supabase
        .from('perfil_usuario')
        .select('id_perfil')
        .eq('email', userData.email)
        .single();

      if (existingUser) {
        throw new AppError('El correo electrónico ya está registrado', 400);
      }

      // Hashear contraseña
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Rol por defecto
      const { data: defaultRole } = await supabase
        .from('rol_usuario')
        .select('id_rol')
        .eq('nombre_rol', 'cliente')
        .single();

      if (!defaultRole) {
        throw new AppError('Rol por defecto no encontrado', 500);
      }

      // Crear usuario
      const { data: newUser, error } = await supabase
        .from('perfil_usuario')
        .insert({
          email: userData.email,
          password_hash: hashedPassword,
          primer_nombre: userData.primer_nombre,
          segundo_nombre: userData.segundo_nombre,
          primer_apellido: userData.primer_apellido,
          segundo_apellido: userData.segundo_apellido,
          telefono: userData.telefono,
          direccion: userData.direccion,
          username: userData.username,
          id_rol: defaultRole.id_rol,
          estado: 'activo'
        })
        .select()
        .single();

      if (error || !newUser) {
        logger.error('Error al crear usuario:', error);
        throw new AppError('Error al crear usuario', 500);
      }

      const userWithRol = await this.getUserWithRol(newUser.id_perfil);
      logger.info(`Usuario registrado: ${newUser.email}`);
      return userWithRol;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error en register:', error);
      throw new AppError('Error al registrar usuario', 500);
    }
  }

  // Login con JWT personalizado
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // Buscar por email o username
      let user: DatabaseUser | null = null;

      const { data: userByEmail } = await supabase
        .from('perfil_usuario')
        .select('*')
        .eq('email', credentials.identifier)
        .single();

      if (userByEmail) {
        user = userByEmail;
      } else {
        const { data: userByUsername } = await supabase
          .from('perfil_usuario')
          .select('*')
          .eq('username', credentials.identifier)
          .single();
        if (userByUsername) user = userByUsername;
      }

      if (!user) throw new AppError('Credenciales inválidas', 401);
      if (user.estado !== 'activo') throw new AppError('Usuario inactivo', 403);

      // Validar password
      const isPasswordValid = await bcrypt.compare(
        credentials.password,
        user.password_hash
      );
      if (!isPasswordValid) throw new AppError('Credenciales inválidas', 401);

      // Actualizar último acceso
      await supabase
        .from('perfil_usuario')
        .update({ ultimo_acceso: new Date().toISOString() })
        .eq('id_perfil', user.id_perfil);

      // Cargar rol
      const userWithRol = await this.getUserWithRol(user.id_perfil);

      // Tokens
      const token = this.generateToken(userWithRol);
      const refreshToken = this.generateRefreshToken(userWithRol);

      logger.info(`Login exitoso: ${user.email}`);

      return {
        user: userWithRol,
        token,
        refreshToken
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error en login:', error);
      throw new AppError('Error al iniciar sesión', 500);
    }
  }

  // Validar token JWT
  async validateToken(token: string): Promise<AuthUser> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;

      const { data: user, error } = await supabase
        .from('perfil_usuario')
        .select('estado')
        .eq('id_perfil', decoded.id_perfil)
        .single();

      if (error || !user || user.estado !== 'activo') {
        throw new AppError('Token inválido', 401);
      }

      return decoded;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error en validateToken:', error);
      throw new AppError('Token inválido', 401);
    }
  }

  // Refresh token
  async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as AuthUser;
      const userWithRol = await this.getUserWithRol(decoded.id_perfil);

      const newToken = this.generateToken(userWithRol);
      const newRefreshToken = this.generateRefreshToken(userWithRol);

      return { token: newToken, refreshToken: newRefreshToken };
    } catch (error) {
      logger.error('Error en refreshToken:', error);
      throw new AppError('Token inválido', 401);
    }
  }

  // Usuario con rol
  private async getUserWithRol(userId: string): Promise<UsuarioConRol> {
    const { data: user, error: userError } = await supabase
      .from('perfil_usuario')
      .select(`
        id_perfil,
        email,
        primer_nombre,
        segundo_nombre,
        primer_apellido,
        segundo_apellido,
        telefono,
        direccion,
        fecha_nacimiento,
        username,
        avatar_url,
        id_rol,
        estado,
        fecha_registro,
        ultimo_acceso,
        rol_usuario (
          id_rol,
          nombre_rol,
          descripcion,
          nivel_permisos,
          permisos,
          activo
        )
      `)
      .eq('id_perfil', userId)
      .single();

    if (userError || !user) throw new AppError('Usuario no encontrado', 404);

    const rol = Array.isArray(user.rol_usuario) ? user.rol_usuario[0] : user.rol_usuario;
    if (!rol) throw new AppError('Rol de usuario no encontrado', 404);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { rol_usuario, ...userData } = user;

    return {
      ...userData,
      rol
    } as UsuarioConRol;
  }

  // Generar token JWT
  private generateToken(user: UsuarioConRol): string {
    const payload = {
      id_perfil: user.id_perfil,
      email: user.email,
      username: user.username || user.email,
      nombre: `${user.primer_nombre} ${user.primer_apellido}`,
      role: {
        id_rol: user.rol.id_rol,
        nombre_rol: user.rol.nombre_rol,
        // El middleware solo exige nombre_rol; dejamos nivel por si lo usas
        nivel_permisos: user.rol.nivel_permisos
      }
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' }); // 1 día para testing
  }

  // Generar refresh token
  private generateRefreshToken(user: UsuarioConRol): string {
    const payload = {
      id_perfil: user.id_perfil,
      email: user.email,
      rol: user.rol.nombre_rol
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' }); // 30 días
  }
}

export const authService = new AuthService();
