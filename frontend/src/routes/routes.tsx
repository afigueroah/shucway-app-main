/* eslint-disable react-refresh/only-export-components */
import React, { Suspense } from "react";
import { Route, Routes } from "react-router-dom";
const Dashboard = React.lazy(() => import("../views/Dashboard"));
const Login = React.lazy(() => import("../views/Login"));
const InitialRedirect = React.lazy(() => import("../views/InitialRedirect"));
const Usuarios = React.lazy(() => import("../features/Dashboard/Administracion"));
const GestionRoles = React.lazy(() => import("../features/Dashboard/Administracion/GestionRoles"));
const Configuracion = React.lazy(() => import("../features/Dashboard/Configuracion/Configuracion"));
const Mantenimiento = React.lazy(() => import("../features/Dashboard/Configuracion/Mantenimiento"));
const ConsultasSQL = React.lazy(() => import("../features/Dashboard/Configuracion/ConsultasSQL"));
const Backup = React.lazy(() => import("../features/Dashboard/Configuracion/Backup"));
const ReinicioDatos = React.lazy(() => import("../features/Dashboard/Configuracion/ReinicioDatos"));
const Ventas = React.lazy(() => import("../features/Dashboard/Ventas"));
const VentasPuntoVenta = React.lazy(() => import("../features/Dashboard/Ventas/Ventas/Ventas"));
const VentasProducto = React.lazy(() => import("../features/Dashboard/Ventas/Ventas/Producto"));
const VentasCierreCaja = React.lazy(() => import("../features/Dashboard/Ventas/Ventas/CierreCaja"));
const TicketVenta = React.lazy(() => import("../features/Dashboard/Ventas/Ventas/TicketVenta"));
const HistorialVentasCompleto = React.lazy(() => import('../features/Dashboard/Ventas/Ventas/HistorialVentas'));
const ArqueoCaja = React.lazy(() => import('../features/Dashboard/Ventas/Ventas/ArqueoCaja'));
const CategoriasProductos = React.lazy(() => import("../features/Dashboard/Ventas/Categorias"));
const Clientes = React.lazy(() => import("../features/Dashboard/Clientes"));
const Inventario = React.lazy(() => import("../features/Dashboard/Inventario"));
const GestionCategorias = React.lazy(() => import("../features/Dashboard/Inventario/Categorias"));
const RecepcionMercaderia = React.lazy(() => import("../features/Dashboard/Inventario/RecepcionMercaderia"));
const IngresoCompra = React.lazy(() => import("../features/Dashboard/Inventario/IngresoCompra"));
const Catalogo = React.lazy(() => import("../features/Dashboard/Inventario/Catalogo"));
const Proveedores = React.lazy(() => import("../features/Dashboard/Proveedores"));
const Reportes = React.lazy(() => import("../features/Dashboard/Reportes"));
const GastosOperativos = React.lazy(() => import("../features/Dashboard/Reportes/gastosop"));
const Perfil = React.lazy(() => import("../features/Dashboard/Perfil"));
const Soporte = React.lazy(() => import("../views/Soporte"));
import AuthGuard from "../guards/AuthGuard";
import RoleGuard from "../guards/RoleGuard";
import GuestGuard from "../guards/GuestGuard";
import DashboardLayout from "../layouts/DashboardLayout";
const Website = React.lazy(() => import("../website/Website"));
import { IRoute } from "../types";
import { MODULE_PERMISSIONS } from "../constants/permissions";

// Componente wrapper para combinar AuthGuard + RoleGuard
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredLevel: number }> = ({ 
  children, 
  requiredLevel 
}) => (
  <AuthGuard>
    <RoleGuard requiredLevel={requiredLevel}>
      {children}
    </RoleGuard>
  </AuthGuard>
);

// Rutas del dashboard administrativo
const protectedRoutes: IRoute[] = [
  {
    path: "/dashboard",
    element: Dashboard,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.DASHBOARD,
  },
  {
    path: "/configuracion",
    element: Configuracion,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.CONFIGURACION,
  },
  {
    path: "/configuracion/mantenimiento",
    element: Mantenimiento,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.MANTENIMIENTO,
  },
  {
    path: "/configuracion/consultas-sql",
    element: ConsultasSQL,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.CONSULTAS_SQL,
  },
  {
    path: "/configuracion/backup",
    element: Backup,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.BACKUP,
  },
  {
    path: "/configuracion/reinicio-datos",
    element: ReinicioDatos,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.CONFIGURACION,
  },
  {
    path: "/administracion",
    element: Usuarios,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.ADMINISTRACION,
  },
  {
    path: "/administracion/roles",
    element: GestionRoles,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.ADMINISTRACION,
  },
  {
    path: "/ventas",
    element: Ventas,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.VENTAS,
  },
  {
    path: "/ventas/ventas",
    element: VentasPuntoVenta,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.VENTAS,
  },
  {
    path: "/ventas/producto",
    element: VentasProducto,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.VENTAS,
  },
  {
    path: "/ventas/cierre-caja",
    element: VentasCierreCaja,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.VENTAS,
  },
  {
    path: "/ventas/ticketventa",
    element: TicketVenta,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.VENTAS,
  },
  {
    path: "/ventas/historial",
    element: HistorialVentasCompleto,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.VENTAS,
  },
  {
    path: "/ventas/arqueo-caja",
    element: ArqueoCaja,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.VENTAS,
  },
  {
    path: "/productos/categorias",
    element: CategoriasProductos,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.VENTAS,
  },
  {
    path: "/clientes",
    element: Clientes,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.VENTAS,
  },
  {
    path: "/inventario",
    element: Inventario,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.INVENTARIO,
  },
  {
    path: "/inventario/categorias",
    element: GestionCategorias,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.INVENTARIO,
  },
  {
    path: "/inventario/recepcion-mercaderia",
    element: RecepcionMercaderia,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.INVENTARIO,
  },
  {
    path: "/inventario/ingreso-compra",
    element: IngresoCompra,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.INVENTARIO,
  },
  {
    path: "/inventario/catalogo",
    element: Catalogo,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.INVENTARIO,
  },
  {
    path: "/proveedores",
    element: Proveedores,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.INVENTARIO,
  },
  {
    path: "/reportes",
    element: Reportes,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.REPORTES,
  },
  {
    path: "/reportes/gastos-operativos",
    element: GastosOperativos,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.REPORTES,
  },
  {
    path: "/perfil",
    element: Perfil,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.PERFIL,
  },
  {
    path: "/soporte",
    element: Soporte,
    guard: AuthGuard,
    layout: DashboardLayout,
    requiredLevel: MODULE_PERMISSIONS.DASHBOARD, // Accesible para todos los usuarios autenticados
  },
];

// Rutas públicas
const publicRoutes: IRoute[] = [
  {
    path: "/",
    element: InitialRedirect,
  },
  {
    path: "/login",
    element: Login,
    guard: GuestGuard,
  },
  {
    path: "/*",
    element: Website,
  },
];

export const routes: IRoute[] = [
  ...protectedRoutes,
  ...publicRoutes,
];

export const renderRoutes = (routes: IRoute[]) => {
  return (
    <Suspense fallback={<div className="p-8 text-center">Cargando...</div>}>
      <Routes>
        {routes?.map((route: IRoute, index: number) => {
          const Component = route.element as React.ComponentType<unknown>;
          const Layout = route.layout || React.Fragment;
          const requiredLevel = route.requiredLevel;

          // Si la ruta requiere un nivel de permisos, usar ProtectedRoute
          if (requiredLevel !== undefined) {
            return (
              <Route
                key={index}
                path={route.path}
                element={
                  <ProtectedRoute requiredLevel={requiredLevel}>
                    <Layout>
                      <Component />
                    </Layout>
                  </ProtectedRoute>
                }
              />
            );
          }

          // Si tiene un guard personalizado (como GuestGuard), usarlo
          const Guard = route.guard || React.Fragment;
          return (
            <Route
              key={index}
              path={route.path}
              element={
                <Guard>
                  <Layout>
                    <Component />
                  </Layout>
                </Guard>
              }
            />
          );
        })}
      </Routes>
    </Suspense>
  );
};