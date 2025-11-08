import FiltersIcon from "../../assets/icons/filters.svg";

const FiltersBtn = ({ handleClick }: { handleClick: () => void }) => {
  return (
    <button
      className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1"
      onClick={handleClick}
    >
      <img src={FiltersIcon} alt="Filters" className="w-3 h-3" />
      Filtros
    </button>
  );
};

export default FiltersBtn;
