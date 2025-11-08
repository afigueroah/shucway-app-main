import { Request, Response } from 'express';
import supabase from '../config/database';

export const getProveedores = async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('proveedor')
      .select('*')
      .eq('estado', true);

    if (error) {
      console.error('Error al consultar proveedores:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }

    return res.json(data);
  } catch (error) {
    console.error('Error inesperado:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const createProveedor = async (req: Request, res: Response) => {
  try {
    const { nombre_empresa, nombre_contacto, telefono, correo, direccion, estado, metodo_entrega, es_preferido } = req.body;

    const { data, error } = await supabase
      .from('proveedor')
      .insert({
        nombre_empresa,
        nombre_contacto,
        telefono,
        correo,
        direccion,
        estado: estado ?? true,
        metodo_entrega,
        es_preferido: es_preferido ?? false
      })
      .select()
      .single();

    if (error) {
      console.error('Error al crear proveedor:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error('Error inesperado:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const updateProveedor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre_empresa, nombre_contacto, telefono, correo, direccion, estado, metodo_entrega, es_preferido } = req.body;

    const { data, error } = await supabase
      .from('proveedor')
      .update({
        nombre_empresa,
        nombre_contacto,
        telefono,
        correo,
        direccion,
        estado,
        metodo_entrega,
        es_preferido
      })
      .eq('id_proveedor', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar proveedor:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }

    if (!data) {
      return res.status(404).json({ message: 'Proveedor no encontrado' });
    }

    return res.json(data);
  } catch (error) {
    console.error('Error inesperado:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};

export const deleteProveedor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('proveedor')
      .delete()
      .eq('id_proveedor', id);

    if (error) {
      console.error('Error al eliminar proveedor:', error);
      return res.status(500).json({ message: 'Error interno del servidor' });
    }

    return res.json({ message: 'Proveedor eliminado correctamente' });
  } catch (error) {
    console.error('Error inesperado:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
};