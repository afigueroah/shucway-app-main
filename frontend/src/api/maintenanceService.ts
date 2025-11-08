import apiClient from './apiClient';

export interface MaintenanceTableResponse {
  tables: string[];
}

interface ColumnResponse {
  column_name: string;
  data_type?: string;
  label?: string;
  readOnly?: boolean;
}

export interface TableColumnsResponse {
  columns: ColumnResponse[];
  primaryKey: string;
}

export type RecordFilters = Record<string, string>;

export interface RecordsResponse<T = Record<string, unknown>> {
  data: T[];
}

export const maintenanceService = {
  async listTables(): Promise<string[]> {
    const response = await apiClient.get<MaintenanceTableResponse>('/maintenance/tables');
    return response.data.tables ?? [];
  },

  async getColumns(tableName: string): Promise<TableColumnsResponse> {
    const response = await apiClient.get<TableColumnsResponse>(`/maintenance/tables/${tableName}/columns`);
    return response.data;
  },

  async getRecords(
    tableName: string,
    options: { filters?: RecordFilters; search?: string; limit?: number } = {}
  ): Promise<RecordsResponse> {
    const params = new URLSearchParams();

    if (options.filters && Object.keys(options.filters).length > 0) {
      params.set('filters', JSON.stringify(options.filters));
    }

    if (options.search) {
      params.set('q', options.search);
    }

    if (options.limit && Number.isFinite(options.limit)) {
      params.set('limit', String(options.limit));
    }

    const query = params.toString();
    const response = await apiClient.get<RecordsResponse>(
      `/maintenance/tables/${tableName}/records${query ? `?${query}` : ''}`
    );

    return response.data;
  },

  async createRecord(tableName: string, payload: Record<string, unknown>) {
    const response = await apiClient.post(`/maintenance/tables/${tableName}/records`, payload);
    return response.data;
  },

  async updateRecord(tableName: string, id: string | number, payload: Record<string, unknown>) {
    const response = await apiClient.put(
      `/maintenance/tables/${tableName}/records/${encodeURIComponent(String(id))}`,
      payload
    );
    return response.data;
  },

  async deleteRecord(tableName: string, id: string | number) {
    const response = await apiClient.delete(
      `/maintenance/tables/${tableName}/records/${encodeURIComponent(String(id))}`
    );
    return response.data;
  },
};

export default maintenanceService;
