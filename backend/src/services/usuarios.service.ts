import { supabase } from '../config/database';

// ================================================================
// 👥 SERVICIO DE USUARIOS (PERFILES)
// ================================================================

export interface PerfilUsuario {
  id_perfil: number;
  nombre: string;
  email: string;
  username: string;
  telefono?: string;
  direccion?: string;
  fecha_nacimiento?: string;
  avatar_url?: string;
  estado: 'activo' | 'inactivo' | 'suspendido' | 'eliminado';
  fecha_registro: Date;
  ultimo_acceso?: Date;
  primer_nombre?: string;
  segundo_nombre?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
}

export interface PerfilConRoles extends PerfilUsuario {
  roles: string; // String concatenado de roles
  nivel_permisos: number;
  ventas_stats?: UsuarioVentasStats;
}

interface UsuarioVentasStats {
  totalVentas: number;
  totalProductos: number;
  totalIngresos: number;
}

export interface CreateUsuarioDTO {
  nombre: string;
  email: string;
  username: string;
  password: string;
  rol: string;
  telefono?: string;
  direccion?: string;
  fecha_nacimiento?: string;
  avatar_url?: string;
  primer_nombre?: string;
  segundo_nombre?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
}

export interface UpdateUsuarioDTO {
  nombre?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  fecha_nacimiento?: string;
  primer_nombre?: string;
  segundo_nombre?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
  estado?: 'activo' | 'inactivo' | 'suspendido' | 'eliminado';
  password?: string; // contraseña en texto plano; será hasheada por el servicio
  username?: string;
}

export interface Rol {
  id_rol: number;
  nombre_rol: string;
  descripcion?: string;
  nivel_permisos: number;
  permisos?: string;
  activo: boolean;
  fecha_creacion: string;
}

export interface RolesResponse {
  data: Rol[];
  total: number;
}

export interface CreateRolDTO {
  nombre_rol: string;
  descripcion?: string;
  nivel_permisos: number;
  permisos?: Record<string, unknown>;
}

export interface UpdateRolDTO {
  nombre_rol?: string;
  descripcion?: string;
  nivel_permisos?: number;
  permisos?: Record<string, unknown>;
  activo?: boolean;
}

export class UsuariosService {
  /**
   * Obtener todos los usuarios con paginación y filtros
   */
  async getUsuarios(
    page: number = 1,
    pageSize: number = 10,
    filters?: {
      estado?: string;
      searchValue?: string;
      telefono?: string;
      fecha_inicio?: string;
      fecha_fin?: string;
    }
  ): Promise<{ data: PerfilConRoles[]; count: number }> {
    const offset = (page - 1) * pageSize;

    // Construir query base con join a rol_usuario
    let query = supabase
      .from('perfil_usuario')
      .select(`
        *,
        rol_usuario!inner(id_rol, nombre_rol, nivel_permisos)
      `, { count: 'exact' })
      .order('fecha_registro', { ascending: false });

    // Aplicar filtros
    if (filters?.estado) {
      query = query.eq('estado', filters.estado);
    }

    if (filters?.telefono) {
      query = query.ilike('telefono', `%${filters.telefono}%`);
    }

    if (filters?.fecha_inicio && filters?.fecha_fin) {
      query = query
        .gte('fecha_nacimiento', filters.fecha_inicio)
        .lte('fecha_nacimiento', filters.fecha_fin);
    }

    if (filters?.searchValue && filters.searchValue.trim().length > 0) {
      query = query.or(
        `primer_nombre.ilike.%${filters.searchValue}%,primer_apellido.ilike.%${filters.searchValue}%,username.ilike.%${filters.searchValue}%,email.ilike.%${filters.searchValue}%`
      );
    }

    // Obtener perfiles paginados
    const { data: perfiles, error: perfilesError, count } = await query.range(offset, offset + pageSize - 1);

    if (perfilesError) throw new Error(`Error al obtener usuarios: ${perfilesError.message}`);

    if (!perfiles || perfiles.length === 0) {
      return { data: [], count: 0 };
    }

    // Combinar perfiles con roles
    const perfilesConRoles = perfiles.map((perfil) => {
      const rolUsuario = (perfil as Record<string, unknown>).rol_usuario as Record<string, unknown>;
      return {
        ...perfil,
        roles: rolUsuario?.nombre_rol as string || 'Sin rol',
        nivel_permisos: rolUsuario?.nivel_permisos as number || 0,
      };
    }) as PerfilConRoles[];

    return {
      data: perfilesConRoles,
      count: count || 0,
    };
  }

  /**
   * Obtener usuario por ID
   */
  async getUsuarioById(id: string): Promise<PerfilConRoles | null> {
    // Obtener perfil con rol
    const { data: perfil, error } = await supabase
      .from('perfil_usuario')
      .select(`
        *,
        rol_usuario!inner(nombre_rol, nivel_permisos)
      `)
      .eq('id_perfil', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Error al obtener usuario: ${error.message}`);
    }

    if (!perfil) return null;

    const rolUsuario = (perfil as Record<string, unknown>).rol_usuario as Record<string, unknown>;
    const roles = rolUsuario?.nombre_rol as string || 'Sin rol';
    const nivel_permisos = rolUsuario?.nivel_permisos as number || 0;

    const ventasStats: UsuarioVentasStats = {
      totalVentas: 0,
      totalProductos: 0,
      totalIngresos: 0,
    };

    try {
      const { data: ventasData, error: ventasError, count: ventasCount } = await supabase
        .from('venta')
        .select('id_venta, total_venta', { count: 'exact' })
        .eq('id_cajero', id)
        .eq('estado', 'confirmada');

      if (ventasError) {
        console.warn('Error obteniendo ventas del usuario:', ventasError.message);
      } else if (Array.isArray(ventasData) && ventasData.length > 0) {
        ventasStats.totalVentas = typeof ventasCount === 'number' ? ventasCount : ventasData.length;
        ventasStats.totalIngresos = ventasData.reduce((acc, venta) => {
          const monto = typeof venta.total_venta === 'number' ? venta.total_venta : Number(venta.total_venta);
          return acc + (Number.isFinite(monto) ? monto : 0);
        }, 0);

        const ventaIds = ventasData
          .map((venta) => (typeof venta.id_venta === 'number' ? venta.id_venta : Number(venta.id_venta)))
          .filter((idVenta): idVenta is number => Number.isFinite(idVenta));

        if (ventaIds.length > 0) {
          const { data: detallesData, error: detallesError } = await supabase
            .from('detalle_venta')
            .select('cantidad')
            .in('id_venta', ventaIds);

          if (detallesError) {
            console.warn('Error obteniendo detalle_venta del usuario:', detallesError.message);
          } else if (Array.isArray(detallesData) && detallesData.length > 0) {
            ventasStats.totalProductos = detallesData.reduce((acc, detalle) => {
              const cantidad = typeof detalle.cantidad === 'number' ? detalle.cantidad : Number(detalle.cantidad);
              return acc + (Number.isFinite(cantidad) ? cantidad : 0);
            }, 0);
          }
        }
      }
    } catch (statsError) {
      console.warn('Error calculando estadísticas de ventas para el usuario:', statsError);
    }

    return {
      ...perfil,
      roles,
      nivel_permisos,
      ventas_stats: ventasStats,
    } as PerfilConRoles;
  }

  /**
   * Crear nuevo usuario
   */
  async createUsuario(dto: CreateUsuarioDTO): Promise<PerfilConRoles> {
    const { logger } = await import('../utils/logger');

    logger.info(`[CREATE USUARIO SERVICE] Creando usuario: ${dto.email}`);

    // Validar que el email no exista
    const { data: existingUser, error: checkError } = await supabase
      .from('perfil_usuario')
      .select('id_perfil')
      .eq('email', dto.email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      logger.error(`[CREATE USUARIO SERVICE] Error al verificar email existente: ${checkError.message}`);
      throw new Error(`Error al verificar email: ${checkError.message}`);
    }

    if (existingUser) {
      logger.error(`[CREATE USUARIO SERVICE] Email ya existe: ${dto.email}`);
      throw new Error('Ya existe un usuario con este email');
    }

    // Validar que el username no exista
    const { data: existingUsername, error: usernameCheckError } = await supabase
      .from('perfil_usuario')
      .select('id_perfil')
      .eq('username', dto.username)
      .single();

    if (usernameCheckError && usernameCheckError.code !== 'PGRST116') {
      logger.error(`[CREATE USUARIO SERVICE] Error al verificar username existente: ${usernameCheckError.message}`);
      throw new Error(`Error al verificar username: ${usernameCheckError.message}`);
    }

    if (existingUsername) {
      logger.error(`[CREATE USUARIO SERVICE] Username ya existe: ${dto.username}`);
      throw new Error('Ya existe un usuario con este username');
    }

    // Obtener rol especificado
    const rolNombre = dto.rol.toLowerCase(); // Convertir a minúsculas para coincidir con BD
    const { data: rolData, error: rolError } = await supabase
      .from('rol_usuario')
      .select('id_rol')
      .eq('nombre_rol', rolNombre)
      .eq('activo', true)
      .single();

    if (rolError || !rolData) {
      logger.error(`[CREATE USUARIO SERVICE] Error al obtener rol '${rolNombre}': ${rolError?.message}`);
      throw new Error(`Error al obtener rol: ${rolNombre}`);
    }

    // Generar hash de contraseña
    const bcrypt = await import('bcrypt');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    // Crear usuario
    const { data: newUser, error: createError } = await supabase
      .from('perfil_usuario')
      .insert({
        email: dto.email,
        password_hash: passwordHash,
        primer_nombre: dto.primer_nombre,
        segundo_nombre: dto.segundo_nombre,
        primer_apellido: dto.primer_apellido,
        segundo_apellido: dto.segundo_apellido,
        telefono: dto.telefono,
        direccion: dto.direccion,
        fecha_nacimiento: dto.fecha_nacimiento,
        avatar_url: dto.avatar_url,
        username: dto.username,
        id_rol: rolData.id_rol,
        estado: 'activo'
      })
      .select(`
        *,
        rol_usuario!inner(nombre_rol, nivel_permisos)
      `)
      .single();

    if (createError) {
      logger.error(`[CREATE USUARIO SERVICE] Error al crear usuario: ${createError.message}`);
      throw new Error(`Error al crear usuario: ${createError.message}`);
    }

    const rolUsuario = (newUser as Record<string, unknown>).rol_usuario as Record<string, unknown>;
    const roles = rolUsuario?.nombre_rol as string || 'Sin rol';
    const nivel_permiso = rolUsuario?.nivel_permisos as number || 0;

    logger.info(`[CREATE USUARIO SERVICE] Usuario creado exitosamente: ${newUser.email}`);

    return {
      ...newUser,
      roles,
      nivel_permiso,
    } as PerfilConRoles;
  }

  /**
   * Actualizar usuario
   */
  async updateUsuario(id: string, dto: UpdateUsuarioDTO): Promise<PerfilUsuario> {
    const { logger } = await import('../utils/logger');

    // Filtrar campos que puedan causar problemas con triggers
    const safeDto: Record<string, unknown> = { ...dto };
    delete safeDto.active_token;
    delete safeDto.session_token;
    delete safeDto.token;

    // Validar que el username no exista (si se está cambiando)
    if (typeof safeDto.username === 'string' && safeDto.username.trim()) {
      const { data: existingUsername, error: usernameCheckError } = await supabase
        .from('perfil_usuario')
        .select('id_perfil')
        .eq('username', safeDto.username.trim())
        .neq('id_perfil', id) // Excluir el propio usuario
        .single();

      if (usernameCheckError && usernameCheckError.code !== 'PGRST116') {
        logger.error(`[UPDATE USUARIO SERVICE] Error al verificar username existente: ${usernameCheckError.message}`);
        throw new Error(`Error al verificar username: ${usernameCheckError.message}`);
      }

      if (existingUsername) {
        logger.error(`[UPDATE USUARIO SERVICE] Username ya existe: ${safeDto.username}`);
        throw new Error('Ya existe un usuario con este username');
      }
    }

    // Validar que el email no exista (si se está cambiando)
    if (typeof safeDto.email === 'string' && safeDto.email.trim()) {
      const { data: existingEmail, error: emailCheckError } = await supabase
        .from('perfil_usuario')
        .select('id_perfil')
        .eq('email', safeDto.email.trim())
        .neq('id_perfil', id) // Excluir el propio usuario
        .single();

      if (emailCheckError && emailCheckError.code !== 'PGRST116') {
        logger.error(`[UPDATE USUARIO SERVICE] Error al verificar email existente: ${emailCheckError.message}`);
        throw new Error(`Error al verificar email: ${emailCheckError.message}`);
      }

      if (existingEmail) {
        logger.error(`[UPDATE USUARIO SERVICE] Email ya existe: ${safeDto.email}`);
        throw new Error('Ya existe un usuario con este correo electrónico');
      }
    }

    // Si se provee 'password' en el DTO, generar hash y actualizar la columna password_hash.
    // Nota: Este paso requiere que el usuario esté autorizado para cambiar la contraseña;
    // la verificación de permisos debe realizarse en el controlador antes de llamar al servicio.
    if (typeof safeDto.password === 'string' && safeDto.password.trim().length > 0) {
      try {
        const bcrypt = await import('bcrypt');
        const saltRounds = 12;
        const hashed = await bcrypt.hash(String(safeDto.password), saltRounds);
        // Asignar al campo que existe en la BD
        safeDto['password_hash'] = hashed;
        // Eliminar el campo password en texto plano para no intentar insertar columna inexistente
        delete safeDto.password;
      } catch (err) {
        console.error('Error al hashear la contraseña:', err);
        throw err;
      }
    }

    // Intentar update directo primero
    try {
      const { data, error } = await supabase
        .from('perfil_usuario')
        .update(safeDto)
        .eq('id_perfil', id)
        .select()
        .single();

      if (error) {
        // Si el error es específico de unique_active_token, intentar una solución alternativa
        if (error.message.includes('unique_active_token')) {
          console.warn('Error de unique_active_token detectado, intentando solución alternativa');

          // Obtener el registro actual para comparar qué campos realmente cambiaron
          const { data: currentData, error: selectError } = await supabase
            .from('perfil_usuario')
            .select('*')
            .eq('id_perfil', id)
            .single();

          if (selectError) {
            throw new Error(`Error al obtener usuario actual: ${selectError.message}`);
          }

          // Crear objeto solo con campos que realmente cambiaron
          const changedFields: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(safeDto)) {
            if (currentData[key] !== value) {
              changedFields[key] = value;
            }
          }

          console.log('Campos que cambiaron:', changedFields);

          // Si no hay cambios, devolver los datos actuales
          if (Object.keys(changedFields).length === 0) {
            console.log('No hay cambios que aplicar');
            return currentData;
          }

          // Intentar actualizar solo los campos que cambiaron
          const { data: updatedData, error: updateError } = await supabase
            .from('perfil_usuario')
            .update(changedFields)
            .eq('id_perfil', id)
            .select()
            .single();

          if (updateError) {
            console.error('Error en actualización selectiva:', updateError);
            // Si aún falla, intentar campo por campo como último recurso
            console.warn('Intentando actualización campo por campo...');
            let finalData = { ...currentData };

            for (const [key, value] of Object.entries(changedFields)) {
              try {
                const { data: fieldData, error: fieldError } = await supabase
                  .from('perfil_usuario')
                  .update({ [key]: value })
                  .eq('id_perfil', id)
                  .select()
                  .single();

                if (fieldError) {
                  console.error(`Error actualizando campo ${key}:`, fieldError);
                } else if (fieldData) {
                  finalData = { ...finalData, ...fieldData };
                }
              } catch (fieldErr) {
                console.error(`Error en campo ${key}:`, fieldErr);
              }
            }

            return finalData;
          }

          return updatedData;
        }

        throw new Error(`Error al actualizar usuario: ${error.message}`);
      }

      return data;
    } catch (err) {
      console.error('Error en updateUsuario:', err);
      throw err;
    }
  }

  /**
   * Cambiar estado de usuario
   */
  async cambiarEstado(id: string, estado: 'activo' | 'inactivo' | 'suspendido' | 'eliminado'): Promise<PerfilUsuario> {
    return this.updateUsuario(id, { estado });
  }

  /**
   * Eliminar usuario (soft delete primero, hard delete después)
   */
  async deleteUsuario(id: string): Promise<void> {
    // Obtener el usuario actual para verificar su estado
    const usuario = await this.getUsuarioById(id);
    if (!usuario) {
      throw new Error('Usuario no encontrado');
    }

    if (usuario.estado === 'activo') {
      // Si está activo, hacer soft delete (cambiar a inactivo)
      await this.cambiarEstado(id, 'inactivo');
    } else if (usuario.estado === 'inactivo' || usuario.estado === 'eliminado') {
      // Si ya está inactivo o eliminado, eliminar completamente
      const { error } = await supabase
        .from('perfil_usuario')
        .delete()
        .eq('id_perfil', id);

      if (error) {
        throw new Error(`Error al eliminar usuario: ${error.message}`);
      }
    } else {
      throw new Error(`No se puede eliminar usuario con estado: ${usuario.estado}`);
    }
  }

  /**
   * Obtener roles de un usuario
   */
  async getRolesByUsuario(idUsuario: string): Promise<unknown[]> {
    const { data, error } = await supabase
      .from('perfil_usuario')
      .select(
        `
        id_rol,
        rol_usuario!inner(
          id_rol,
          nombre_rol,
          nivel_permisos
        )
      `
      )
      .eq('id_perfil', idUsuario);

    if (error) throw new Error(`Error al obtener roles: ${error.message}`);
    return data || [];
  }

  /**
   * Asignar rol a usuario
   */
  async asignarRol(idUsuario: string, idRol: number): Promise<void> {
    const { error } = await supabase
      .from('perfil_usuario')
      .update({ id_rol: idRol })
      .eq('id_perfil', idUsuario);

    if (error) throw new Error(`Error al asignar rol: ${error.message}`);
  }

  /**
   * Remover rol de usuario (asignar rol por defecto: cliente)
   */
  async removerRol(idUsuario: number): Promise<void> {
    // Obtener el ID del rol "cliente" (rol por defecto)
    const { data: rolCliente, error: rolError } = await supabase
      .from('rol_usuario')
      .select('id_rol')
      .eq('nombre_rol', 'cliente')
      .eq('activo', true)
      .single();

    if (rolError || !rolCliente) {
      throw new Error('No se pudo encontrar el rol por defecto (cliente)');
    }

    // Asignar rol por defecto al usuario
    const { error } = await supabase
      .from('perfil_usuario')
      .update({ id_rol: rolCliente.id_rol })
      .eq('id_perfil', idUsuario);

    if (error) {
      throw new Error(`Error al remover rol del usuario: ${error.message}`);
    }
  }

  /**
   * Obtener todos los roles disponibles
   */
  async getRoles(page?: number, pageSize?: number, filters?: { estado?: string; searchValue?: string }): Promise<RolesResponse> {
    let query = supabase
      .from('rol_usuario')
      .select('id_rol, nombre_rol, descripcion, nivel_permisos, permisos, activo, fecha_creacion', { count: 'exact' });

    // Aplicar filtros
    if (filters?.estado && filters.estado !== 'todos') {
      query = query.eq('activo', filters.estado === 'activo');
    }

    if (filters?.searchValue) {
      query = query.ilike('nombre_rol', `%${filters.searchValue}%`);
    }

    // Ordenar
    query = query.order('nivel_permisos', { ascending: false });

    // Paginación
    if (page && pageSize) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) throw new Error(`Error al obtener roles: ${error.message}`);
    return { data: data || [], total: count || 0 };
  }

  /**
   * Obtener estadísticas de usuarios
   */
  async getEstadisticas(): Promise<{
    total: number;
    activos: number;
    inactivos: number;
    nuevosEsteMes: number;
  }> {
    // Total de usuarios
    const { count: total } = await supabase
      .from('perfil_usuario')
      .select('*', { count: 'exact', head: true });

    // Usuarios activos
    const { count: activos } = await supabase
      .from('perfil_usuario')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'activo');

    // Usuarios inactivos
    const { count: inactivos } = await supabase
      .from('perfil_usuario')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'inactivo');

    // Nuevos este mes
    const primerDiaMes = new Date();
    primerDiaMes.setDate(1);
    primerDiaMes.setHours(0, 0, 0, 0);

    const { count: nuevosEsteMes } = await supabase
      .from('perfil_usuario')
      .select('*', { count: 'exact', head: true })
      .gte('fecha_registro', primerDiaMes.toISOString());

    return {
      total: total || 0,
      activos: activos || 0,
      inactivos: inactivos || 0,
      nuevosEsteMes: nuevosEsteMes || 0,
    };
  }

  /**
   * Eliminar rol (desactivar)
   */
  async deleteRol(idRol: number): Promise<{ yaInactivo: boolean; eliminadoCompletamente: boolean }> {
    const { logger } = await import('../utils/logger');

    logger.info(`[DELETE ROL SERVICE] Iniciando eliminación de rol ID: ${idRol}`);

    // Validar que no se eliminen roles predefinidos críticos
    const rolesProtegidos = ['cliente', 'cajero', 'administrador', 'propietario'];

    // Primero obtener el rol para verificar si es protegido
    const { data: rol, error: fetchError } = await supabase
      .from('rol_usuario')
      .select('nombre_rol, activo')
      .eq('id_rol', idRol)
      .single();

    if (fetchError) {
      logger.error(`[DELETE ROL SERVICE] Error al obtener rol: ${fetchError.message}`);
      throw new Error(`Error al obtener rol: ${fetchError.message}`);
    }

    if (!rol) {
      logger.error(`[DELETE ROL SERVICE] Rol no encontrado con ID: ${idRol}`);
      throw new Error('Rol no encontrado');
    }

    logger.info(`[DELETE ROL SERVICE] Rol encontrado: ${rol.nombre_rol}, activo: ${rol.activo}`);

    // Si el rol ya está inactivo, eliminarlo completamente
    if (!rol.activo) {
      logger.info(`[DELETE ROL SERVICE] Rol ya está inactivo, eliminando completamente`);

      // Verificar si hay usuarios con este rol (aunque esté inactivo)
      const { data: usuarios, error: usuariosError } = await supabase
        .from('perfil_usuario')
        .select('id_perfil')
        .eq('id_rol', idRol)
        .limit(1);

      if (usuariosError) {
        logger.error(`[DELETE ROL SERVICE] Error al verificar usuarios: ${usuariosError.message}`);
        throw new Error(`Error al verificar usuarios con este rol: ${usuariosError.message}`);
      }

      if (usuarios && usuarios.length > 0) {
        logger.error(`[DELETE ROL SERVICE] No se puede eliminar completamente el rol, tiene usuarios asignados`);
        throw new Error('No se puede eliminar completamente el rol porque aún tiene usuarios asignados. Primero reasigna los usuarios a otro rol.');
      }

      // Eliminar completamente el rol
      const { error: deleteError } = await supabase
        .from('rol_usuario')
        .delete()
        .eq('id_rol', idRol);

      if (deleteError) {
        logger.error(`[DELETE ROL SERVICE] Error al eliminar completamente rol: ${deleteError.message}`);
        throw new Error(`Error al eliminar completamente rol: ${deleteError.message}`);
      }

      logger.info(`[DELETE ROL SERVICE] Rol eliminado completamente de la base de datos`);
      return { yaInactivo: true, eliminadoCompletamente: true };
    }

    // Verificar si es un rol protegido
    if (rolesProtegidos.includes(rol.nombre_rol.toLowerCase())) {
      logger.error(`[DELETE ROL SERVICE] Intento de eliminar rol protegido: ${rol.nombre_rol}`);
      throw new Error(`No se puede eliminar el rol "${rol.nombre_rol}" porque es un rol del sistema protegido`);
    }

    // Verificar si hay usuarios con este rol
    const { data: usuarios, error: usuariosError } = await supabase
      .from('perfil_usuario')
      .select('id_perfil')
      .eq('id_rol', idRol)
      .limit(1);

    if (usuariosError) {
      logger.error(`[DELETE ROL SERVICE] Error al verificar usuarios: ${usuariosError.message}`);
      throw new Error(`Error al verificar usuarios con este rol: ${usuariosError.message}`);
    }

    if (usuarios && usuarios.length > 0) {
      logger.error(`[DELETE ROL SERVICE] Rol tiene usuarios asignados, no se puede eliminar`);
      throw new Error('No se puede eliminar el rol porque hay usuarios asignados a él. Primero reasigna los usuarios a otro rol.');
    }

    logger.info(`[DELETE ROL SERVICE] Ejecutando actualización para desactivar rol`);

    // Desactivar el rol
    const { error, data } = await supabase
      .from('rol_usuario')
      .update({ activo: false })
      .eq('id_rol', idRol)
      .select();

    if (error) {
      logger.error(`[DELETE ROL SERVICE] Error al actualizar rol: ${error.message}`);
      throw new Error(`Error al eliminar rol: ${error.message}`);
    }

    logger.info(`[DELETE ROL SERVICE] Rol actualizado exitosamente. Filas afectadas: ${data?.length || 0}`);
    return { yaInactivo: false, eliminadoCompletamente: false };
  }

  /**
   * Obtener rol por ID (para debugging)
   */
  async getRolById(idRol: number) {
    const { logger } = await import('../utils/logger');

    const { data, error } = await supabase
      .from('rol_usuario')
      .select('*')
      .eq('id_rol', idRol)
      .single();

    if (error) {
      logger.error(`[GET ROL BY ID SERVICE] Error al obtener rol: ${error.message}`);
      throw new Error(`Error al obtener rol: ${error.message}`);
    }

    return data;
  }

  /**
   * Obtener usuarios por rol
   */
  async getUsuariosByRol(idRol: number): Promise<PerfilUsuario[]> {
    const { data, error } = await supabase
      .from('perfil_usuario')
      .select('*')
      .eq('id_rol', idRol);

    if (error) {
      throw new Error(`Error al obtener usuarios del rol: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Crear un nuevo rol
   */
  async createRol(rolData: CreateRolDTO): Promise<Rol> {
    const { data, error } = await supabase
      .from('rol_usuario')
      .insert({
        nombre_rol: rolData.nombre_rol,
        descripcion: rolData.descripcion,
        nivel_permisos: rolData.nivel_permisos,
        permisos: rolData.permisos ? JSON.stringify(rolData.permisos) : '{}',
        activo: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Error al crear rol: ${error.message}`);
    }

    return data;
  }

  /**
   * Actualizar un rol
   */
  async updateRol(idRol: number, rolData: UpdateRolDTO): Promise<Rol> {
    const updateData: Partial<Rol> = {};

    if (rolData.nombre_rol !== undefined) updateData.nombre_rol = rolData.nombre_rol;
    if (rolData.descripcion !== undefined) updateData.descripcion = rolData.descripcion;
    if (rolData.nivel_permisos !== undefined) updateData.nivel_permisos = rolData.nivel_permisos;
    if (rolData.permisos !== undefined) updateData.permisos = JSON.stringify(rolData.permisos);
    if (rolData.activo !== undefined) updateData.activo = rolData.activo;

    const { data, error } = await supabase
      .from('rol_usuario')
      .update(updateData)
      .eq('id_rol', idRol)
      .select()
      .single();

    if (error) {
      throw new Error(`Error al actualizar rol: ${error.message}`);
    }

    return data;
  }

  /**
   * Verificar si un email ya existe
   */
  async checkEmailExists(email: string, excludeId?: number): Promise<boolean> {
    const { logger } = await import('../utils/logger');

    let query = supabase
      .from('perfil_usuario')
      .select('id_perfil')
      .eq('email', email);

    if (excludeId) {
      query = query.neq('id_perfil', excludeId);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      logger.error(`[CHECK EMAIL SERVICE] Error al verificar email: ${error.message}`);
      throw new Error(`Error al verificar email: ${error.message}`);
    }

    return !!data;
  }

  /**
   * Verificar si un username ya existe
   */
  async checkUsernameExists(username: string, excludeId?: number): Promise<boolean> {
    const { logger } = await import('../utils/logger');

    let query = supabase
      .from('perfil_usuario')
      .select('id_perfil')
      .eq('username', username);

    if (excludeId) {
      query = query.neq('id_perfil', excludeId);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') {
      logger.error(`[CHECK USERNAME SERVICE] Error al verificar username: ${error.message}`);
      throw new Error(`Error al verificar username: ${error.message}`);
    }

    return !!data;
  }
}
