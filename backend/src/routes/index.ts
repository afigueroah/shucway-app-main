import { Router } from 'express';
import authRoutes from './auth.routes';
import productosRoutes from './productos.routes';
import inventarioRoutes from './inventario.routes';
import comprasRoutes from './compras.routes';
import clientesRoutes from './clientes.routes';
import ventasRoutes from './ventas.routes';
import usuariosRoutes from './usuarios.routes';
import dashboardRoutes from './dashboard.routes';
import { dashboardController } from '../controllers/dashboard.controller';
import proveedorRoutes from './proveedor.routes';
import ordenCompraRoutes from './orden_compra.routes';
import backupRoutes from './backup.routes';
import auditoriaRoutes from './auditoria.routes';
import reportesRoutes from './reportes.routes';
import gastosOperativosRoutes from './gastos_operativos.routes';
import cajaRoutes from './caja.routes';
import resetRoutes from './reset.routes';

const router = Router();

// Rutas principales
router.use('/auth', authRoutes);
router.use('/productos', productosRoutes);
router.use('/inventario', inventarioRoutes);
router.use('/compras', comprasRoutes);
router.use('/clientes', clientesRoutes);
router.use('/ventas', ventasRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/proveedores', proveedorRoutes);
router.use('/ordenes-compra', ordenCompraRoutes);
router.use('/backup', backupRoutes);
router.use('/auditoria', auditoriaRoutes);
router.use('/reportes', reportesRoutes);
router.use('/gastos-operativos', gastosOperativosRoutes);
router.use('/caja', cajaRoutes);
router.use('/reset', resetRoutes);

// Rutas adicionales para compatibilidad con frontend
router.get('/db/tables-count', dashboardController.getTablesCount);
router.get('/config/recent-changes', dashboardController.getRecentChanges);

// Ruta de health check
router.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString(),
    supabase: 'PostgreSQL + Storage',
    auth: 'JWT personalizado (sin Supabase Auth)'
  });
});

export default router;
