import { supabase } from '../config/database';
import {
	MAINTENANCE_ALLOWED_TABLES,
	MAINTENANCE_TABLES,
	MaintenanceColumn,
	MaintenanceTableConfig,
	getMaintenancePrimaryKey,
} from '../config/maintenanceTables';

export interface TableDataOptions {
	filters?: Record<string, string>;
	search?: string;
	limit?: number;
}

const normalizeValue = (value: unknown): string => {
	if (value === null || value === undefined) return '';
	if (typeof value === 'string') return value.toLowerCase();
	if (typeof value === 'number' || typeof value === 'bigint') return String(value);
	if (typeof value === 'boolean') return value ? 'true' : 'false';
	try {
		return JSON.stringify(value).toLowerCase();
	} catch {
		return '';
	}
};

const getTableOrThrow = (tableName: string): MaintenanceTableConfig => {
	const config = MAINTENANCE_TABLES[tableName];
	if (!config) {
		throw new Error(`Tabla ${tableName} no está habilitada para mantenimiento`);
	}
	return config;
};

const prepareValue = (column: MaintenanceColumn, raw: unknown) => {
	if (raw === undefined || raw === null || raw === '') {
		return null;
	}

	switch (column.type) {
		case 'number': {
			const parsed = Number(raw);
			if (Number.isNaN(parsed)) {
				return null;
			}
			return parsed;
		}
		case 'boolean':
			return raw === true || raw === 'true' || raw === 1 || raw === '1';
		case 'json':
			if (typeof raw === 'object') return raw;
			try {
				return JSON.parse(String(raw));
			} catch {
				return raw;
			}
		case 'date':
			return raw;
		default:
			return raw;
	}
};

const sanitizePayload = (table: MaintenanceTableConfig, payload: Record<string, unknown>) => {
	const cleaned: Record<string, unknown> = {};
	for (const column of table.columns) {
		if (column.readOnly) continue;
		if (!(column.name in payload)) continue;
		const value = prepareValue(column, payload[column.name]);
		cleaned[column.name] = value;
	}
	return cleaned;
};

const buildQuery = (table: MaintenanceTableConfig, options: TableDataOptions) => {
	const { filters = {}, limit } = options;

	let query = supabase.from(table.name).select('*');

	if (table.defaultOrder) {
		query = query.order(table.defaultOrder.column, {
			ascending: table.defaultOrder.ascending ?? true,
			nullsFirst: false,
		});
	}

	for (const [column, value] of Object.entries(filters)) {
		if (!value) continue;
		const columnConfig = table.columns.find((c) => c.name === column);
		if (!columnConfig) continue;

		if (columnConfig.type === 'number') {
			const parsed = Number(value);
			if (!Number.isNaN(parsed)) {
				query = query.eq(column, parsed);
			}
			continue;
		}

		if (columnConfig.type === 'boolean') {
			const boolValue = value === 'true' || value === '1';
			query = query.eq(column, boolValue);
			continue;
		}

		query = query.ilike(column, `%${value}%`);
	}

	if (limit && Number.isFinite(limit)) {
		query = query.limit(limit);
	} else {
		query = query.limit(500);
	}

	return query;
};

export const maintenanceService = {
	async listTables(): Promise<string[]> {
		return [...MAINTENANCE_ALLOWED_TABLES];
	},

	async getTableColumns(tableName: string) {
		const table = getTableOrThrow(tableName);
		return table.columns.map((column) => ({
			column_name: column.name,
			data_type: column.type,
			label: column.label,
			readOnly: column.readOnly ?? false,
		}));
	},

	async getTableData(tableName: string, options: TableDataOptions = {}) {
		const table = getTableOrThrow(tableName);
		const query = buildQuery(table, options);

		const { data, error } = await query;
		if (error) {
			throw new Error(error.message);
		}

		const rows = Array.isArray(data) ? data : [];
		if (!options.search) {
			return rows;
		}

		const search = options.search.trim().toLowerCase();
		return rows.filter((row) =>
			table.columns.some((column) => {
				if (column.type === 'number' && !table.searchableColumns?.includes(column.name)) {
					return false;
				}
				return normalizeValue((row as Record<string, unknown>)[column.name]).includes(search);
			})
		);
	},

	async createRecord(tableName: string, values: Record<string, unknown>) {
		const table = getTableOrThrow(tableName);
		const payload = sanitizePayload(table, values);
		delete payload[table.primaryKey];

		const { data, error } = await supabase
			.from(table.name)
			.insert(payload)
			.select()
			.single();

		if (error) {
			throw new Error(error.message);
		}

		return data;
	},

	async updateRecord(tableName: string, id: string, values: Record<string, unknown>) {
		const table = getTableOrThrow(tableName);
		const payload = sanitizePayload(table, values);
		delete payload[table.primaryKey];

		const primaryColumn: MaintenanceColumn = {
			name: table.primaryKey,
			type: 'number',
		};

		const { data, error } = await supabase
			.from(table.name)
			.update(payload)
			.eq(table.primaryKey, prepareValue(primaryColumn, id))
			.select()
			.single();

		if (error) {
			throw new Error(error.message);
		}

		return data;
	},

	async deleteRecord(tableName: string, id: string) {
		const table = getTableOrThrow(tableName);
		const primaryColumn: MaintenanceColumn = {
			name: table.primaryKey,
			type: 'number',
		};

		const { error } = await supabase
			.from(table.name)
			.delete()
			.eq(table.primaryKey, prepareValue(primaryColumn, id));

		if (error) {
			throw new Error(error.message);
		}

		return { success: true };
	},

	getPrimaryKey(tableName: string): string {
		return getMaintenancePrimaryKey(tableName) ?? 'id';
	},

	async executeSql(sql: string) {
		const { error } = await supabase.rpc('exec_sql', { sql });

		if (error) {
			throw new Error(error.message);
		}

		return { success: true };
	},
};

export default maintenanceService;
