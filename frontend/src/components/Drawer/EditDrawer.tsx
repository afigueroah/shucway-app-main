import { Button, Drawer, Input, Spin, Upload, UploadProps, DatePicker, Select, message } from "antd";
import { CgClose } from "react-icons/cg";
import { BiPhone, BiUser, BiMap, BiUserPlus, BiLock } from "react-icons/bi";
import { FaEye, FaEyeSlash, FaSave } from "react-icons/fa";
import { Controller, useForm } from "react-hook-form";
import { supabase } from "../../api/supabaseClient";
import { useEffect, useState } from "react";
import { getRoles } from "../../api/rolesService";
import { getRolesByUsuario, updateUsuario, UpdateUsuarioDTO, asignarRol, removerRol } from "../../api/usuariosService";
import { Rol } from "../../api/rolesService";
import { useLocation } from "react-router-dom";

import AddNewUserIcon from "../../assets/icons/AddNewUser.svg";
import ImportAvatar from "../../assets/icons/importAvatar.svg";
import UploadIcon from "../../assets/icons/uploadIcon.svg";
import { useToggleDrawer } from "../../hooks/usetoggleDrawer";
import { useQueryClient } from "@tanstack/react-query";
import { UsuarioDataType, UsuarioFormData } from "../../types";
import dayjs, { Dayjs } from "dayjs";
import { useAuth } from "../../hooks/useAuth";

interface UsuarioRolResponse {
  id_rol: number;
  rol_usuario: {
    id_rol: number;
    nombre_rol: string;
    nivel_permisos: number;
  };
}

const { Dragger } = Upload;

/* ────────────────────────────────────────────────────────────
Helpers de Storage (bucket: user-img)
   ──────────────────────────────────────────────────────────── */
async function uploadAvatarToUserBucket(
  file: File,
  userId: string
): Promise<string> {
  const bucket = "user-img";

  // Generar nombre de archivo único
  const ext = file.name.split('.').pop() || "jpg";
  const fileName = `${userId}/avatar-${Date.now()}.${ext}`;

  // Convertir archivo a ArrayBuffer para asegurar que se suba como binario
  const arrayBuffer = await file.arrayBuffer();
  const fileBlob = new Blob([arrayBuffer], { type: file.type });

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(fileName, fileBlob, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type
    });

  if (upErr) throw new Error(upErr.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) throw new Error("No se pudo obtener la URL pública del archivo");
  return publicUrl;
}

/** Normalizador SOLO para el formulario
 *  Ahora soporta todos los estados incluyendo "suspendido".
 */
function toFormEstado(raw?: string | null): Exclude<UsuarioFormData["estado"], undefined> {
  if (raw === "activo" || raw === "inactivo" || raw === "suspendido" || raw === "eliminado") return raw;
  return "activo";
}

const EditDrawer = ({ data }: { data?: UsuarioDataType | null }) => {
  const [avatar, setAvatar] = useState<string | null>(data?.avatar_url || null);
  const [isLoadingUpload, setIsLoadingUpload] = useState<boolean>(false);
  const [editDrawer, setEditDrawer] = useState(false);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [isEditingPassword, setIsEditingPassword] = useState<boolean>(false);
  const [isViewMode, setIsViewMode] = useState<boolean>(false);

  const location = useLocation();
  const toggleDrawer = useToggleDrawer();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const uploadProps: UploadProps = {
  name: "file",
  multiple: false,
  async onChange(info) {
    const { status } = info.file;

    if (status === "uploading") {
      const f = info.file.originFileObj as File | undefined;
      if (f) {
        setAvatar(URL.createObjectURL(f)); // preview instantáneo
      }
      setIsLoadingUpload(true);
      return;
    }

    try {
      if (status === "done") {
        const file = info.file.originFileObj as File | undefined;
        if (!file) {
          message.error("No se obtuvo el archivo a subir");
          return;
        }
        if (!currentUser?.id_perfil) {
          message.error("No se encontró la sesión de usuario. Vuelve a iniciar sesión.");
          return;
        }
        const url = await uploadAvatarToUserBucket(file, currentUser.id_perfil.toString());
        setAvatar(url);                         // URL pública de Supabase
        message.success(`${info.file.name} se subió correctamente`);
      } else if (status === "error") {
        message.error(`Error al subir el archivo ${info.file.name}`);
      }
    } catch (e) {
      message.error((e as Error).message || "Error subiendo el avatar");
    } finally {
      setIsLoadingUpload(false);
    }
  },
  customRequest: ({ onSuccess }) => setTimeout(() => onSuccess?.("ok"), 0),
};


  const {
    handleSubmit,
    formState: { errors },
    control,
    reset,
    setValue,
  } = useForm<UsuarioFormData>({
    defaultValues: {
      email: data?.email || "",
      password: "",
      primer_nombre: data?.primer_nombre || "",
      segundo_nombre: data?.segundo_nombre || null,
      primer_apellido: data?.primer_apellido || "",
      segundo_apellido: data?.segundo_apellido || null,
      telefono: data?.telefono || null,
      direccion: data?.direccion || null,
      fecha_nacimiento: data?.fecha_nacimiento ? dayjs(data.fecha_nacimiento) : null,
      avatar_url: data?.avatar_url || "",
      // 👇 sin error de tipos
      estado: toFormEstado(data?.estado),
      username: data?.username || null,
      rol: "user",
    },
  });

  const onClose = () => {
    toggleDrawer(false, isViewMode ? "showDrawerView" : "showDrawerEdit");
  };

  const onSubmit = async (updatedData: UsuarioFormData) => {
    if (isViewMode) return; // No hacer nada en modo vista

    try {
      // Validaciones de permisos
      const isCurrentUser = currentUser && data?.id_perfil === currentUser.id_perfil;
      const isEditingSelf = isCurrentUser;

      // 0. Un administrador no puede cambiar su propio rol a propietario
      if (isEditingSelf && currentUser?.role?.nombre_rol?.toLowerCase() === 'administrador') {
        // Buscar el rol de propietario en la lista de roles disponibles
        const propietarioRole = (roles as Rol[]).find(r => (r as Rol).nombre_rol.toLowerCase() === 'propietario');
        if (propietarioRole && selectedRoleId === propietarioRole.id_rol) {
          message.error('No puedes cambiar tu propio rol a propietario');
          return;
        }
      }

      // 1. Un administrador no puede colocarse como cliente a sí mismo
      if (isEditingSelf && currentUser?.role?.nombre_rol?.toLowerCase() === 'administrador') {
        // Buscar el rol de cliente en la lista de roles disponibles
        const clienteRole = (roles as Rol[]).find(r => (r as Rol).nombre_rol.toLowerCase() === 'cliente');
        if (clienteRole && selectedRoleId === clienteRole.id_rol) {
          message.error('No puedes asignarte el rol de cliente a ti mismo');
          return;
        }
      }

      // 2. Un administrador no puede modificar usuarios con rol propietario
      if (!isEditingSelf && currentUser?.role?.nombre_rol?.toLowerCase() === 'administrador') {
        // Verificar si el usuario que se está editando tiene rol propietario
        const userRoles = await getRolesByUsuario(Number(data?.id_perfil));
        const userRolesTyped = userRoles as UsuarioRolResponse[];
        const hasPropietarioRole = userRolesTyped.some((ur) =>
          ur.rol_usuario.nombre_rol?.toLowerCase() === 'propietario'
        );

        if (hasPropietarioRole) {
          message.error('No tienes permisos para modificar usuarios con rol propietario');
          return;
        }
      }

      if (avatar) updatedData.avatar_url = avatar;

      const fechaNacimientoISO =
        updatedData.fecha_nacimiento && dayjs.isDayjs(updatedData.fecha_nacimiento as Dayjs)
          ? (updatedData.fecha_nacimiento as Dayjs).format("YYYY-MM-DD")
          : (updatedData.fecha_nacimiento as unknown as string | null) || null;

      // Ahora sí se puede editar estado, email y username
      const bodyPartial: Partial<UsuarioDataType> = {
        primer_nombre: updatedData.primer_nombre,
        segundo_nombre: updatedData.segundo_nombre,
        primer_apellido: updatedData.primer_apellido,
        segundo_apellido: updatedData.segundo_apellido,
        telefono: updatedData.telefono,
        direccion: updatedData.direccion,
        fecha_nacimiento: fechaNacimientoISO,
        avatar_url: updatedData.avatar_url,
        estado: updatedData.estado,
        email: updatedData.email,
        username: updatedData.username,
      };

      // Normalizar valores null -> undefined para cumplir UpdateUsuarioDTO
      const normalizeToUpdateDto = (p: Partial<UsuarioDataType>): UpdateUsuarioDTO => {
        const out: UpdateUsuarioDTO = {};
        if (p.primer_nombre !== null && p.primer_nombre !== undefined) out.primer_nombre = String(p.primer_nombre);
        if (p.segundo_nombre !== null && p.segundo_nombre !== undefined) out.segundo_nombre = String(p.segundo_nombre);
        if (p.primer_apellido !== null && p.primer_apellido !== undefined) out.primer_apellido = String(p.primer_apellido);
        if (p.segundo_apellido !== null && p.segundo_apellido !== undefined) out.segundo_apellido = String(p.segundo_apellido);
        if (p.telefono !== null && p.telefono !== undefined) out.telefono = String(p.telefono);
        if (p.direccion !== null && p.direccion !== undefined) out.direccion = String(p.direccion);
        if (p.fecha_nacimiento !== null && p.fecha_nacimiento !== undefined) out.fecha_nacimiento = String(p.fecha_nacimiento);
        if (p.avatar_url !== null && p.avatar_url !== undefined) out.avatar_url = String(p.avatar_url);
        if (p.estado !== null && p.estado !== undefined) out.estado = String(p.estado);
        if (p.email !== null && p.email !== undefined) out.email = String(p.email);
        if (p.username !== null && p.username !== undefined) out.username = String(p.username);
        return out;
      };

      // Si se está cambiando la contraseña, incluirla en el DTO (el backend la hasheará)
      // Nota: el backend valida permisos para cambiar contraseñas (propio usuario o admin/propietario)

      // Usar el endpoint backend (recomendado) en vez de acceder directamente a Supabase desde el cliente.
      // Esto evita errores de RLS/permiso al usar la anon key desde el front.
      if (!data?.id_perfil) throw new Error('Falta id_perfil');
      const updateDto = normalizeToUpdateDto(bodyPartial);

      if (isEditingPassword && updatedData.password && updatedData.password.trim()) {
        // Añadir password en texto plano; el backend se encargará de hashearla de forma segura
        (updateDto as UpdateUsuarioDTO & { password?: string }).password = String(updatedData.password);
      }

      await updateUsuario(Number(data.id_perfil), updateDto);

      // Invalidar todas las queries relacionadas con usuarios
      queryClient.invalidateQueries({ queryKey: ["usuarios"], exact: false });

      // Actualizar el localStorage con la nueva información del usuario para que se refleje en el dashboard
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const currentUser = JSON.parse(userStr);
          // Actualizar solo los campos que se modificaron
          const updatedUser = {
            ...currentUser,
            primer_nombre: updatedData.primer_nombre || currentUser.primer_nombre,
            segundo_nombre: updatedData.segundo_nombre || currentUser.segundo_nombre,
            primer_apellido: updatedData.primer_apellido || currentUser.primer_apellido,
            segundo_apellido: updatedData.segundo_apellido || currentUser.segundo_apellido,
            email: updatedData.email || currentUser.email,
            username: updatedData.username || currentUser.username,
            telefono: updatedData.telefono || currentUser.telefono,
            direccion: updatedData.direccion || currentUser.direccion,
            avatar_url: updatedData.avatar_url || currentUser.avatar_url,
            fecha_nacimiento: fechaNacimientoISO || currentUser.fecha_nacimiento,
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          // Notificar a otros componentes que el perfil del usuario se actualizó
          window.dispatchEvent(new CustomEvent('userProfileUpdated'));
        }
      } catch (storageError) {
        console.warn('Error actualizando localStorage:', storageError);
      }

      // Rol: usar endpoint backend para asignar/remover rol (evita permission denied desde anon key)
      if (data?.id_perfil) {
        if (selectedRoleId !== null && selectedRoleId !== undefined) {
          await asignarRol(Number(data.id_perfil), selectedRoleId);
        } else {
          await removerRol(Number(data.id_perfil));
        }
      }

      message.success("Usuario actualizado correctamente");
      reset();
      // Resetear estados de contraseña
      setPasswordVisible(false);
      setIsEditingPassword(false);
      onClose();
    } catch (err) {
      console.error('Error guardando usuario - raw error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      const lower = errorMessage.toLowerCase();
      if (lower.includes('forbidden') || lower.includes('permission') || lower.includes('policy')) {
        message.error(`Error de permisos al guardar usuario. Revisa roles/permisos en el backend. Detalles: ${errorMessage}`);
      } else if (lower.includes('duplicate') || lower.includes('unique') || lower.includes('already exists')) {
        if (lower.includes('email') || lower.includes('correo')) {
          message.error(`El correo electrónico ya está registrado. Por favor, utiliza otro correo. Detalles: ${errorMessage}`);
        } else if (lower.includes('username') || lower.includes('usuario')) {
          message.error(`El nombre de usuario ya está registrado. Por favor, utiliza otro nombre de usuario. Detalles: ${errorMessage}`);
        } else {
          message.error(`El usuario o correo ya existe. Revisa los datos e intenta nuevamente. Detalles: ${errorMessage}`);
        }
      } else {
        message.error(`Error guardando usuario. Revisa la consola para más detalles. ${errorMessage}`);
      }
    }
  };

  // Abrir/cerrar drawer por querystring
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const showDrawerEditParam = queryParams.get("showDrawerEdit");
    const showDrawerViewParam = queryParams.get("showDrawerView");

    if (showDrawerEditParam && showDrawerEditParam.startsWith("true-")) {
      const idFromParam = showDrawerEditParam.slice(5);
      if (String(data?.id_perfil) === idFromParam) {
        setEditDrawer(true);
        setIsViewMode(false);
        return;
      }
    }

    if (showDrawerViewParam && showDrawerViewParam.startsWith("true-")) {
      const idFromParam = showDrawerViewParam.slice(5);
      if (String(data?.id_perfil) === idFromParam) {
        setEditDrawer(true);
        setIsViewMode(true);
        return;
      }
    }

    setEditDrawer(false);
    setIsViewMode(false);
  }, [location.search, data?.id_perfil]);

  // Reset con datos cuando se abre
  useEffect(() => {
    if (!editDrawer) {
      // Resetear estados de contraseña cuando se cierra
      setPasswordVisible(false);
      setIsEditingPassword(false);
      return;
    }

    reset({
      email: data?.email || "",
      password: "",
      primer_nombre: data?.primer_nombre || "",
      segundo_nombre: data?.segundo_nombre || null,
      primer_apellido: data?.primer_apellido || "",
      segundo_apellido: data?.segundo_apellido || null,
      telefono: data?.telefono || null,
      direccion: data?.direccion || null,
      fecha_nacimiento: data?.fecha_nacimiento ? dayjs(data.fecha_nacimiento) : null,
      avatar_url: data?.avatar_url || "",
      estado: toFormEstado(data?.estado), // 👈 sin error de tipos
      username: data?.username || null,
      rol: "user",
    });
    setAvatar(data?.avatar_url || null);
  }, [editDrawer, data, reset]);

  // Cargar roles y rol actual
  useEffect(() => {
    if (!editDrawer) return;
    let mounted = true;

    // Verificar sesión usando el contexto de autenticación
    const checkSessionAndLoadData = async () => {
      try {
        // Verificar si hay un usuario autenticado usando el contexto
        if (!currentUser) {
          console.warn('No hay usuario autenticado');
          return;
        }

        const [rolesResponse, userRoles] = await Promise.all([
          getRoles(1, 100, { estado: 'activo' }),
          data?.id_perfil ? getRolesByUsuario(Number(data.id_perfil)) : Promise.resolve(null),
        ]);

        if (!mounted) return;

        const filteredRoles = (rolesResponse.data as Rol[]).filter((rol) => rol.nombre_rol.toLowerCase() !== 'cliente');
        setRoles(filteredRoles);

        let nextRoleId: number | null = null;
        if (Array.isArray(userRoles) && userRoles.length > 0) {
          nextRoleId = userRoles[0]?.rol_usuario?.id_rol ?? null;
        }

        if (nextRoleId && !filteredRoles.some((rol) => rol.id_rol === nextRoleId)) {
          nextRoleId = filteredRoles[0]?.id_rol ?? null;
        }

        setSelectedRoleId(nextRoleId);
      } catch (error) {
        console.error('Error verificando sesión:', error);
      }
    };

    checkSessionAndLoadData();

    return () => {
      mounted = false;
    };
  }, [editDrawer, data?.id_perfil, currentUser]);

  return (
    <Drawer
      title={
        <div className="flex items-center gap-4">
          <img src={AddNewUserIcon} alt="add user icon" />
          <div>
            <p className="text-[1.6rem] font-semibold">{isViewMode ? "Ver Usuario" : "Editar Usuario"}</p>
            <p className="text-sm text-gray-500">Modifica los datos del usuario seleccionado</p>
          </div>
        </div>
      }
      placement="right"
      onClose={onClose}
      open={editDrawer}
      width={700}
      closeIcon={<CgClose size={20} />}
      destroyOnClose
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
        <div className="flex-1">
          {/* Avatar - Solo en modo edición */}
          {!isViewMode && (
            <div className="mt-6 px-6 py-4">
              <div className="flex flex-col gap-4">
                <label className="text-gray-700 font-medium">Avatar</label>
                <div className="flex items-center gap-6">
                  <img src={avatar || ImportAvatar} alt="avatar" className="w-20 h-20 rounded-full object-cover" />
                  <Dragger {...uploadProps} showUploadList={false} className="flex-1">
                    <div className="flex items-center gap-5">
                      {isLoadingUpload ? <Spin /> : <img src={UploadIcon} alt="upload icon" />}
                      <p className="text-[1.4rem] font-extralight w-8/12">
                        <strong>Click to upload</strong> or drag and drop SVG, PNG, JPG or GIF
                      </p>
                    </div>
                  </Dragger>
                </div>
              </div>
            </div>
          )}
          {!isViewMode && <hr />}

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

            {/* Primer Nombre */}
            <div className="mt-6 px-6 py-4 flex flex-col gap-4">
              <label htmlFor="primer_nombre" className="text-gray-700">
                Primer Nombre <span className="text-red-500">*</span>
              </label>
              <Controller
                name="primer_nombre"
                control={control}
                rules={{ required: isViewMode ? false : "El primer nombre es requerido" }}
                render={({ field }) => (
                  <Input {...field} value={field.value || ""} prefix={<BiUser />} placeholder="Ingrese primer nombre" disabled={isViewMode} />
                )}
              />
              {errors.primer_nombre && (
                <p className="text-red-500 text-[1.2rem]">{errors.primer_nombre.message as string}</p>
              )}
            </div>

            {/* Segundo Nombre */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="segundo_nombre" className="text-gray-700">
                Segundo Nombre
              </label>
              <Controller
                name="segundo_nombre"
                control={control}
                render={({ field }) => (
                  <Input {...field} value={field.value || ""} prefix={<BiUser />} placeholder="Ingrese segundo nombre" disabled={isViewMode} />
                )}
              />
            </div>

            {/* Primer Apellido */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="primer_apellido" className="text-gray-700">
                Primer Apellido <span className="text-red-500">*</span>
              </label>
              <Controller
                name="primer_apellido"
                control={control}
                rules={{ required: isViewMode ? false : "El primer apellido es requerido" }}
                render={({ field }) => (
                  <Input {...field} value={field.value || ""} prefix={<BiUser />} placeholder="Ingrese primer apellido" disabled={isViewMode} />
                )}
              />
              {errors.primer_apellido && (
                <p className="text-red-500 text-[1.2rem]">{errors.primer_apellido.message as string}</p>
              )}
            </div>

            {/* Segundo Apellido */}
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
                    value={field.value || ""}
                    prefix={<BiUser />}
                    placeholder="Ingrese segundo apellido"
                    disabled={isViewMode}
                  />
                )}
              />
            </div>

            {/* Teléfono */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="telefono" className="text-gray-700">
                Teléfono
              </label>
              <Controller
                name="telefono"
                control={control}
                rules={{ pattern: isViewMode ? undefined : { value: /^\d{8,}$/, message: "El teléfono debe tener al menos 8 dígitos" } }}
                render={({ field }) => (
                  <Input {...field} value={field.value || ""} prefix={<BiPhone />} placeholder="Ingrese teléfono" disabled={isViewMode} />
                )}
              />
              {errors.telefono && <p className="text-red-500 text-[1.2rem]">{errors.telefono.message as string}</p>}
            </div>

            {/* Dirección */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="direccion" className="text-gray-700">
                Dirección
              </label>
              <Controller
                name="direccion"
                control={control}
                render={({ field }) => (
                  <Input {...field} value={field.value || ""} prefix={<BiMap />} placeholder="Ingrese dirección" disabled={isViewMode} />
                )}
              />
            </div>

            {/* Fecha Nacimiento */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="fecha_nacimiento" className="text-gray-700">
                Fecha de Nacimiento
              </label>
              <Controller
                name="fecha_nacimiento"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    value={field.value ?? null}
                    onChange={(date) => field.onChange(date)}
                    placeholder="Seleccione fecha de nacimiento"
                    format="DD/MM/YYYY"
                    style={{ width: "100%" }}
                    disabled={isViewMode}
                  />
                )}
              />
            </div>

            {/* Username */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="username" className="text-gray-700">
                Username
              </label>
              <Controller
                name="username"
                control={control}
                render={({ field }) => (
                  <Input {...field} value={field.value || ""} prefix={<BiUserPlus />} placeholder="Ingrese username" disabled={isViewMode} />
                )}
              />
            </div>

            {/* Email */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="email" className="text-gray-700">
                Correo Electrónico <span className="text-red-500">*</span>
              </label>
              <Controller
                name="email"
                control={control}
                rules={{ required: isViewMode ? false : "El correo electrónico es requerido" }}
                render={({ field }) => (
                  <Input {...field} value={field.value || ""} prefix={<BiUser />} placeholder="Ingrese correo electrónico" disabled={isViewMode} />
                )}
              />
              {errors.email && (
                <p className="text-red-500 text-[1.2rem]">{errors.email.message as string}</p>
              )}
            </div>

            {/* Contraseña - Solo en modo edición */}
            {!isViewMode && (
              <div className="px-6 py-4 flex flex-col gap-4">
                <label htmlFor="password" className="text-gray-700">
                  Contraseña
                </label>
                <div className="flex gap-2">
                  <Controller
                    name="password"
                    control={control}
                    rules={{
                      required: isEditingPassword ? "La contraseña es requerida" : false,
                      minLength: isEditingPassword ? {
                        value: 6,
                        message: "La contraseña debe tener al menos 6 caracteres"
                      } : undefined
                    }}
                    render={({ field }) => (
                      <Input
                        {...field}
                        type={passwordVisible ? "text" : "password"}
                        value={field.value || ""}
                        prefix={<BiLock />}
                        placeholder={isEditingPassword ? "Ingrese nueva contraseña" : "••••••••"}
                        disabled={!isEditingPassword}
                        className="flex-1"
                      />
                    )}
                  />
                  {isEditingPassword && (
                    <Button
                      type="text"
                      icon={passwordVisible ? <FaEyeSlash /> : <FaEye />}
                      onClick={() => setPasswordVisible(!passwordVisible)}
                      title={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                    />
                  )}
                  <Button
                    type="default"
                    onClick={() => {
                      setIsEditingPassword(!isEditingPassword);
                      if (isEditingPassword) {
                        // Si se está cancelando, resetear el campo password
                        setValue("password", "");
                        setPasswordVisible(false);
                      }
                    }}
                    className={isEditingPassword ? "bg-red-500 hover:bg-red-600 text-white" : ""}
                  >
                    {isEditingPassword ? "Cancelar" : "Cambiar"}
                  </Button>
                </div>
                {errors.password && isEditingPassword && (
                  <p className="text-red-500 text-[1.2rem]">{errors.password.message as string}</p>
                )}
                {!isEditingPassword && (
                  <p className="text-sm text-gray-500">La contraseña está oculta por seguridad</p>
                )}
                {isEditingPassword && (
                  <p className="text-sm text-blue-600">Ingrese la nueva contraseña</p>
                )}
              </div>
            )}

            {/* Estado */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="estado" className="text-gray-700">
                Estado <span className="text-red-500">*</span>
              </label>
              <Controller
                name="estado"
                control={control}
                rules={{ required: isViewMode ? false : "El estado es requerido" }}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onChange={(val) => field.onChange(val)}
                    placeholder="Seleccione estado"
                    options={[
                      { value: "activo", label: "Activo" },
                      { value: "inactivo", label: "Inactivo" },
                      { value: "eliminado", label: "Eliminado" },
                    ]}
                    disabled={isViewMode}
                  />
                )}
              />
              {errors.estado && (
                <p className="text-red-500 text-[1.2rem]">{errors.estado.message as string}</p>
              )}
              <p className="text-sm text-gray-500">{isViewMode ? "Estado del usuario" : "Selecciona el estado del usuario"}</p>
            </div>

            {/* Rol */}
            <div className="px-6 py-4 flex flex-col gap-4">
              <label htmlFor="rol" className="text-gray-700">
                Rol <span className="text-red-500">*</span>
              </label>
              <Select
                placeholder="Seleccione rol"
                value={selectedRoleId}
                onChange={(val: number) => setSelectedRoleId(val)}
                options={roles.map((r) => ({ value: r.id_rol, label: r.nombre_rol }))}
                disabled={isViewMode}
              />
              <p className="text-sm text-gray-500">{isViewMode ? "Rol asignado al usuario" : "Asigna un rol al usuario"}</p>
            </div>
          </div>
        </div>

        <div className="sticky bottom-6 bg-white py-4">
          <div className="max-w-full px-6">
            {isViewMode ? (
              <Button
                type="default"
                className="py-3 text-[1.4rem] w-full transition-all duration-200"
                onClick={onClose}
              >
                Cerrar
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button
                  type="default"
                  className="py-3 text-[1.4rem] flex-1 transition-all duration-200"
                  onClick={onClose}
                >
                  Cancelar
                </Button>
                <Button
                  type="primary"
                  className="py-3 text-[1.4rem] flex-1 !bg-green-600 !text-white font-bold transition-all duration-200 hover:!bg-green-700 flex items-center justify-center gap-2"
                  htmlType="submit"
                >
                  <FaSave size={16} />
                  Guardar cambios
                </Button>
              </div>
            )}
          </div>
        </div>
      </form>
    </Drawer>
  );
};

export default EditDrawer;
