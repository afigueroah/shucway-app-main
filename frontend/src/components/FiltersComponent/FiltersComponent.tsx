import { Button, DatePicker, Input, Select } from "antd";
import { useState, useEffect } from "react";
import { IFilters } from "../../types";
import { Dayjs } from "dayjs";
import { getRoles } from "../../api/rolesService";
import { Rol } from "../../api/rolesService";

const { RangePicker } = DatePicker;

const FiltersComponent = ({
  handleFilterSubmit,
}: {
  handleFilterSubmit: (filters: IFilters) => void;
}) => {
  const [filters, setFilters] = useState<IFilters>({
    telefono: null,
    fecha_nacimiento: null,
    estado: null,
    rol: null,
  });

  const [roles, setRoles] = useState<Rol[]>([]);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const response = await getRoles(1, 100, { estado: 'activo' });
        setRoles(response.data);
      } catch (error) {
        console.error('Error cargando roles:', error);
      }
    };
    loadRoles();
  }, []);

  const handleFilerChange = (
    key: string,
    value:
      | string
      | [start: Dayjs | null | undefined, end: Dayjs | null | undefined]
      | null
  ) => {
    const newFilters = {
      ...filters,
      [key]: value,
    };
    setFilters(newFilters);
    handleFilterSubmit(newFilters);
  };

  const handleReset = () => {
    const resetFilters = {
      telefono: null,
      fecha_nacimiento: null,
      estado: null,
      rol: null,
    };
    setFilters(resetFilters);
    handleFilterSubmit(resetFilters);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-gray-500 text-sm font-medium">Teléfono</p>
          <Input
            placeholder="Buscar por teléfono"
            className="w-full"
            onChange={(e) => handleFilerChange("telefono", e.target.value)}
            value={filters.telefono || ""}
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-gray-500 text-sm font-medium">Fecha de Nacimiento</p>
          <RangePicker
            onChange={(value) => handleFilerChange("fecha_nacimiento", value)}
            value={filters.fecha_nacimiento}
            className="w-full"
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-gray-500 text-sm font-medium">Estado</p>
          <Select
            placeholder="Elegir estado"
            className="w-full"
            value={filters.estado}
            onChange={(value) => handleFilerChange("estado", value)}
          >
            <Select.Option value="activo">Activo</Select.Option>
            <Select.Option value="inactivo">Inactivo</Select.Option>
            <Select.Option value="suspendido">Suspendido</Select.Option>
            <Select.Option value="eliminado">Eliminado</Select.Option>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-gray-500 text-sm font-medium">Rol</p>
          <Select
            placeholder="Elegir rol"
            className="w-full"
            value={filters.rol}
            onChange={(value) => handleFilerChange("rol", value)}
          >
            {roles.map((rol) => (
              <Select.Option key={rol.id_rol} value={rol.id_rol.toString()}>
                {rol.nombre_rol}
              </Select.Option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex gap-4 self-end">
        <Button onClick={handleReset} size="small">Reset</Button>
      </div>
    </div>
  );
};

export default FiltersComponent;
