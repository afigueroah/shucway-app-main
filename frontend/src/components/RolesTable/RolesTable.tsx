import { useState, useEffect } from "react";
import TableTitle from "../TableTitle/TableTitle";
import { Pagination, PaginationProps, Spin, Modal, Drawer, Form, Input, InputNumber, Switch, Button, message } from "antd";
import { Rol, getRoles, deleteRol, getUsuariosByRol, createRol, updateRol, CreateRolDTO, UpdateRolDTO } from "../../api/rolesService";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import { MdVisibility, MdEdit, MdDelete, MdPeople, MdSearch, MdAdd } from "react-icons/md";
import { PiArrowUpBold, PiArrowDownBold } from "react-icons/pi";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";

const itemRender: PaginationProps["itemRender"] = (_, type, orginalElement) => {
  return type === "prev" ? (
    <a>Anterior</a>
  ) : type === "next" ? (
    <a>Siguiente</a>
  ) : (
    orginalElement
  );
};

interface RolesTableProps {
  estadoFilter?: string;
}

// Tipo de filtros específico para roles
interface RolesFilters {
  estado: string | null;
}

const RolesTable: React.FC<RolesTableProps> = ({ estadoFilter }) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);
  const [searchValue, setSearchValue] = useState<string>("");
  const [debouncedSearchValue, setDebouncedSearchValue] = useState<string>("");

  const [filters, setFilters] = useState<RolesFilters>({
    estado: null,
  });

  // Estados para ordenamiento
  type SortKey = 'id' | 'nombre' | 'descripcion' | 'nivel_permisos' | 'estado' | 'fecha_creacion';
  const [sortBy, setSortBy] = useState<SortKey>('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  // Estados para drawers
  const [selectedRol, setSelectedRol] = useState<Rol | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);

  // Form hooks
  const addForm = useForm<CreateRolDTO>();
  const editForm = useForm<UpdateRolDTO>();

  // Mutations
  const createRolMutation = useMutation({
    mutationFn: createRol,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles-table"] });
      message.success("Rol creado exitosamente");
      setAddDrawerOpen(false);
      addForm.reset();
    },
    onError: (error: Error) => {
      message.error(`Error al crear rol: ${error.message}`);
    },
  });

  const updateRolMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateRolDTO }) => updateRol(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles-table"] });
      message.success("Rol actualizado exitosamente");
      setEditDrawerOpen(false);
      editForm.reset();
      setSelectedRol(null);
    },
    onError: (error: Error) => {
      message.error(`Error al actualizar rol: ${error.message}`);
    },
  });

  // Hooks de permisos y acciones
  const permissions = usePermissions();
  const queryClient = useQueryClient();

  const { mutate: deleteRolApi } = useMutation({
    mutationFn: deleteRol,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["roles-table"],
      });
      message.success("Rol eliminado exitosamente");
    },
    onError: (error: Error) => {
      message.error(`Error al eliminar rol: ${error.message}`);
    },
  });

  // Funciones de manejo de acciones
  const handleView = (record: Rol) => {
    setSelectedRol(record);
    setViewDrawerOpen(true);
  };

  const handleEdit = (record: Rol) => {
    setSelectedRol(record);
    editForm.reset({
      nombre_rol: record.nombre_rol,
      descripcion: record.descripcion || undefined,
      nivel_permisos: record.nivel_permisos,
      permisos: record.permisos,
      activo: record.activo,
    });
    setEditDrawerOpen(true);
  };

  const handleAdd = () => {
    setAddDrawerOpen(true);
  };

  const handleCloseDrawers = () => {
    setViewDrawerOpen(false);
    setEditDrawerOpen(false);
    setAddDrawerOpen(false);
    setSelectedRol(null);
    addForm.reset();
    editForm.reset();
  };

  const onAddSubmit = (data: CreateRolDTO) => {
    createRolMutation.mutate(data);
  };

  const onEditSubmit = (data: UpdateRolDTO) => {
    if (selectedRol) {
      updateRolMutation.mutate({ id: selectedRol.id_rol, data });
    }
  };

  const handleDelete = (record: Rol) => {
    // Verificar si el rol tiene usuarios asociados
    getUsuariosByRol(record.id_rol).then(usuarios => {
      if (usuarios.length > 0) {
        Modal.error({
          title: 'No se puede eliminar',
          content: `Este rol tiene ${usuarios.length} usuario(s) asociado(s). No se puede eliminar.`,
          okText: 'Entendido',
        });
        return;
      }

      Modal.confirm({
        title: 'Confirmar eliminación',
        content: `¿Estás seguro que deseas eliminar el rol "${record.nombre_rol}"? Esta acción no se puede deshacer.`,
        okText: 'Eliminar',
        okType: 'danger',
        cancelText: 'Cancelar',
        onOk() {
          deleteRolApi(record.id_rol.toString());
        },
      });
    });
  };

  const handleViewUsers = async (record: Rol) => {
    try {
      const usuarios = await getUsuariosByRol(record.id_rol);
      Modal.info({
        title: `Usuarios con rol: ${record.nombre_rol}`,
        content: (
          <div>
            {usuarios.length > 0 ? (
              <ul className="list-disc pl-5">
                {usuarios.map((usuario, index) => (
                  <li key={index}>
                    {usuario.primer_nombre} {usuario.segundo_nombre || ''} {usuario.primer_apellido} {usuario.segundo_apellido || ''} ({usuario.username})
                  </li>
                ))}
              </ul>
            ) : (
              <p>No hay usuarios asignados a este rol.</p>
            )}
          </div>
        ),
        width: 600,
      });
    } catch {
      Modal.error({
        title: 'Error',
        content: 'No se pudieron cargar los usuarios del rol.',
      });
    }
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

  // Funciones para selección de filas
  const handleSelectAll = () => {
    if (selectedRows.length === roles.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(roles.map(r => r.id_rol));
    }
  };

  const handleRowSelect = (id: number) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter(rowId => rowId !== id));
    } else {
      setSelectedRows([...selectedRows, id]);
    }
  };

  // Usar el servicio de roles
  const { data, isLoading } = useQuery({
    queryFn: () => getRoles(currentPage, pageSize, {
      estado: estadoFilter && estadoFilter !== 'todos' ? estadoFilter : filters.estado || undefined,
      searchValue: debouncedSearchValue || undefined,
    }),
    queryKey: ["roles-table", currentPage, pageSize, estadoFilter, debouncedSearchValue], // QueryKey más estable y específico
    staleTime: 5000,
    retry: 3,
  });

  const roles: Rol[] = useMemo(() => {
    if (!data?.data) return [];

    // Mapear los datos
    const mappedRoles = data.data.map(rol => ({
      ...rol,
    }));

    // Aplicar ordenamiento si hay un criterio de ordenamiento activo
    if (sortBy) {
      const sortedRoles = [...mappedRoles].sort((a, b) => {
        let valueA: string | number;
        let valueB: string | number;

        switch (sortBy) {
          case 'id':
            valueA = a.id_rol;
            valueB = b.id_rol;
            break;
          case 'nombre':
            valueA = a.nombre_rol.toLowerCase();
            valueB = b.nombre_rol.toLowerCase();
            break;
          case 'nivel_permisos':
            valueA = a.nivel_permisos;
            valueB = b.nivel_permisos;
            break;
          case 'estado':
            valueA = a.activo ? 1 : 0;
            valueB = b.activo ? 1 : 0;
            break;
          case 'fecha_creacion':
            valueA = new Date(a.fecha_creacion).getTime();
            valueB = new Date(b.fecha_creacion).getTime();
            break;
          default:
            return 0;
        }

        if (typeof valueA === 'string' && typeof valueB === 'string') {
          return sortDir === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
        }

        return sortDir === 'asc' ? (valueA as number) - (valueB as number) : (valueB as number) - (valueA as number);
      });
      return sortedRoles;
    }

    return mappedRoles;
  }, [data, sortBy, sortDir]);

  const totalRoles = data?.total || 0;

  const handleFilterSubmit = (newFilters: RolesFilters) => {
    setFilters(newFilters);
  };

  const handleSearch = (search: string) => {
    setSearchValue(search);
  };

  // Paginación
  const handlePageChange = (page: number, size?: number) => {
    setCurrentPage(page);
    if (size) {
      setPageSize(size);
    }
  };

  // Drawer management
  // const [drawerUser, setDrawerUser] = useState<Rol | null>(null);
  // const location = useLocation();

  // useEffect(() => {
  //   const searchParams = new URLSearchParams(location.search);
  //   const userId = searchParams.get('edit');

  //   if (userId) {
  //     // Buscar el rol por ID
  //     const foundRol = roles.find(r => r.id_rol.toString() === userId);
  //     if (foundRol) {
  //       setDrawerUser(foundRol);
  //       toggleDrawer(true, "showDrawerEdit", userId);
  //     }
  //   } else {
  //     setDrawerUser(null);
  //   }
  // }, [location.search, roles, toggleDrawer]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchValue(searchValue.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  return (
    <>
      <TableTitle
        totalUsuarios={totalRoles}
        title="Roles del Sistema"
        itemName="Roles"
      />
      <div className="list_view">
        {/* Controles de búsqueda y filtro simples para roles */}
        <div className="flex items-center justify-between p-4 bg-white border-b">
          <div className="flex items-center gap-4">
            <div className="relative">
              <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar roles..."
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filters.estado || ''}
              onChange={(e) => handleFilterSubmit({ estado: e.target.value || null })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              {totalRoles} rol{totalRoles !== 1 ? 'es' : ''}
            </div>
            {permissions.isPropietario() && (
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2 bg-[#12443d] text-white rounded-lg hover:bg-[#0d3a34] transition-colors"
              >
                <MdAdd size={20} />
                <span>Nuevo Rol</span>
              </button>
            )}
          </div>
        </div>
        {isLoading ? (
          <div className="w-full h-[50vh] flex justify-center items-center">
            <Spin />
          </div>
        ) : roles.length === 0 ? (
          <div className="w-full h-[50vh] flex justify-center items-center">
            <div className="text-center">
              <p className="text-gray-500 text-lg">No hay roles</p>
            </div>
          </div>
        ) : (
          <>
            <div className="custom-scrollbar">
              <table className="users-table w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-4 text-left">
                      <input
                        type="checkbox"
                        checked={selectedRows.length === roles.length && roles.length > 0}
                        onChange={handleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <Th
                      label="ID"
                      onSort={() => toggleSort('id')}
                      active={sortBy === 'id'}
                      dir={sortBy === 'id' ? sortDir : undefined}
                    />
                    <Th
                      label="Nombre del Rol"
                      onSort={() => toggleSort('nombre')}
                      active={sortBy === 'nombre'}
                      dir={sortBy === 'nombre' ? sortDir : undefined}
                    />
                    <Th
                      label="Descripción"
                      onSort={() => toggleSort('descripcion')}
                      active={sortBy === 'descripcion'}
                      dir={sortBy === 'descripcion' ? sortDir : undefined}
                    />
                    <Th
                      label="Nivel de Permisos"
                      onSort={() => toggleSort('nivel_permisos')}
                      active={sortBy === 'nivel_permisos'}
                      dir={sortBy === 'nivel_permisos' ? sortDir : undefined}
                    />
                    <Th
                      label="Estado"
                      onSort={() => toggleSort('estado')}
                      active={sortBy === 'estado'}
                      dir={sortBy === 'estado' ? sortDir : undefined}
                    />
                    <Th
                      label="Fecha de Creación"
                      onSort={() => toggleSort('fecha_creacion')}
                      active={sortBy === 'fecha_creacion'}
                      dir={sortBy === 'fecha_creacion' ? sortDir : undefined}
                    />
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((rol, index) => (
                    <tr
                      key={rol.id_rol}
                      className={index % 2 === 0 ? 'bg-[#e6f4f1]' : 'bg-white border-b hover:bg-gray-50'}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(rol.id_rol)}
                          onChange={() => handleRowSelect(rol.id_rol)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-4 text-center font-semibold">
                        #{rol.id_rol}
                      </td>
                      <td className="p-4 text-center font-medium text-gray-900">
                        {rol.nombre_rol}
                      </td>
                      <td className="p-4 text-center">
                        <p className="text-sm text-gray-600 truncate max-w-xs">
                          {rol.descripcion || 'Sin descripción'}
                        </p>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          rol.nivel_permisos >= 80 ? 'bg-red-100 text-red-800' :
                          rol.nivel_permisos >= 60 ? 'bg-orange-100 text-orange-800' :
                          rol.nivel_permisos >= 40 ? 'bg-yellow-100 text-yellow-800' :
                          rol.nivel_permisos >= 20 ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {rol.nivel_permisos}/100
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          rol.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {rol.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {new Date(rol.fecha_creacion).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Botón Ver - visible para todos los usuarios autenticados */}
                          <IconBtn title="Ver detalles" onClick={() => handleView(rol)}>
                            <MdVisibility size={18} />
                          </IconBtn>

                          {/* Botón Ver Usuarios - visible para todos */}
                          <IconBtn title="Ver usuarios" onClick={() => handleViewUsers(rol)}>
                            <MdPeople size={18} />
                          </IconBtn>

                          {/* Botón Editar - solo administradores y propietarios */}
                          {(permissions.isAdministrador() || permissions.isPropietario()) && (
                            <IconBtn title="Editar" onClick={() => handleEdit(rol)}>
                              <MdEdit size={18} />
                            </IconBtn>
                          )}

                          {/* Botón Eliminar - solo propietarios */}
                          {permissions.isPropietario() && (
                            <IconBtn title="Eliminar" onClick={() => handleDelete(rol)}>
                              <MdDelete size={18} />
                            </IconBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="list_view_pagination">
              <Pagination
                total={totalRoles}
                current={currentPage}
                onChange={handlePageChange}
                pageSize={pageSize}
                showSizeChanger
                pageSizeOptions={["5", "10", "20"]}
                itemRender={itemRender}
              />
            </div>
          </>
        )}
      </div>

      {/* Drawer para ver rol */}
      <Drawer
        title={`Rol: ${selectedRol?.nombre_rol}`}
        placement="right"
        onClose={handleCloseDrawers}
        open={viewDrawerOpen}
        width={400}
      >
        {selectedRol && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre del Rol</label>
              <p className="mt-1 text-sm text-gray-900">{selectedRol.nombre_rol}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Descripción</label>
              <p className="mt-1 text-sm text-gray-900">{selectedRol.descripcion || 'Sin descripción'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nivel de Permisos</label>
              <p className="mt-1 text-sm text-gray-900">{selectedRol.nivel_permisos}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Estado</label>
              <p className="mt-1 text-sm text-gray-900">{selectedRol.activo ? 'Activo' : 'Inactivo'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha de Creación</label>
              <p className="mt-1 text-sm text-gray-900">{new Date(selectedRol.fecha_creacion).toLocaleDateString()}</p>
            </div>
          </div>
        )}
      </Drawer>

      {/* Drawer para editar rol */}
      <Drawer
        title="Editar Rol"
        placement="right"
        onClose={handleCloseDrawers}
        open={editDrawerOpen}
        width={400}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={handleCloseDrawers}>Cancelar</Button>
            <Button
              type="primary"
              onClick={editForm.handleSubmit(onEditSubmit)}
              loading={updateRolMutation.isPending}
            >
              Actualizar
            </Button>
          </div>
        }
      >
        <Form layout="vertical">
          <Controller
            name="nombre_rol"
            control={editForm.control}
            rules={{ required: "El nombre del rol es requerido" }}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Nombre del Rol"
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <Input {...field} placeholder="Ej: Administrador" />
              </Form.Item>
            )}
          />

          <Controller
            name="descripcion"
            control={editForm.control}
            render={({ field }) => (
              <Form.Item label="Descripción">
                <Input.TextArea
                  {...field}
                  placeholder="Descripción del rol"
                  rows={3}
                />
              </Form.Item>
            )}
          />

          <Controller
            name="nivel_permisos"
            control={editForm.control}
            rules={{
              required: "El nivel de permisos es requerido",
              min: { value: 0, message: "Debe ser mayor o igual a 0" },
              max: { value: 100, message: "Debe ser menor o igual a 100" }
            }}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Nivel de Permisos"
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <InputNumber
                  {...field}
                  min={0}
                  max={100}
                  className="w-full"
                  placeholder="Ej: 80"
                />
              </Form.Item>
            )}
          />

          <Controller
            name="activo"
            control={editForm.control}
            render={({ field }) => (
              <Form.Item label="Estado">
                <Switch
                  {...field}
                  checkedChildren="Activo"
                  unCheckedChildren="Inactivo"
                />
              </Form.Item>
            )}
          />
        </Form>
      </Drawer>

      {/* Drawer para crear rol */}
      <Drawer
        title="Crear Nuevo Rol"
        placement="right"
        onClose={handleCloseDrawers}
        open={addDrawerOpen}
        width={400}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={handleCloseDrawers}>Cancelar</Button>
            <Button
              type="primary"
              onClick={addForm.handleSubmit(onAddSubmit)}
              loading={createRolMutation.isPending}
            >
              Crear
            </Button>
          </div>
        }
      >
        <Form layout="vertical">
          <Controller
            name="nombre_rol"
            control={addForm.control}
            rules={{ required: "El nombre del rol es requerido" }}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Nombre del Rol"
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <Input {...field} placeholder="Ej: Administrador" />
              </Form.Item>
            )}
          />

          <Controller
            name="descripcion"
            control={addForm.control}
            render={({ field }) => (
              <Form.Item label="Descripción">
                <Input.TextArea
                  {...field}
                  placeholder="Descripción del rol"
                  rows={3}
                />
              </Form.Item>
            )}
          />

          <Controller
            name="nivel_permisos"
            control={addForm.control}
            rules={{
              required: "El nivel de permisos es requerido",
              min: { value: 0, message: "Debe ser mayor o igual a 0" },
              max: { value: 100, message: "Debe ser menor o igual a 100" }
            }}
            render={({ field, fieldState }) => (
              <Form.Item
                label="Nivel de Permisos"
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <InputNumber
                  {...field}
                  min={0}
                  max={100}
                  className="w-full"
                  placeholder="Ej: 80"
                />
              </Form.Item>
            )}
          />
        </Form>
      </Drawer>
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

export default RolesTable;
