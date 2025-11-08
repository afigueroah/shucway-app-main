import { z } from 'zod';

// ================================================================
// 🛒 VALIDADORES DE COMPRAS
// ================================================================

// ================== PROVEEDORES ==================

export const createProveedorSchema = z.object({
  body: z.object({
    nombre_empresa: z.string().min(1, 'El nombre de la empresa es requerido'),
    nombre_contacto: z.string().optional(),
    telefono: z.string().optional(),
    correo: z.string().email('Correo electrónico inválido').optional(),
    direccion: z.string().optional(),
    metodo_entrega: z.enum(['Recepcion', 'Recoger en tienda']).optional(),
  }),
});

export const updateProveedorSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'ID debe ser un número').transform(val => parseInt(val)),
  }),
  body: z.object({
    nombre_empresa: z.string().min(1, 'El nombre de la empresa es requerido').optional(),
    nombre_contacto: z.string().optional(),
    telefono: z.string().optional(),
    correo: z.string().email('Correo electrónico inválido').optional(),
    direccion: z.string().optional(),
    estado: z.boolean().optional(),
    metodo_entrega: z.enum(['Recepcion', 'Recoger en tienda']).optional(),
  }),
});