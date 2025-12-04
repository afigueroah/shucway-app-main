// ================================================================
// 👥 SERVICIO DE CLIENTES
// ================================================================

import apiClient from "./apiClient";

// Interfaces para errores de Axios
interface AxiosError {
  response?: {
    status: number;
    data?: unknown;
  };
  message?: string;
}

// Interfaces basadas en el backend
export interface Cliente {
  id_cliente: number;
  nombre: string;
  telefono?: string;
  direccion?: string;
  fecha_registro: Date;
  puntos_acumulados: number;
  ultima_compra?: Date;
  tiene_transferencias_pendientes?: boolean;
  cantidad_transferencias_pendientes?: number;
}

export interface TransferenciaPendiente {
  id_venta: number;
  fecha_venta: string;
  total_venta: number;
  tipo_pago: string;
  estado: string;
  numero_referencia?: string;
  nombre_banco?: string;
  estado_transferencia?: string;
}

export const clientesService = {
  // Obtener todos los clientes
  async getClientes(): Promise<Cliente[]> {
    try {
      const response = await apiClient.get('/clientes');
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo clientes:', error);
      throw error;
    }
  },

  // Obtener cliente por ID
  async getClienteById(id: number): Promise<Cliente> {
    try {
      const response = await apiClient.get(`/clientes/${id}`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo cliente:', error);
      throw error;
    }
  },

  // Buscar cliente por teléfono
  async buscarPorTelefono(telefono: string): Promise<Cliente | null> {
    try {
      const response = await apiClient.get(`/clientes/telefono/${telefono}`);
      return response.data.data;
    } catch (error) {
      // Verificar si es un error de Axios con respuesta 404
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 404) {
          return null;
        }
      }
      console.error('Error buscando cliente:', error);
      throw error;
    }
  },

  // Crear cliente
  async createCliente(cliente: {
    nombre: string;
    telefono?: string;
    direccion?: string;
  }): Promise<Cliente> {
    try {
      const response = await apiClient.post('/clientes', cliente);
      return response.data.data;
    } catch (error) {
      console.error('Error creando cliente:', error);
      throw error;
    }
  },

  // Actualizar cliente
  async updateCliente(id: number, cliente: {
    nombre?: string;
    telefono?: string;
    direccion?: string;
  }): Promise<Cliente> {
    try {
      const response = await apiClient.put(`/clientes/${id}`, cliente);
      return response.data.data;
    } catch (error) {
      console.error('Error actualizando cliente:', error);
      throw error;
    }
  },

  // Eliminar cliente
  async deleteCliente(id: number): Promise<void> {
    try {
      await apiClient.delete(`/clientes/${id}`);
    } catch (error) {
      console.error('Error eliminando cliente:', error);
      throw error;
    }
  },

  // Obtener producto favorito de un cliente
  async getProductoFavorito(idCliente: number): Promise<{ producto: string; cantidad: number } | null> {
    try {
      const response = await apiClient.get(`/clientes/${idCliente}/producto-favorito`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo producto favorito:', error);
      throw error;
    }
  },

  // Obtener transferencias pendientes de un cliente
  async getTransferenciasPendientes(idCliente: number): Promise<TransferenciaPendiente[]> {
    try {
      const response = await apiClient.get(`/clientes/${idCliente}/transferencias-pendientes`);
      return response.data.data;
    } catch (error) {
      console.error('Error obteniendo transferencias pendientes:', error);
      throw error;
    }
  },

  // Marcar transferencia como pagada
  async marcarTransferenciaPagada(idVenta: number): Promise<void> {
    try {
      await apiClient.post(`/clientes/transferencias/${idVenta}/pagada`);
    } catch (error) {
      console.error('Error marcando transferencia como pagada:', error);
      throw error;
    }
  },
};