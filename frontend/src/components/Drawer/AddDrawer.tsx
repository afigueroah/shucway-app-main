import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Drawer,
  Input,
  Select,
  Spin,
  Upload,
  UploadProps,
  DatePicker,
  message,
} from "antd";
import { uploadFile } from "../../api/uploadFIle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addUsuario } from "../../api/addUsuario";
import { getRoles, Rol } from "../../api/rolesService";
import { checkEmailExists, checkUsernameExists } from "../../api/usuariosService";
import { useLocation } from "react-router-dom";
import { useToggleDrawer } from "../../hooks/usetoggleDrawer";
import { Controller, useForm } from "react-hook-form";

import { UsuarioFormData } from "../../types";
import dayjs from "dayjs";
import { useAuth } from "../../hooks/useAuth";

import { BiPhone, BiUser, BiUserPlus, BiMap, BiLock } from "react-icons/bi";
import { CgClose } from "react-icons/cg";
import AddNewUserIcon from "../../assets/icons/AddNewUser.svg";
import ImportAvatar from "../../assets/icons/importAvatar.svg";
import UploadIcon from "../../assets/icons/uploadIcon.svg";

const { Dragger } = Upload;

const AddDrawer = () => {
  const [isAddDrawerOpen, setIsDrawerOpen] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isUplaoding, setIsUploading] = useState<boolean>(false);

  const location = useLocation();
  const toggleDrawer = useToggleDrawer();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [messageApi, contextHolder] = message.useMessage();

  // Obtener roles disponibles
  const { data: rolesData, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => getRoles(1, 100), // Obtener todos los roles
    staleTime: 15 * 60 * 1000, // 15 minutos - los roles no cambian frecuentemente
  });

  const availableRoles = useMemo(
    () => (rolesData?.data as Rol[] | undefined)?.filter((rol) => rol.nombre_rol.toLowerCase() !== 'cliente') ?? [],
    [rolesData?.data]
  );

  const { mutate: addUsuarioApi } = useMutation({
    mutationFn: addUsuario,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["usuarios"],
        exact: false,
      });
    },
  });

  const {
    handleSubmit,
    formState: { errors },
    control,
    reset,
    setValue,
    getValues,
  } = useForm<UsuarioFormData>({
    defaultValues: {
      email: '',
      password: '',
      primer_nombre: '',
      segundo_nombre: '',
      primer_apellido: '',
      segundo_apellido: '',
      telefono: '',
      direccion: '',
      fecha_nacimiento: null,
      avatar_url: '',
      estado: 'activo',
      username: '',
      rol: '',
    }
  });

  useEffect(() => {
    if (availableRoles.length === 0) return;
    const currentRole = getValues('rol');
    if (!currentRole || !availableRoles.some((rol) => rol.nombre_rol === currentRole)) {
      setValue('rol', availableRoles[0].nombre_rol, { shouldValidate: true });
    }
  }, [availableRoles, getValues, setValue]);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const showDrawerParam = queryParams.get("showDrawerAdd");
    const isOpen = showDrawerParam === "true";
    setIsDrawerOpen(isOpen);
    
    // Limpiar el formulario cuando se abre el drawer
    if (isOpen) {
      reset({
        email: '',
        password: '',
        primer_nombre: '',
        segundo_nombre: '',
        primer_apellido: '',
        segundo_apellido: '',
        telefono: '',
        direccion: '',
        fecha_nacimiento: null,
        avatar_url: '',
        estado: 'activo',
        username: '',
        rol: availableRoles[0]?.nombre_rol || '',
      });
      setAvatar(null);
    }
  }, [location.search, reset, availableRoles]);

  // Función de validación asíncrona para email
  const validateEmail = async (value: string | null) => {
    if (!value) return 'El correo es requerido';

    const emailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!emailPattern.test(value)) return 'Correo electrónico inválido';

    try {
      const exists = await checkEmailExists(value);
      if (exists) return 'Ya existe un usuario con este correo electrónico';
      return true;
    } catch (error) {
      console.error('Error al validar email:', error);
      return 'Error al validar el correo electrónico';
    }
  };

  // Función de validación asíncrona para username
  const validateUsername = async (value: string | null) => {
    if (!value) return 'El username es requerido';

    try {
      const exists = await checkUsernameExists(value);
      if (exists) return 'Ya existe un usuario con este username';
      return true;
    } catch (error) {
      console.error('Error al validar username:', error);
      return 'Error al validar el username';
    }
  };

  const onCloseDrawer = () => {
    toggleDrawer(false, "showDrawerAdd");
  };

  const onSubmit = async (data: UsuarioFormData) => {
    try {
      if (avatar) data.avatar_url = avatar;

      // Convertir fecha dayjs a string si existe
      const fechaNacimiento = data.fecha_nacimiento && dayjs.isDayjs(data.fecha_nacimiento)
        ? data.fecha_nacimiento.format('YYYY-MM-DD')
        : null;

      await addUsuarioApi({
        email: data.email!,
        password: data.password!,
        role: data.rol || 'user',
        perfil: {
          primer_nombre: data.primer_nombre,
          segundo_nombre: data.segundo_nombre || null,
          primer_apellido: data.primer_apellido,
          segundo_apellido: data.segundo_apellido || null,
          telefono: data.telefono || null,
          direccion: data.direccion || null,
          fecha_nacimiento: fechaNacimiento,
          avatar_url: data.avatar_url || null,
          estado: 'activo',
          username: data.username || null,
          ultimo_acceso: null
        }
      });

      messageApi.success('Usuario creado exitosamente');
      reset();
      onCloseDrawer();
    } catch (error) {
      messageApi.error('Error al crear el usuario: ' + (error as Error).message);
    }
  };

  const props: UploadProps = {
    name: "file",
    multiple: false,
    async onChange(info) {
      const { status } = info.file;
      setIsUploading(true);

      if (status === "done") {
        const file = info.file.originFileObj;

        if (!currentUser?.id_perfil) {
          messageApi.error("No se encontró la sesión de usuario. Vuelve a iniciar sesión.");
          setIsUploading(false);
          return;
        }

        const fileUrl = await uploadFile(file, currentUser.id_perfil.toString());
        if (!fileUrl) {
          messageApi.error("No se pudo obtener la URL del archivo");
          setIsUploading(false);
          return;
        }

        setAvatar(fileUrl);
        messageApi.success(`${info.file.name} se subió correctamente`);
      } else if (status === "error") {
        messageApi.error(`Error al subir el archivo ${info.file.name}`);
      }

      setIsUploading(false);
    },
    customRequest: ({ onSuccess }) => {
      setTimeout(() => {
        onSuccess?.("ok");
      }, 0);
    },
  };

  return (
    <>
      {contextHolder}
      <Drawer
        title={
          <div className="flex items-center gap-4">
            <img src={AddNewUserIcon} alt="add user icon" />
            <div>
              <p className="text-[1.6rem] font-semibold">Agregar Nuevo Usuario</p>
              <p className="text-sm text-gray-500">Complete todos los datos del usuario</p>
            </div>
          </div>
        }
        placement="right"
        onClose={onCloseDrawer}
        open={isAddDrawerOpen}
        width={700}
        closeIcon={<CgClose size={20} />}
        destroyOnClose
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
          <div className="flex-1">
            {/* Avatar Upload Section */}
            <div className="mt-6 px-6 py-4">
              <div className="flex flex-col gap-4">
                <label className="text-gray-700 font-medium">Avatar</label>
                <div className="flex items-center gap-6">
                  <img
                    src={avatar || ImportAvatar}
                    alt="avatar"
                    className="w-20 h-20 rounded-full object-cover"
                  />
                  <Dragger {...props} className="flex-1">
                    <div className="flex items-center gap-5">
                      {isUplaoding ? (
                        <Spin />
                      ) : (
                        <img src={UploadIcon} alt="upload icon" />
                      )}
                      <p className="text-[1.4rem] font-extralight w-8/12">
                        <strong>Click to upload</strong> or drag and drop SVG, PNG,
                        JPG or GIF
                      </p>
                    </div>
                  </Dragger>
                </div>
              </div>
            </div>
            <hr />

          <div className="mt-6 flex flex-col">
            <div
              className="p-2 pl-6 text-color-blue-2 text-[1.6rem]"
              style={{
                background:
                  "linear-gradient(90.09deg, rgba(255, 255, 255, 0.43) 6.16%, rgba(68, 143, 237, 0.43) 70.73%, rgba(8, 111, 233, 0.6) 99.98%)",
              }}
            >
              Information
            </div>

            {/* Primer Nombre Field */}
            <div className="mt-6 px-6 py-4 flex flex-col gap-4">
              <label htmlFor="primer_nombre" className="text-gray-700">
                Primer Nombre <span className="text-red-500">*</span>
              </label>
              <Controller
                name="primer_nombre"
                control={control}
                rules={{ required: 'El primer nombre es requerido' }}
                render={({ field }) => (
                  <Input
                    {...field}
                    prefix={<BiUser />}
                    placeholder="Ingrese primer nombre"
                  />
                )}
              />
              {errors.primer_nombre && (
                <p className="text-red-500 text-[1.2rem]">
                  {errors.primer_nombre.message as string}
                </p>
              )}
            </div>

            {/* Segundo Nombre Field */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="segundo_nombre" className="text-gray-700">
                Segundo Nombre
              </label>
              <Controller
                name="segundo_nombre"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value || ''}
                    prefix={<BiUser />}
                    placeholder="Ingrese segundo nombre"
                  />
                )}
              />
              {errors.segundo_nombre && (
                <p className="text-red-500 text-[1.2rem]">
                  {errors.segundo_nombre.message as string}
                </p>
              )}
            </div>

            {/* Primer Apellido Field */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="primer_apellido" className="text-gray-700">
                Primer Apellido <span className="text-red-500">*</span>
              </label>
              <Controller
                name="primer_apellido"
                control={control}
                rules={{ required: 'El primer apellido es requerido' }}
                render={({ field }) => (
                  <Input
                    {...field}
                    prefix={<BiUser />}
                    placeholder="Ingrese primer apellido"
                  />
                )}
              />
              {errors.primer_apellido && (
                <p className="text-red-500 text-[1.2rem]">
                  {errors.primer_apellido.message as string}
                </p>
              )}
            </div>

            {/* Segundo Apellido Field */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="segundo_apellido" className="text-gray-700">
                Segundo Apellido
              </label>
              <Controller
                name="segundo_apellido"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value || ''}
                    prefix={<BiUser />}
                    placeholder="Ingrese segundo apellido"
                  />
                )}
              />
              {errors.segundo_apellido && (
                <p className="text-red-500 text-[1.2rem]">
                  {errors.segundo_apellido.message as string}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="email" className="text-gray-700">
                Correo Electrónico <span className="text-red-500">*</span>
              </label>
              <Controller
                name="email"
                control={control}
                rules={{
                  validate: validateEmail
                }}
                render={({ field }) => (
                  <Input
                    {...field}
                    prefix={<BiUser />}
                    placeholder="Ingrese correo electrónico"
                  />
                )}
              />
              {errors.email && (
                <p className="text-red-500 text-[1.2rem]">
                  {errors.email.message as string}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="password" className="text-gray-700">
                Contraseña <span className="text-red-500">*</span>
              </label>
              <Controller
                name="password"
                control={control}
                rules={{
                  required: 'La contraseña es requerida',
                  minLength: {
                    value: 6,
                    message: 'La contraseña debe tener al menos 6 caracteres',
                  },
                }}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    value={field.value || ''}
                    prefix={<BiLock />}
                    placeholder="Ingrese contraseña"
                  />
                )}
              />
              {errors.password && (
                <p className="text-red-500 text-[1.2rem]">{errors.password.message as string}</p>
              )}
            </div>

            {/* Teléfono Field */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="telefono" className="text-gray-700">
                Teléfono
              </label>
              <Controller
                name="telefono"
                control={control}
                rules={{
                  pattern: {
                    value: /^\d{8}$/,
                    message: "El teléfono debe tener exactamente 8 dígitos",
                  },
                }}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value || ''}
                    prefix={<BiPhone />}
                    placeholder="Ingrese teléfono"
                  />
                )}
              />
              {errors.telefono && (
                <p className="text-red-500 text-[1.2rem]">
                  {errors.telefono.message as string}
                </p>
              )}
            </div>

            {/* Dirección Field */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="direccion" className="text-gray-700">
                Dirección
              </label>
              <Controller
                name="direccion"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value || ''}
                    prefix={<BiMap />}
                    placeholder="Ingrese dirección"
                  />
                )}
              />
              {errors.direccion && (
                <p className="text-red-500 text-[1.2rem]">
                  {errors.direccion.message as string}
                </p>
              )}
            </div>

            {/* Fecha Nacimiento Field */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="fecha_nacimiento" className="text-gray-700">
                Fecha de Nacimiento
              </label>
              <Controller
                name="fecha_nacimiento"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    placeholder="Seleccione fecha de nacimiento"
                    format="DD/MM/YYYY"
                    style={{ width: '100%' }}
                  />
                )}
              />
              {errors.fecha_nacimiento && (
                <p className="text-red-500 text-[1.2rem]">
                  {errors.fecha_nacimiento.message as string}
                </p>
              )}
            </div>

            {/* Username Field */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="username" className="text-gray-700">
                Username
              </label>
              <Controller
                name="username"
                control={control}
                rules={{
                  validate: validateUsername
                }}
                render={({ field }) => (
                  <Input
                    {...field}
                    value={field.value || ''}
                    prefix={<BiUserPlus />}
                    placeholder="Ingrese username"
                  />
                )}
              />
              {errors.username && (
                <p className="text-red-500 text-[1.2rem]">
                  {errors.username.message as string}
                </p>
              )}
            </div>

            {/* Rol Field */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="rol" className="text-gray-700">
                Rol <span className="text-red-500">*</span>
              </label>
              <Controller
                name="rol"
                control={control}
                rules={{ required: 'El rol es requerido' }}
                render={({ field }) => (
                  <Select
                    {...field}
                    placeholder="Seleccione rol"
                    loading={isLoadingRoles}
                    options={availableRoles.map((rol) => ({
                      value: rol.nombre_rol,
                      label: rol.nombre_rol,
                    }))}
                  />
                )}
              />
              {errors.rol && (
                <p className="text-red-500 text-[1.2rem]">
                  {errors.rol.message as string}
                </p>
              )}
              <p className="text-sm text-gray-500">Asigna un rol al usuario</p>
            </div>
          </div>
        </div>
        <div className="sticky bottom-6 bg-white py-4">
          <div className="max-w-full px-6">
            <Button
              type="primary"
              className="py-3 text-[1.4rem] w-full !bg-emerald-500 transition-all duration-200 hover:opacity-80"
              htmlType="submit"
            >
              Crear Usuario
            </Button>
          </div>
          </div>
        </form>
      </Drawer>
    </>
  );
};

export default AddDrawer;
