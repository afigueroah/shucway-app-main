import { Dayjs } from "dayjs";
import { TableProps } from "antd";
import { ReactNode, ComponentType } from "react";

interface GuardProps {
  children: ReactNode;
}

export interface IRoute {
  path: string;
  element: ComponentType;
  guard?: ComponentType<GuardProps>;
  layout?: ComponentType<GuardProps>;
  requiredLevel?: number; // Nivel mínimo de permiso requerido
}

export interface AuthUserType {
  id: string;
  email: string;
  last_sign_in_at: string;
  created_at: string;
  updated_at: string;
}

export interface RolUsuario {
  nombre: string;
  nivel_permisos: number;
}

export interface UsuarioRol {
  id_rol: number;
  rol_usuario: RolUsuario;
}

export interface UsuarioFormData {
  email: string;
  password: string;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  fecha_nacimiento: Dayjs | null;
  avatar_url: string;
  estado: 'activo' | 'inactivo' | 'suspendido' | 'eliminado';
  username: string | null;
  rol: string;
}

export interface UsuarioDataType {
  id_perfil: number; // Cambiado de string a number para coincidir con backend
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  fecha_nacimiento: string | null;
  fecha_registro: string;
  estado: string;
  username: string | null;
  avatar_url: string | null;
  ultimo_acceso: string | null;
  email?: string;
  nombre?: string; // Campo adicional del backend
  roles?: string; // Roles concatenados del backend
  nivel_permisos?: number; // Nivel de permisos del backend
  ventas_stats?: UsuarioVentasStats;
}

export interface UsuarioVentasStats {
  totalVentas: number;
  totalProductos: number;
  totalIngresos: number;
}

export interface InsumoDataType {
  id_insumo: number;
  nombre_insumo: string;
  id_categoria: number;
  unidad_base: string;
  id_proveedor_principal?: number;
  stock_minimo: number;
  stock_maximo: number;
  costo_promedio: number;
  fecha_registro: string;
  activo: boolean;
  insumo_url?: string;
}

export type TColumns = TableProps<UsuarioDataType>["columns"];

export interface IFilters {
  telefono: string | null;
  fecha_nacimiento:
    | [start: Dayjs | null | undefined, end: Dayjs | null | undefined]
    | null;
  estado: string | null;
  rol: string | null;
}

export interface ITableHeaderProps {
  columnsInfo: TColumns;
  handleChangeColumns: (cols: TColumns) => void;
  handleSearch: (search: string) => void;
}

export interface IColumnsBtn {
  columnsInfo: TColumns;
  handleChangeColumns: (cols: TColumns) => void;
}
