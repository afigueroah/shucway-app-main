import React, { useState } from "react";
import { Button } from "antd";
import ColumnsBtn from "../ColumnsBtn/ColumnsBtn";
import PlusIcon from "../../assets/icons/plus.svg";
import { useToggleDrawer } from "../../hooks/usetoggleDrawer";
import { useNavigate } from "react-router-dom";
import { ITableHeaderProps } from "../../types";
import { MdAdminPanelSettings } from "react-icons/md";
import { FiSearch } from "react-icons/fi";

const TableHeader = ({
  columnsInfo,
  handleChangeColumns,
  handleSearch,
}: ITableHeaderProps) => {
  const [searchValue, setSearchValue] = useState("");

  const handleChangeSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    handleSearch(e.target.value);
  };

  const toggleDrawer = useToggleDrawer();
  const navigate = useNavigate();

  const handleOpenDrawer = () => {
    toggleDrawer(true, "showDrawerAdd");
  };

  const handleNavigateToRoles = () => {
    navigate('/administracion/roles');
  };

  return (
    <>
      {/* Filtros y acciones */}
      <div className="bg-white border border-gray-200/70 rounded-xl shadow-sm mb-6 px-5 py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-2xl lg:flex-1">
            <label htmlFor="search" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Buscar usuarios
            </label>
            <div className="relative mt-2">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="search"
                value={searchValue}
                onChange={handleChangeSearch}
                placeholder="Nombre, correo o rol"
                className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-11 pr-4 text-base text-gray-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 w-full lg:w-auto">
            <ColumnsBtn
              columnsInfo={columnsInfo}
              handleChangeColumns={handleChangeColumns}
            />

            <Button
              onClick={handleNavigateToRoles}
              className="h-11 rounded-lg bg-slate-800 px-5 text-sm font-semibold text-white hover:bg-slate-900 flex items-center gap-2 shadow-sm"
            >
              <MdAdminPanelSettings size={18} />
              Gestión de Roles
            </Button>

            <Button
              onClick={handleOpenDrawer}
              className="h-11 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-white hover:bg-emerald-600 flex items-center gap-2 shadow-sm"
            >
              <img src={PlusIcon} alt="Plus" className="w-4 h-4" />
              Agregar Usuario
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TableHeader;
