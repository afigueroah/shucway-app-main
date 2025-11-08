const TableTitle = ({
  totalUsuarios,
  title = "Tabla de Usuarios",
  itemName = "Usuarios"
}: {
  totalUsuarios: number;
  title?: string;
  itemName?: string;
}) => {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <h2 className="text-3xl md:text-[3rem] font-semibold text-slate-900 tracking-tight">
        {title}
      </h2>
      <div className="inline-flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-5 py-2 shadow-sm">
        <span className="text-xl font-bold text-emerald-700">{totalUsuarios}</span>
        <span className="text-sm font-medium uppercase tracking-wide text-emerald-700">
          {itemName}
        </span>
      </div>
    </div>
  );
};

export default TableTitle;
