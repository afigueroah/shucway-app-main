
import { Response } from 'express';
import { createOrdenCompra, createDetalleOrdenCompra, getOrdenCompraById } from '../services/orden_compra.service';
import { OrdenCompra, DetalleOrdenCompra } from '../types/orden_compra.types';
import { AuthRequest } from '../types/express.types';

export const crearOrdenCompra = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('Datos recibidos para crear orden:', req.body);
    console.log('Usuario autenticado:', req.user);
    console.log('ID de perfil del usuario:', req.user?.id_perfil);
    
    // Validar que el usuario esté autenticado
    if (!req.user?.id_perfil) {
      console.error('Usuario no autenticado o sin id_perfil');
      res.status(401).json({
        error: 'Usuario no autenticado'
      });
      return;
    }
    
    // Validar datos requeridos
    const { id_proveedor, fecha_orden } = req.body;
    if (!id_proveedor || !fecha_orden) {
      console.error('Faltan datos requeridos:', { id_proveedor, fecha_orden });
      res.status(400).json({
        error: 'Faltan datos requeridos: id_proveedor y fecha_orden son obligatorios'
      });
      return;
    }
    
    const ordenData: OrdenCompra = {
      ...req.body,
      creado_por: req.user.id_perfil // Agregar el ID del usuario autenticado
    };
    
    console.log('Datos finales para crear orden:', ordenData);
    const orden = await createOrdenCompra(ordenData);
    console.log('Orden creada:', orden);

    // Si se envió un arreglo "detalles" en el body, guardarlos asociados a esta orden
    const detalles: DetalleOrdenCompra[] | undefined = Array.isArray(req.body.detalles) ? req.body.detalles : undefined;
    if (detalles && orden && orden.id_orden) {
      for (const det of detalles) {
        try {
          const detalleData: DetalleOrdenCompra = {
            ...det,
            id_orden: orden.id_orden,
          } as DetalleOrdenCompra;
          await createDetalleOrdenCompra(detalleData);
        } catch (e) {
          console.error('Error guardando detalle de orden (continuando):', e);
        }
      }
    }

    // Devolver la orden con sus detalles e información relacionada
    try {
      const ordenFull = orden && orden.id_orden ? await getOrdenCompraById(orden.id_orden) : orden;
      res.status(201).json(ordenFull || orden);
    } catch (e) {
      // Si falla la consulta de detalle, devolver la orden básica
      console.error('Error obteniendo orden completa después de crear:', e);
      res.status(201).json(orden);
    }
  } catch (error) {
    console.error('Error al crear orden de compra:', error);
    res.status(500).json({
      error: 'Error al crear orden de compra',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

export const crearDetalleOrdenCompra = async (req: AuthRequest, res: Response) => {
  try {
    console.log('[BACKEND] Datos recibidos para crear detalle:', req.body);
    const detalleData: DetalleOrdenCompra = req.body;
    const detalle = await createDetalleOrdenCompra(detalleData);
    console.log('[BACKEND] Detalle creado/actualizado exitosamente:', detalle);
    res.status(201).json(detalle);
  } catch (error) {
    const errorObj = error as { code?: string; details?: string; hint?: string; message?: string };
    console.error('[BACKEND] Error al crear detalle de orden de compra:', {
      code: errorObj?.code,
      details: errorObj?.details,
      hint: errorObj?.hint,
      message: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({
      error: 'Error al crear detalle de orden de compra',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};
