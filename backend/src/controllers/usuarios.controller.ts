import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express.types';
import { UsuariosService } from '../services/usuarios.service';

interface UsuarioRol {
  id_rol: number;
  rol_usuario: {
    id_rol: number;
    nombre_rol: string;
    nivel_permisos: number;
  };
}

// ================================================================
// 👥 CONTROLADOR DE USUARIOS
// ================================================================

export class UsuariosController {
  async getUsuarios(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 10;

      const filters = {
        estado: req.query.estado as string | undefined,
        searchValue: req.query.searchValue as string | undefined,
        telefono: req.query.telefono as string | undefined,
        fecha_inicio: req.query.fecha_inicio as string | undefined,
        fecha_fin: req.query.fecha_fin as string | undefined,
      };

      const result = await new UsuariosService().getUsuarios(page, pageSize, filters);

      res.json({
        success: true,
        data: result.data,
        count: result.count,
        page,
        pageSize,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUsuarioById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const usuario = await new UsuariosService().getUsuarioById(id);

      if (!usuario) {
        res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
        });
        return;
      }

      res.json({
        success: true,
        data: usuario,
      });
    } catch (error) {
      next(error);
    }
  }

  async createUsuario(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { logger } = await import('../utils/logger');

      logger.info(`[CREATE USUARIO] Creando nuevo usuario`);
      logger.info(`[CREATE USUARIO] Usuario solicitante: ${req.user?.email} (Rol: ${req.user?.role?.nombre_rol}, Nivel: ${req.user?.role?.nivel_permisos})`);

      const usuarioData = req.body;
      const nuevoUsuario = await new UsuariosService().createUsuario(usuarioData);

      logger.info(`[CREATE USUARIO] Usuario creado exitosamente: ${nuevoUsuario.email}`);

      res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente',
        data: nuevoUsuario,
      });
    } catch (error) {
      const { logger } = await import('../utils/logger');
      logger.error(`[CREATE USUARIO] Error:`, error);
      next(error);
    }
  }

  async updateUsuario(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      // Filtrar cualquier campo relacionado con token
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { token, active_token, session_token, ...dto } = req.body;
      console.log('Payload de actualización:', dto);

      // Validaciones de permisos adicionales
      const isCurrentUser = req.user && req.user.id_perfil === id;
      const userRole = req.user?.role?.nombre_rol?.toLowerCase();

      // Un administrador no puede modificar usuarios con rol propietario
      if (!isCurrentUser && userRole === 'administrador') {
        // Verificar si el usuario que se está editando tiene rol propietario
        const { UsuariosService } = await import('../services/usuarios.service');
        const userRoles = await new UsuariosService().getRolesByUsuario(id);
        const hasPropietarioRole = (userRoles as UsuarioRol[]).some((ur: UsuarioRol) =>
          ur.rol_usuario?.nombre_rol?.toLowerCase() === 'propietario'
        );

        if (hasPropietarioRole) {
          res.status(403).json({
            success: false,
            message: 'No tienes permisos para modificar usuarios con rol propietario'
          });
          return;
        }
      }

      // Si se intenta cambiar la contraseña, validar permisos: puede hacerlo
      // el propio usuario o un administrador/propietario.
      if (dto && typeof dto.password === 'string') {
        const allowedRoles = ['administrador', 'propietario'];
        const isSelf = req.user && req.user.id_perfil === id;
        const isAllowedRole = req.user && allowedRoles.includes(req.user.role.nombre_rol.toLowerCase());

        if (!isSelf && !isAllowedRole) {
          res.status(403).json({
            success: false,
            message: 'No tienes permisos para cambiar la contraseña de este usuario'
          });
          return;
        }
      }

      const usuario = await new UsuariosService().updateUsuario(id, dto);

      res.json({
        success: true,
        data: usuario,
        message: 'Usuario actualizado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async cambiarEstado(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const { estado } = req.body;

      if (!['activo', 'inactivo', 'suspendido', 'eliminado'].includes(estado)) {
        res.status(400).json({
          success: false,
          message: 'Estado inválido',
        });
        return;
      }

      const usuario = await new UsuariosService().cambiarEstado(id, estado);

      res.json({
        success: true,
        data: usuario,
        message: `Usuario ${estado} exitosamente`,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteRol(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { logger } = await import('../utils/logger');

      logger.info(`[DELETE ROL] Intentando eliminar rol con ID: ${req.params.id}`);
      logger.info(`[DELETE ROL] Usuario: ${req.user?.email} (Rol: ${req.user?.role?.nombre_rol}, Nivel: ${req.user?.role?.nivel_permisos})`);

      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        logger.error(`[DELETE ROL] ID inválido: ${req.params.id}`);
        res.status(400).json({
          success: false,
          message: 'ID de rol inválido',
        });
        return;
      }

      logger.info(`[DELETE ROL] ID parseado correctamente: ${id}`);

      const result = await new UsuariosService().deleteRol(id);

      if (result.eliminadoCompletamente) {
        logger.info(`[DELETE ROL] Rol eliminado completamente de la BD: ${id}`);
        res.json({
          success: true,
          message: 'Rol eliminado completamente del sistema',
        });
      } else if (result.yaInactivo) {
        logger.info(`[DELETE ROL] Rol ya estaba inactivo: ${id}`);
        res.json({
          success: true,
          message: 'El rol ya estaba inactivo',
        });
      } else {
        logger.info(`[DELETE ROL] Rol desactivado exitosamente: ${id}`);
        res.json({
          success: true,
          message: 'Rol eliminado correctamente',
        });
      }
    } catch (error) {
      const { logger } = await import('../utils/logger');
      logger.error(`[DELETE ROL] Error:`, error);
      next(error);
    }
  }

  async getRolById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id);
      const rol = await new UsuariosService().getRolById(id);

      if (!rol) {
        res.status(404).json({
          success: false,
          message: 'Rol no encontrado',
        });
        return;
      }

      res.json({
        success: true,
        data: rol,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRolesByUsuario(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const roles = await new UsuariosService().getRolesByUsuario(id);

      res.json({
        success: true,
        data: roles,
      });
    } catch (error) {
      next(error);
    }
  }

  async asignarRol(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idUsuario = req.params.id;
      const { idRol } = req.body;

      if (!idRol) {
        res.status(400).json({
          success: false,
          message: 'idRol es requerido',
        });
        return;
      }

      // Validaciones de permisos adicionales
      const isCurrentUser = req.user && req.user.id_perfil === idUsuario;
      const userRole = req.user?.role?.nombre_rol?.toLowerCase();

      // 1. Un administrador no puede colocarse como cliente a sí mismo
      if (isCurrentUser && userRole === 'administrador') {
        // Verificar si el rol que se está asignando es "cliente"
        const { UsuariosService } = await import('../services/usuarios.service');
        const rolesResponse = await new UsuariosService().getRoles();
        const clienteRole = rolesResponse.data.find(r => r.nombre_rol.toLowerCase() === 'cliente');

        if (clienteRole && idRol === clienteRole.id_rol) {
          res.status(403).json({
            success: false,
            message: 'No puedes asignarte el rol de cliente a ti mismo'
          });
          return;
        }
      }

      // 2. Un administrador no puede modificar usuarios con rol propietario
      if (!isCurrentUser && userRole === 'administrador') {
        // Verificar si el usuario que se está editando tiene rol propietario
        const { UsuariosService } = await import('../services/usuarios.service');
        const userRoles = await new UsuariosService().getRolesByUsuario(idUsuario);
        const hasPropietarioRole = (userRoles as UsuarioRol[]).some((ur: UsuarioRol) =>
          ur.rol_usuario?.nombre_rol?.toLowerCase() === 'propietario'
        );

        if (hasPropietarioRole) {
          res.status(403).json({
            success: false,
            message: 'No tienes permisos para modificar usuarios con rol propietario'
          });
          return;
        }
      }

      await new UsuariosService().asignarRol(idUsuario, idRol);

      res.json({
        success: true,
        message: 'Rol asignado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async removerRol(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idUsuario = parseInt(req.params.idUsuario);
      await new UsuariosService().removerRol(idUsuario);

      res.json({
        success: true,
        message: 'Rol removido exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async getEstadisticas(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await new UsuariosService().getEstadisticas();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRoles(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 10;

      const filters = {
        estado: req.query.estado as string | undefined,
        searchValue: req.query.searchValue as string | undefined,
      };

      const result = await new UsuariosService().getRoles(page, pageSize, filters);

      res.json({
        success: true,
        data: result.data,
        count: result.total,
        page,
        pageSize,
      });
    } catch (error) {
      next(error);
    }
  }

  async getUsuariosByRol(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idRol = parseInt(req.params.idRol);
      const usuarios = await new UsuariosService().getUsuariosByRol(idRol);

      res.json({
        success: true,
        data: usuarios,
      });
    } catch (error) {
      next(error);
    }
  }

  async createRol(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rolData = req.body;
      const nuevoRol = await new UsuariosService().createRol(rolData);

      res.status(201).json({
        success: true,
        message: 'Rol creado exitosamente',
        data: nuevoRol,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateRol(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idRol = parseInt(req.params.id);
      const rolData = req.body;
      const rolActualizado = await new UsuariosService().updateRol(idRol, rolData);

      res.json({
        success: true,
        message: 'Rol actualizado exitosamente',
        data: rolActualizado,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteUsuario(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { logger } = await import('../utils/logger');

      logger.info(`[DELETE USUARIO] Intentando eliminar usuario con ID: ${req.params.id}`);
      logger.info(`[DELETE USUARIO] Usuario solicitante: ${req.user?.email} (Rol: ${req.user?.role?.nombre_rol}, Nivel: ${req.user?.role?.nivel_permisos})`);

      const id = req.params.id;

      if (!id) {
        logger.error(`[DELETE USUARIO] ID inválido: ${req.params.id}`);
        res.status(400).json({
          success: false,
          message: 'ID de usuario inválido',
        });
        return;
      }

      // Verificar que no se elimine a sí mismo
      if (req.user?.id_perfil === id) {
        logger.error(`[DELETE USUARIO] Usuario intentando eliminarse a sí mismo: ${id}`);
        res.status(400).json({
          success: false,
          message: 'No puedes eliminar tu propia cuenta',
        });
        return;
      }

      logger.info(`[DELETE USUARIO] ID parseado correctamente: ${id}`);

      await new UsuariosService().deleteUsuario(id);

      logger.info(`[DELETE USUARIO] Usuario eliminado exitosamente: ${id}`);

      res.json({
        success: true,
        message: 'Usuario eliminado correctamente',
      });
    } catch (error) {
      const { logger } = await import('../utils/logger');
      logger.error(`[DELETE USUARIO] Error:`, error);
      next(error);
    }
  }

  async checkEmailExists(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, excludeId } = req.query;
      const exists = await new UsuariosService().checkEmailExists(
        email as string,
        excludeId ? parseInt(excludeId as string) : undefined
      );

      res.json({
        success: true,
        exists,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkUsernameExists(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { username, excludeId } = req.query;
      const exists = await new UsuariosService().checkUsernameExists(
        username as string,
        excludeId ? parseInt(excludeId as string) : undefined
      );

      res.json({
        success: true,
        exists,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const usuariosController = new UsuariosController();
