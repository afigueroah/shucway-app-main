import { Request, Response } from 'express';
import { supabase } from '../config/database';

export const getCategorias = async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('categoria_insumo')
      .select('id_categoria, nombre, tipo_categoria')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error fetching categorias:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
      return;
    }

    res.json(data || []);
  } catch (err) {
    console.error('Error in getCategorias:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getCategoriaById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('categoria_insumo')
      .select('id_categoria, nombre, tipo_categoria')
      .eq('id_categoria', id)
      .single();

    if (error) {
      console.error('Error fetching categoria:', error);
      res.status(404).json({ error: 'Categoria no encontrada' });
      return;
    }

    res.json(data);
  } catch (err) {
    console.error('Error in getCategoriaById:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};