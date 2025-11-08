import { Router } from 'express';
import { getProveedores, createProveedor, updateProveedor, deleteProveedor } from '../controllers/proveedor.controller';
import { validate } from '../middlewares/validator.middleware';
import { z } from 'zod';

const router = Router();

// Validación para query params (opcional, e.g., filtros)
const querySchema = z.object({
  estado: z.string().optional(),
});

// Validación para crear proveedor
const createProveedorSchema = z.object({
  nombre_empresa: z.string().min(1, 'El nombre de la empresa es requerido'),
  nombre_contacto: z.string().optional(),
  telefono: z.string().optional(),
  correo: z.string().email().optional(),
  direccion: z.string().optional(),
  estado: z.boolean().optional(),
  metodo_entrega: z.enum(['Recepcion', 'Recoger en tienda']).nullable(),
  es_preferido: z.boolean().optional(),
});

// Validación para actualizar proveedor
const updateProveedorSchema = z.object({
  nombre_empresa: z.string().min(1, 'El nombre de la empresa es requerido'),
  nombre_contacto: z.string().optional(),
  telefono: z.string().optional(),
  correo: z.string().email().optional(),
  direccion: z.string().optional(),
  estado: z.boolean().optional(),
  metodo_entrega: z.enum(['Recepcion', 'Recoger en tienda']).nullable(),
  es_preferido: z.boolean().optional(),
});

router.get('/', validate(querySchema), getProveedores);
router.post('/', validate(createProveedorSchema), createProveedor);
router.put('/:id', validate(updateProveedorSchema), updateProveedor);
router.delete('/:id', deleteProveedor);

export default router;