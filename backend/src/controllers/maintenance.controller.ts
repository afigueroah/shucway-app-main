import { Request, Response } from 'express';
import { maintenanceService } from '../services/maintenance.service';

export const maintenanceController = {
	async listTables(_req: Request, res: Response) {
		try {
			const tables = await maintenanceService.listTables();
			res.json({ tables });
		} catch (error) {
			console.error('Error al listar tablas para mantenimiento:', error);
			res.status(500).json({ message: 'Error al obtener las tablas disponibles' });
		}
	},

	async getTableColumns(req: Request, res: Response) {
		const { tableName } = req.params;

		if (!tableName) {
			res.status(400).json({ message: 'Nombre de tabla requerido' });
			return;
		}

		try {
			const columns = await maintenanceService.getTableColumns(tableName);
			const primaryKey = maintenanceService.getPrimaryKey(tableName);
			res.json({ columns, primaryKey });
		} catch (error) {
			console.error('Error al obtener columnas de tabla para mantenimiento:', error);
			res.status(400).json({ message: (error as Error).message });
		}
	},

	async getTableData(req: Request, res: Response) {
		const { tableName } = req.params;

		if (!tableName) {
			res.status(400).json({ message: 'Nombre de tabla requerido' });
			return;
		}

		try {
			const filters = req.query.filters ? JSON.parse(String(req.query.filters)) : undefined;
			const search = typeof req.query.q === 'string' ? req.query.q : undefined;
			const limitParam = req.query.limit;
			const limit = typeof limitParam === 'string' ? Number.parseInt(limitParam, 10) : undefined;

			const data = await maintenanceService.getTableData(tableName, { filters, search, limit });
			res.json({ data });
		} catch (error) {
			console.error('Error al obtener datos de tabla para mantenimiento:', error);
			const message = error instanceof Error ? error.message : 'Error al obtener datos de la tabla';
			res.status(400).json({ message });
		}
	},

	async createRecord(req: Request, res: Response) {
		const { tableName } = req.params;

		if (!tableName) {
			res.status(400).json({ message: 'Nombre de tabla requerido' });
			return;
		}

		try {
			const created = await maintenanceService.createRecord(tableName, req.body ?? {});
			res.status(201).json({ data: created });
		} catch (error) {
			console.error('Error al crear registro en mantenimiento:', error);
			const message = error instanceof Error ? error.message : 'Error al crear el registro';
			res.status(400).json({ message });
		}
	},

	async updateRecord(req: Request, res: Response) {
		const { tableName, id } = req.params;

		if (!tableName || !id) {
			res.status(400).json({ message: 'Nombre de tabla e id requerido' });
			return;
		}

		try {
			const updated = await maintenanceService.updateRecord(tableName, id, req.body ?? {});
			res.json({ data: updated });
		} catch (error) {
			console.error('Error al actualizar registro en mantenimiento:', error);
			const message = error instanceof Error ? error.message : 'Error al actualizar el registro';
			res.status(400).json({ message });
		}
	},

	async deleteRecord(req: Request, res: Response) {
		const { tableName, id } = req.params;

		if (!tableName || !id) {
			res.status(400).json({ message: 'Nombre de tabla e id requerido' });
			return;
		}

		try {
			await maintenanceService.deleteRecord(tableName, id);
			res.json({ success: true });
		} catch (error) {
			console.error('Error al eliminar registro en mantenimiento:', error);
			const message = error instanceof Error ? error.message : 'Error al eliminar el registro';
			res.status(400).json({ message });
		}
	},

	async executeSql(req: Request, res: Response) {
		const { sql } = req.body;

		if (!sql || typeof sql !== 'string') {
			res.status(400).json({ message: 'SQL requerido' });
			return;
		}

		try {
			await maintenanceService.executeSql(sql);
			res.json({ message: 'SQL ejecutado exitosamente' });
		} catch (error) {
			console.error('Error al ejecutar SQL:', error);
			const message = error instanceof Error ? error.message : 'Error al ejecutar SQL';
			res.status(400).json({ message });
		}
	}
};

export default maintenanceController;
