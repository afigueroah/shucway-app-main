import { Dropdown, Switch } from "antd";
import ColumnsIcon from "../../assets/icons/columns.svg";
import { IColumnsBtn } from "../../types";
import { Key } from "react";

const ColumnsBtn = ({ columnsInfo, handleChangeColumns }: IColumnsBtn) => {
  const handleCheck = (key: Key) => {
    if (!columnsInfo) return;
    const col = columnsInfo.find((col) => col?.key === key);
    if (!col) return;
    col.hidden = !col?.hidden;
    handleChangeColumns([...columnsInfo]);
  };
  const items = columnsInfo?.map((col, i) => {
    return {
      key: i,
      label: (
        <div
          className="flex items-center gap-4 justify-between w-[20rem] py-2"
          onClick={(e) => e.stopPropagation()}
        >
          <p>{col?.title as string}</p>
          <Switch
            checked={!col?.hidden}
            onChange={() => handleCheck(col?.key as Key)}
          />
        </div>
      ),
    };
  });

  return (
    <Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
      <button className="h-12 rounded-lg border border-gray-200 bg-white px-5 text-base font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-3">
        <img src={ColumnsIcon} alt="Columns" className="w-5 h-5" />
        Columnas
      </button>
    </Dropdown>
  );
};

export default ColumnsBtn;
