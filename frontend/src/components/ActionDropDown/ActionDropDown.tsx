import { Dropdown, Modal } from "antd";
import actionIcon from "../../assets/icons/action.svg";
import editIcon from "../../assets/icons/edit.svg";
import deleteIcon from "../../assets/icons/trash.svg";
import { useToggleDrawer } from "../../hooks/usetoggleDrawer";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteUsuario } from "../../api/deleteUsuario";
import { UsuarioDataType } from "../../types";

const ActionDropDown = ({ data }: { data: UsuarioDataType }) => {
  const toggleDrawer = useToggleDrawer();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { mutate: deleteUsuarioApi } = useMutation({
    mutationFn: deleteUsuario,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["usuarios"],
        exact: false,
      });
    },
  });

  const handleEdit = () => {
    toggleDrawer(true, "showDrawerEdit", data?.id_perfil?.toString());
  };

  const handleModalOpen = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleDelete = () => {
    deleteUsuarioApi(data?.id_perfil?.toString());
    handleModalClose();
  };

  const items = [
    {
      key: "1",
      label: (
        <div className="flex items-center gap-6 " onClick={handleEdit}>
          <img src={editIcon} alt="editar" />
          <p className="text-gray-700">Editar</p>
        </div>
      ),
    },
    {
      key: "2",
      label: (
        <div className="flex items-center gap-6" onClick={handleModalOpen}>
          <img src={deleteIcon} alt="eliminar" />
          <p className="text-gray-700">Eliminar</p>
        </div>
      ),
    },
  ];
  return (
    <>
      <Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
        <div className="flex justify-center">
          <img src={actionIcon} alt="Action" className="cursor-pointer" />
        </div>
      </Dropdown>

      <Modal
        title="Eliminar usuario"
        open={isModalOpen}
        onCancel={handleModalClose}
        onOk={handleDelete}
        className=""
        okButtonProps={{
          className: "w-5/12 h-16 !bg-red-600 hover:opacity-80",
        }}
        cancelButtonProps={{
          className: "w-5/12 h-16",
        }}
        okText="Eliminar"
        cancelText="Cancelar"
      >
        <div className="bg-white absolute -top-[4rem] right-[50%] translate-x-1/2 rounded-[50%] w-32 h-32 flex justify-center items-center ">
          <img src={deleteIcon} alt="img icon" className="w-20" />
        </div>
        <p className="my-16  text-center text-[1.6rem] text-gray-600 font-extralight">
          ¿Estás seguro que deseas eliminar al usuario <strong>{data?.primer_nombre} {data?.primer_apellido}</strong>? Esta acción no se puede deshacer.
        </p>
        <hr className="" />
      </Modal>
    </>
  );
};

export default ActionDropDown;
