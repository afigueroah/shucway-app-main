import { useState, useEffect } from "react";
import TableTitle from "../TableTitle/TableTitle";
import "./UsuariosTable.css";
import TableHeader from "../TableHeader/TableHeader";
import { Pagination, PaginationProps, Spin, Modal, message as antdMessage } from "antd";
import AddDrawer from "../Drawer/AddDrawer";
import EditDrawer from "../Drawer/EditDrawer";
import { useLocation } from "react-router-dom";
import { getUsuario } from "../../api/getUsuario";
import { UsuarioDataType } from "../../types";
import { useQuery } from "@tanstack/react-query";
// Importar el nuevo servicio del backend
import { getUsuarios } from "../../api/usuariosService";

import { IFilters, TColumns } from "../../types";
import { useMemo } from "react";
import AvatarIcon from "../../assets/icons/avatar.svg";
import { usePermissions } from "../../hooks/usePermissions";
import { MdVisibility, MdEdit, MdDelete } from "react-icons/md";
import { PiArrowUpBold, PiArrowDownBold, PiWarningBold } from "react-icons/pi";
import { useToggleDrawer } from "../../hooks/usetoggleDrawer";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteUsuario } from "../../api/deleteUsuario";
import { cambiarEstado } from "../../api/usuariosService";
import { useAuth } from "../../hooks/useAuth";

const itemRender: PaginationProps["itemRender"] = (_, type, orginalElement) => {
  return type === "prev" ? (
    <a>Anterior</a>
  ) : type === "next" ? (
    <a>Siguiente</a>
  ) : (
    orginalElement
  );
};

interface UsuariosTableProps {
  estadoFilter?: string;
}

const UsuariosTable: React.FC<UsuariosTableProps> = ({ estadoFilter }) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);
  const [searchValue, setSearchValue] = useState<string>("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState<string>("");

  const [filters] = useState<IFilters>({
    telefono: null,
    fecha_nacimiento: null,
    estado: null,
    rol: null,
  });

  // Estados para ordenamiento
  type SortKey = 'id' | 'estado' | 'nombreCompleto' | 'ultimoAcceso' | 'rol';
  const [sortBy, setSortBy] = useState<SortKey>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Hooks de permisos y acciones
  const permissions = usePermissions();
  const toggleDrawer = useToggleDrawer();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [messageApi, contextHolder] = antdMessage.useMessage();

  const { mutateAsync: softDeleteApi } = useMutation({
    mutationFn: (id: number) => cambiarEstado(id, 'eliminado'),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["usuarios"],
      });
      messageApi.success('Usuario marcado como eliminado');
    },
    onError: (error: Error) => {
      messageApi.error(`Error al eliminar usuario: ${error.message}`);
    },
  });

  // Mutación para borrado físico (hard delete)
  const { mutateAsync: hardDeleteApi } = useMutation({
    mutationFn: (id: string) => deleteUsuario(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"], exact: false });
      messageApi.success('Usuario eliminado permanentemente');
    },
    onError: (error: Error) => {
      messageApi.error(`Error al eliminar usuario permanentemente: ${error.message}`);
    },
  });

  const [deleteModalState, setDeleteModalState] = useState<{ open: boolean; user: UsuarioDataType | null; type: 'soft' | 'hard' }>({
    open: false,
    user: null,
    type: 'soft',
  });
  const [hardDeleteText, setHardDeleteText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const closeDeleteModal = () => {
    setDeleteModalState({ open: false, user: null, type: 'soft' });
    setHardDeleteText('');
    setDeleteLoading(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalState.user) return;

    try {
      setDeleteLoading(true);

      if (deleteModalState.type === 'hard') {
        if (hardDeleteText.trim() !== 'ELIMINAR') {
          messageApi.warning('Debes escribir ELIMINAR para confirmar.');
          setDeleteLoading(false);
          return;
        }
        await hardDeleteApi(deleteModalState.user.id_perfil.toString());
      } else {
        await softDeleteApi(deleteModalState.user.id_perfil);
      }

      closeDeleteModal();
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      setDeleteLoading(false);
    }
  };

  // Funciones de manejo de acciones
  const handleView = (record: UsuarioDataType) => {
    // Abrir el drawer en modo vista (solo lectura)
    toggleDrawer(true, "showDrawerView", record?.id_perfil?.toString());
  };

  const handleEdit = (record: UsuarioDataType) => {
    toggleDrawer(true, "showDrawerEdit", record?.id_perfil?.toString());
  };

  const handleDelete = (record: UsuarioDataType) => {
    // Verificar si es el usuario actual
    if (currentUser && record?.id_perfil === currentUser.id_perfil) {
      Modal.error({
        title: 'No se puede eliminar',
        content: 'No puedes eliminar tu propio usuario mientras estás conectado al sistema.',
        okText: 'Entendido',
      });
      return;
    }

    // Abrir modal personalizado inspirado en IngresoCompra
    setDeleteModalState({
      open: true,
      user: record,
      type: record.estado === 'eliminado' ? 'hard' : 'soft',
    });
    setHardDeleteText('');
  };

  // Función para alternar ordenamiento
  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  // Definición de columnas dentro del componente para acceder a las funciones
  const columns: TColumns = [
    {
      title: "ID",
      dataIndex: "id_perfil",
      width: 180,
      key: "id_perfil",
      hidden: false,
      render: (text, record) => (
        <div className="flex gap-6 items-center min-w-fit">
          <img
            src={record?.avatar_url || AvatarIcon}
            alt="avatar"
            className="w-16 h-16 rounded-full object-cover aspect-square"
          />
          <div className="flex flex-col ">
            <p className="font-semibold">{record?.primer_nombre} {record?.primer_apellido}</p>
            <p> #{text}</p>
          </div>
        </div>
      ),
    },
    {
      title: "Nombre Completo",
      key: "nombre_completo",
      align: "center",
      hidden: false,
      width: 200,
      render: (_, record) => (
        <p>{record?.primer_nombre} {record?.segundo_nombre} {record?.primer_apellido} {record?.segundo_apellido}</p>
      ),
    },
    {
      title: "Teléfono",
      key: "telefono",
      hidden: true,
      align: "center",
      dataIndex: "telefono",
      width: 150,
    },
    {
      title: "Dirección",
      key: "direccion",
      hidden: true,
      align: "center",
      dataIndex: "direccion",
      width: 200,
    },
    {
      title: "Fecha de Nacimiento",
      key: "fecha_nacimiento",
      hidden: true,
      align: "center",
      width: 150,
      render: (_, record) => {
        const date = record.fecha_nacimiento;
        return <p>{date ? new Date(date).toLocaleDateString() : '-'}</p>;
      },
    },
    {
      title: "Username",
      key: "username",
      hidden: true,
      align: "center",
      dataIndex: "username",
      width: 150,
    },
    {
      title: "Correo Electrónico",
      key: "email",
      hidden: true,
      align: "center",
      dataIndex: "email",
      width: 200,
    },
    {
      title: "Estado",
      key: "estado",
      hidden: false,
      align: "center",
      dataIndex: "estado",
      width: 120,
      render: (estado) => (
        <span className={`px-2 py-1 rounded-full text-xs ${
          estado === 'activo' ? 'bg-green-100 text-green-800' :
          estado === 'inactivo' ? 'bg-yellow-100 text-yellow-800' :
          estado === 'suspendido' ? 'bg-orange-100 text-orange-800' :
          estado === 'eliminado' ? 'bg-red-100 text-red-800' :
          'bg-gray-100 text-gray-800'
        }`}>
          {estado}
        </span>
      ),
    },
    {
      title: "Último Acceso",
      key: "ultimo_acceso",
      hidden: false,
      align: "center",
      width: 180,
      render: (_, record) => {
        const date = record.ultimo_acceso;
        return <p>{date ? new Date(date).toLocaleString() : 'Nunca'}</p>;
      },
      sorter: (a, b) => {
        const dateA = a.ultimo_acceso ? new Date(a.ultimo_acceso).getTime() : 0;
        const dateB = b.ultimo_acceso ? new Date(b.ultimo_acceso).getTime() : 0;
        return dateA - dateB;
      },
    },
    {
      title: "Rol",
      key: "rol",
      hidden: false,
      align: "center",
      width: 140,
      render: (_, record) => {
        // Si la API retorna la vista vw_usuarios_completo, contendrá un campo 'roles' (string)
        const rolesStr = (record as unknown as Record<string, unknown>)['roles'] as string | undefined;
        if (rolesStr && rolesStr.trim().length > 0) return <p>{rolesStr}</p>;

        // Fallback: buscar en usuario_rol[0].rol_usuario.nombre
        const rolEntry = (record as unknown as Record<string, unknown>)['usuario_rol'] as
          | Array<Record<string, unknown>>
          | undefined;
        const firstRol = rolEntry?.[0] as Record<string, unknown> | undefined;
        const rolUsuarioObj = firstRol ? (firstRol['rol_usuario'] as Record<string, unknown> | undefined) : undefined;
        const rolNombre = (rolUsuarioObj && (rolUsuarioObj['nombre'] as string)) || (firstRol?.['nombre'] as string) || 'sin asignar';
        return <p>{rolNombre}</p>;
      },
    },
    {
      title: "Acciones",
      key: "action",
      hidden: false,
      align: "center",
      width: 180,
      render: (_, record) => {
        return (
          <div className="flex items-center justify-center gap-1">
            {/* Botón Ver - visible para todos los usuarios autenticados */}
            <IconBtn title="Ver" onClick={() => handleView(record)}>
              <MdVisibility size={18} />
            </IconBtn>

            {/* Botón Editar - solo administradores y propietarios */}
            {(permissions.isAdministrador() || permissions.isPropietario()) && (
              <IconBtn title="Editar" onClick={() => handleEdit(record)}>
                <MdEdit size={18} />
              </IconBtn>
            )}

            {/* Botón Eliminar - solo propietarios */}
            {permissions.isPropietario() && (
              <IconBtn title="Eliminar" onClick={() => handleDelete(record)}>
                <MdDelete size={18} />
              </IconBtn>
            )}
          </div>
        );
      },
    },
  ];

  const [columnsInfo, setColumnsInfo] = useState<TColumns>(() => {
    // Cargar preferencias desde localStorage
    const savedColumns = localStorage.getItem('usuarios-table-columns');
    if (savedColumns) {
      try {
        const parsed = JSON.parse(savedColumns) as Array<{ key: string; hidden: boolean }>;
        // Combinar con las columnas por defecto para asegurar compatibilidad
        return columns.map(col => {
          const saved = parsed.find((s) => s.key === col.key);
          return saved ? { ...col, hidden: saved.hidden } : col;
        });
      } catch (error) {
        console.warn('Error loading column preferences:', error);
        // Si hay error, guardar las columnas por defecto
        localStorage.setItem('usuarios-table-columns', JSON.stringify(columns.map(col => ({ key: col.key, hidden: col.hidden }))));
        return columns;
      }
    }
    // Si no hay datos guardados, guardar las columnas por defecto
    localStorage.setItem('usuarios-table-columns', JSON.stringify(columns.map(col => ({ key: col.key, hidden: col.hidden }))));
    return columns;
  });

  // Guardar preferencias cuando cambien las columnas
  useEffect(() => {
    localStorage.setItem('usuarios-table-columns', JSON.stringify(columnsInfo));
  }, [columnsInfo]);

  // Usar el nuevo servicio del backend (sin suscripción en tiempo real por ahora)
  const { data, isLoading } = useQuery({
    queryFn: () => getUsuarios(currentPage, pageSize, {
      estado: estadoFilter && estadoFilter !== 'todos' ? estadoFilter : filters.estado || undefined,
      telefono: filters.telefono || undefined,
      searchValue: debouncedSearchValue || undefined,
    }),
    queryKey: ["usuarios", currentPage, pageSize, estadoFilter, debouncedSearchValue], // QueryKey más estable
    staleTime: 5000, // 5 segundos
    retry: 3
  });

  const handleSearch = (search: string) => {
    setSearchValue(search);
  };

  const handleChangeColumns = (cols: TColumns) => {
    setColumnsInfo(cols);
  };

  const handlePageCHnage = (page: number, pageSize?: number) => {
    setCurrentPage(page);
    if (pageSize) {
      setPageSize(pageSize);
    }
  };

  const usuarios: UsuarioDataType[] = useMemo(() => {
    if (!data?.data) return [];

    // Función para obtener el valor de ordenamiento
    const getValue = (usuario: UsuarioDataType, key: SortKey): string | number | null => {
      switch (key) {
        case 'id':
          return usuario.id_perfil;
        case 'estado':
          return usuario.estado;
        case 'nombreCompleto':
          return `${usuario.primer_nombre} ${usuario.segundo_nombre || ''} ${usuario.primer_apellido} ${usuario.segundo_apellido || ''}`.trim();
        case 'ultimoAcceso':
          return usuario.ultimo_acceso || '';
        case 'rol':
          return usuario.roles && usuario.roles !== 'Sin rol' ? usuario.roles : '';
        default:
          return '';
      }
    };

    // Mapear PerfilConRoles a UsuarioDataType
    const mappedUsuarios = data.data.map(perfil => ({
      id_perfil: perfil.id_perfil,
      primer_nombre: perfil.primer_nombre || '',
      segundo_nombre: perfil.segundo_nombre || null,
      primer_apellido: perfil.primer_apellido || '',
      segundo_apellido: perfil.segundo_apellido || null,
      telefono: perfil.telefono || null,
      direccion: perfil.direccion || null,
      fecha_nacimiento: perfil.fecha_nacimiento || null,
      fecha_registro: perfil.fecha_registro?.toString() || new Date().toISOString(),
      estado: perfil.estado,
      username: perfil.username || null,
      avatar_url: perfil.avatar_url || null,
      ultimo_acceso: perfil.ultimo_acceso?.toString() || null,
      email: perfil.email,
      nombre: perfil.nombre,
      roles: perfil.roles,
      nivel_permiso: perfil.nivel_permisos,
    }));

    // Aplicar ordenamiento si hay un criterio de ordenamiento activo
    if (sortBy) {
      const sortedUsuarios = [...mappedUsuarios].sort((a, b) => {
        const aValue = getValue(a, sortBy);
        const bValue = getValue(b, sortBy);

        // Manejar valores null/undefined
        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return sortDir === 'asc' ? 1 : -1;
        if (bValue == null) return sortDir === 'asc' ? -1 : 1;

        // Comparación de strings (case insensitive)
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
          return sortDir === 'asc' ? comparison : -comparison;
        }

        // Comparación de números
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDir === 'asc' ? aValue - bValue : bValue - aValue;
        }

        // Fallback: convertir a string y comparar
        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        const comparison = aStr.localeCompare(bStr);
        return sortDir === 'asc' ? comparison : -comparison;
      });
      return sortedUsuarios;
    }

    return mappedUsuarios;
  }, [data?.data, sortBy, sortDir]);
  const totalUsuarios = data?.count || 0;
  const location = useLocation();
  const [drawerUser, setDrawerUser] = useState<UsuarioDataType | null>(null);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const showDrawerEditParam = queryParams.get("showDrawerEdit");
    const showDrawerViewParam = queryParams.get("showDrawerView");

    if (showDrawerEditParam && showDrawerEditParam.startsWith("true-")) {
      const idFromParam = showDrawerEditParam.slice(5);
      // Si el usuario está en la página actual, usarlo directamente
      const found = usuarios.find((u) => String(u.id_perfil) === idFromParam);
      if (found) {
        setDrawerUser(found);
        return;
      }

      // Si no está en la página actual, solicitar al servidor
      getUsuario(idFromParam)
        .then((u) => setDrawerUser(u as UsuarioDataType | null))
        .catch(() => setDrawerUser(null));
      return;
    }

    if (showDrawerViewParam && showDrawerViewParam.startsWith("true-")) {
      const idFromParam = showDrawerViewParam.slice(5);
      // Si el usuario está en la página actual, usarlo directamente
      const found = usuarios.find((u) => String(u.id_perfil) === idFromParam);
      if (found) {
        setDrawerUser(found);
        return;
      }

      // Si no está en la página actual, solicitar al servidor
      getUsuario(idFromParam)
        .then((u) => setDrawerUser(u as UsuarioDataType | null))
        .catch(() => setDrawerUser(null));
      return;
    }

    setDrawerUser(null);
  }, [location.search, usuarios]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchValue(searchValue.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  return (
    <>
      {contextHolder}
      <TableTitle totalUsuarios={totalUsuarios} />
      <div className="mt-6 space-y-6">
        <TableHeader
          columnsInfo={columnsInfo}
          handleChangeColumns={handleChangeColumns}
          handleSearch={handleSearch}
        />
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          {isLoading ? (
            <div className="flex h-[320px] items-center justify-center">
              <Spin />
            </div>
          ) : usuarios.length === 0 ? (
            <div className="flex h-[320px] flex-col items-center justify-center text-center">
              <p className="text-gray-500 text-lg">No se encontraron usuarios con los filtros aplicados.</p>
              <p className="text-gray-400 text-sm mt-2">Intenta ajustar la búsqueda o limpiar los filtros.</p>
            </div>
          ) : (
            <>
              <div className="custom-scrollbar overflow-x-auto">
                <table className="users-table w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    {columnsInfo?.filter(col => !col.hidden).map((col) => (
                      <Th
                        key={col.key}
                        label={col.title as string}
                        onSort={() => {
                          // Solo permitir ordenamiento en columnas específicas
                          if (col.key === 'id_perfil') toggleSort('id');
                          else if (col.key === 'estado') toggleSort('estado');
                          else if (col.key === 'ultimo_acceso') toggleSort('ultimoAcceso');
                          else if (col.key === 'rol') toggleSort('rol');
                        }}
                        active={
                          (col.key === 'id_perfil' && sortBy === 'id') ||
                          (col.key === 'estado' && sortBy === 'estado') ||
                          (col.key === 'ultimo_acceso' && sortBy === 'ultimoAcceso') ||
                          (col.key === 'rol' && sortBy === 'rol')
                        }
                        dir={
                          ((col.key === 'id_perfil' && sortBy === 'id') ||
                           (col.key === 'estado' && sortBy === 'estado') ||
                           (col.key === 'ultimo_acceso' && sortBy === 'ultimoAcceso') ||
                           (col.key === 'rol' && sortBy === 'rol')) ? sortDir : undefined
                        }
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((usuario, index) => (
                    <tr
                      key={usuario.id_perfil}
                      className={index % 2 === 0 ? 'bg-emerald-50/60' : 'bg-white border-b hover:bg-slate-50'}
                    >
                      {columnsInfo?.filter(col => !col.hidden).map((col) => {
                        const column = col as { dataIndex?: string; render?: (value: unknown, record: UsuarioDataType, index: number) => React.ReactNode };
                        const value = column.dataIndex ? usuario[column.dataIndex as keyof UsuarioDataType] : null;
                        return (
                          <td key={col.key} className={`p-4 ${col.align === 'center' ? 'text-center' : 'text-left'}`}>
                            {column.render ? column.render(value, usuario, 0) : (
                              <span>{value as string}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="border-t border-gray-100 px-4 py-4 flex justify-between items-center flex-col gap-3 md:flex-row">
                <span className="text-sm text-gray-500">
                  Mostrando {usuarios.length} de {totalUsuarios} usuarios
                </span>
                <Pagination
                  total={totalUsuarios}
                  current={currentPage}
                  onChange={handlePageCHnage}
                  pageSize={pageSize}
                  showSizeChanger
                  pageSizeOptions={["5", "10", "20"]}
                  itemRender={itemRender}
                />
              </div>
            </>
          )}
        </div>
      </div>
      <AddDrawer />
      {/* Drawer de edición global: se controla via query string y carga user por id */}
      <EditDrawer data={drawerUser ?? undefined} />

      {deleteModalState.open && deleteModalState.user ? (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-2xl rounded-[32px] bg-white px-12 py-10 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.45)]">
            <div className="flex items-start gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                <PiWarningBold size={36} />
              </div>
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-gray-900">
                  {deleteModalState.type === 'hard' ? 'Eliminar usuario permanentemente' : 'Confirmar eliminación'}
                </h3>
                <p className="text-lg text-gray-600 leading-relaxed">
                  {deleteModalState.type === 'hard'
                    ? (
                      <>
                        El usuario <strong>{deleteModalState.user.primer_nombre} {deleteModalState.user.primer_apellido}</strong> ya está marcado como eliminado.
                        Esta acción borrará sus datos de forma <strong>permanente</strong>.
                      </>
                    )
                    : (
                      <>
                        ¿Seguro que deseas eliminar al usuario <strong>{deleteModalState.user.primer_nombre} {deleteModalState.user.primer_apellido}</strong>?<br />
                        Podrás recuperarlo luego desde mantenimiento, excepto si lo eliminas permanentemente.
                      </>
                    )}
                </p>
              </div>
            </div>

            {deleteModalState.type === 'hard' ? (
              <div className="mt-7">
                <label className="mb-2 block text-base font-semibold text-gray-600">Escribe ELIMINAR para confirmar</label>
                <input
                  value={hardDeleteText}
                  onChange={(e) => setHardDeleteText(e.target.value)}
                  placeholder="ELIMINAR"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3.5 text-lg focus:outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
            ) : null}

            <div className="mt-10 flex justify-end gap-5">
              <button
                onClick={closeDeleteModal}
                className="rounded-xl border border-gray-200 px-6 py-3 text-lg font-semibold text-gray-600 transition-colors hover:bg-gray-100"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className={`rounded-xl px-6 py-3 text-lg font-semibold text-white transition-colors ${
                  deleteModalState.type === 'hard'
                    ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                    : 'bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300'
                }`}
                type="button"
              >
                {deleteLoading
                  ? 'Eliminando...'
                  : deleteModalState.type === 'hard'
                    ? 'Eliminar permanentemente'
                    : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

function IconBtn({ title, children, onClick }: { title: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button title={title} onClick={onClick} className="p-2 rounded-lg hover:bg-gray-100 text-gray-700" type="button" aria-label={title}>
      {children}
    </button>
  );
}

function Th({ label, onSort, active, dir }: { label: string; onSort: () => void; active?: boolean; dir?: "asc" | "desc" }) {
  return (
    <th className="px-4 py-3 font-medium select-none">
      <button type="button" onClick={onSort} className="inline-flex items-center gap-1 text-left hover:underline" aria-label={`Ordenar por ${label}`}>
        <span>{label}</span>
        {active ? (dir === "asc" ? <PiArrowUpBold className="opacity-70" /> : <PiArrowDownBold className="opacity-70" />) : null}
      </button>
    </th>
  );
}

export default UsuariosTable;
