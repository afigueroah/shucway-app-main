import { api } from "./apiClient";
import { supabase } from "./supabaseClient";
import { InsumoDataType } from "../types";

type Proveedor = {
  id_proveedor?: number;
  nombre: string;
  contacto?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  activo: boolean;
  es_preferido: boolean;
  dias_entrega?: string | null;
  tiempo_entrega_promedio?: number | null;
  metodo_entrega?: string | null;
};

export const fetchProveedores = async () => {
  const response = await api.get("/proveedores");
  return response.data;
};

export const getStockActual = async (idInsumo?: number) => {
  const params = idInsumo ? { idInsumo } : {};
  const response = await api.get("/inventario/stock", { params });
  return response.data;
};

export const getCategoriasInsumo = async () => {
  const response = await api.get("/dashboard/table-data/categoria_insumo");
  return response.data;
};

type ProveedorAPIData = {
  nombre_empresa: string;
  nombre_contacto?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  estado: boolean;
  es_preferido: boolean;
  metodo_entrega?: string | null;
};

export const saveProveedor = async (proveedor: Proveedor) => {
  // Mapear campos del frontend al formato de la API
  const apiData: ProveedorAPIData = {
    nombre_empresa: proveedor.nombre,
    nombre_contacto: proveedor.contacto,
    telefono: proveedor.telefono,
    correo: proveedor.correo,
    direccion: proveedor.direccion,
    estado: proveedor.activo,
    es_preferido: proveedor.es_preferido
  };

  // Incluir metodo_entrega si tiene valor
  if (proveedor.metodo_entrega) {
    apiData.metodo_entrega = proveedor.metodo_entrega;
  }

  if (proveedor.id_proveedor && proveedor.id_proveedor < 1000) { // ID real de la base de datos
    // Actualizar proveedor existente
    const response = await api.put(`/proveedores/${proveedor.id_proveedor}`, apiData);
    return response.data;
  } else {
    // Crear nuevo proveedor
    const response = await api.post("/proveedores", apiData);
    return response.data;
  }
};

export const deleteProveedor = async (id: number) => {
  const response = await api.delete(`/proveedores/${id}`);
  return response.data;
};

export const fetchOrdenesCompra = async () => {
  const response = await api.get("/ordenes-compra");
  return response.data;
};

export const fetchInsumos = async () => {
  const response = await api.get("/inventario/insumos");
  const payload = response.data;

  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  if (payload && Array.isArray(payload)) {
    return payload;
  }

  return [];
};

// CRUD Órdenes de Compra

export const createOrdenCompra = async (ordenData: {
  fecha_orden: string;
  id_proveedor: number;
  estado?: string;
  tipo_orden?: string;
  tipo_pago?: string;
  motivo_generacion?: string | null;
  fecha_entrega_estimada?: string | null;
  total?: number;
}) => {
  const response = await api.post("/ordenes-compra", ordenData);
  return response.data;
};

export const updateOrdenCompra = async (id_orden: string | number, ordenData: Partial<{
  fecha_orden: string;
  id_proveedor: number;
  estado: string;
  tipo_orden: string;
  tipo_pago: string;
  motivo_generacion?: string | null;
  fecha_entrega_estimada: string | null;
  total: number;
}>) => {
  const response = await api.put(`/ordenes-compra/${id_orden}`, ordenData);
  return response.data;
};

export const deleteOrdenCompra = async (id_orden: string | number) => {
  const response = await api.delete(`/ordenes-compra/${id_orden}`);
  return response.data;
};

export const fetchOrdenCompraById = async (id_orden: string | number) => {
  const response = await api.get(`/ordenes-compra/${id_orden}`);
  return response.data;
};

// CRUD Detalle Orden de Compra
export const createDetalleOrdenCompra = async (detalleData: {
  id_orden: number;
  id_insumo: number;
  cantidad: number;
  precio_unitario: number;
  id_presentacion: number;
}) => {
  const response = await api.post("/ordenes-compra/detalle", detalleData);
  return response.data;
};

export const saveInsumo = async (insumo: InsumoDataType) => {
  if (insumo.id_insumo) {
    // Actualizar
    const { data, error } = await supabase
      .from("insumo")
      .update(insumo)
      .eq("id_insumo", insumo.id_insumo);
    if (error) throw new Error(error.message);
    return data;
  } else {
    // Crear
    const { data, error } = await supabase
      .from("insumo")
      .insert(insumo);
    if (error) throw new Error(error.message);
    return data;
  }
};

export const createRecepcionMercaderia = async (recepcionData: {
  id_orden: number;
  fecha_recepcion: string;
  id_perfil: number;
  numero_factura?: string;
}) => {
  const response = await api.post('/inventario/recepcion-mercaderia', recepcionData);
  return response.data;
};

export const createDetalleRecepcionMercaderia = async (detalleData: {
  id_recepcion: number;
  id_detalle_orden: number;
  cantidad_recibida: number;
  cantidad_aceptada: number;
  id_presentacion: number;
}) => {
  const response = await api.post('/inventario/detalle-recepcion-mercaderia', detalleData);
  return response.data;
};

export const getInsumos = async () => {
  const response = await api.get("/inventario/insumos");
  return response.data;
};

export const getRecepcionesMercaderia = async () => {
  const response = await api.get('/inventario/recepciones-mercaderia');
  return response.data;
};

export const getOrdenCompraById = async (id: number) => {
  const response = await api.get(`/ordenes-compra/${id}`);
  return response.data;
};