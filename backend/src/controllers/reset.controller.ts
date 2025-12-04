import { Request, Response } from 'express';
import { resetService } from '../services/reset.service';

export const resetController = {
  async resetModule(req: Request, res: Response): Promise<void> {
    const { module } = req.params;

    try {
      switch (module) {
        case 'ventas':
          await resetService.resetVentas();
          break;
        case 'inventario':
          await resetService.resetInventario();
          break;
        case 'productos':
          await resetService.resetProductos();
          break;
        case 'compras':
          await resetService.resetCompras();
          break;
        case 'clientes':
          await resetService.resetClientes();
          break;
        case 'proveedores':
          await resetService.resetProveedores();
          break;
        case 'gastos':
          await resetService.resetGastos();
          break;
        case 'arqueos':
          await resetService.resetArqueos();
          break;
        case 'auditorias':
          await resetService.resetAuditorias();
          break;
        default:
          res.status(400).json({ message: 'Módulo no válido' });
          return;
      }

      res.json({ message: `Módulo ${module} reiniciado exitosamente` });
    } catch (error) {
      console.error(`Error al reiniciar módulo ${module}:`, error);
      res.status(500).json({ message: `Error al reiniciar módulo ${module}` });
    }
  },

  async resetAll(_req: Request, res: Response): Promise<void> {
    try {
      await resetService.resetAll();
      res.json({ message: 'Todos los módulos reiniciados exitosamente' });
    } catch (error) {
      console.error('Error al reiniciar todos los módulos:', error);
      res.status(500).json({ message: 'Error al reiniciar todos los módulos' });
    }
  }
};