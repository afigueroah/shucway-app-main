import React, { useState, useEffect } from 'react';
import { supabase } from '../../../api/supabaseClient';
import { UsuarioDataType } from '../../../types';
import { getProfile } from '../../../api/authService';
import { FaUser, FaEdit, FaSave, FaCamera, FaEnvelope, FaPhone, FaMapMarkerAlt, FaCalendarAlt, FaUserTag } from 'react-icons/fa';
import { message } from 'antd';
import { localStore } from '../../../utils/storage';

const Perfil: React.FC = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const [userData, setUserData] = useState<UsuarioDataType | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<UsuarioDataType>>({});

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        const profile = await getProfile();
        setUserData(profile);
        setFormData(profile);
      } catch (error) {
        console.error('Error fetching user profile:', error);
  messageApi.error('Error al cargar el perfil de usuario');
      } finally {
        setLoading(false);
      }
    };
    fetchUserProfile();
  }, [messageApi]);

  const handleInputChange = (field: keyof UsuarioDataType, value: string) => {
    setFormData((prev: Partial<UsuarioDataType>) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAvatarUpload = async (file: File) => {
    if (!userData) return;

    try {
      const userFolder = String(userData.id_perfil);
      const extension = file.name.split('.').pop() || 'png';
      const fileName = `${userFolder}/avatar-${Date.now()}.${extension}`;

      const arrayBuffer = await file.arrayBuffer();
      const fileBlob = new Blob([arrayBuffer], { type: file.type });

      const { error: uploadError } = await supabase.storage
        .from('user-img')
        .upload(fileName, fileBlob, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error('Error subiendo avatar:', uploadError);
  messageApi.error('Error subiendo avatar: ' + uploadError.message);
        return;
      }

      const { data } = supabase.storage.from('user-img').getPublicUrl(fileName);
      const publicUrl = data.publicUrl;

      const { updateUsuario } = await import('../../../api/usuariosService');
      await updateUsuario(userData.id_perfil, { avatar_url: publicUrl });

      setFormData((prev: Partial<UsuarioDataType>) => ({ ...prev, avatar_url: publicUrl }));
      setUserData((prev: UsuarioDataType | null) => (prev ? ({ ...prev, avatar_url: publicUrl }) : prev));

      try {
        const storedUser = localStore.get('user');
        if (storedUser) {
          const parsedUser = storedUser;
          const updatedUser = { ...parsedUser, avatar_url: publicUrl };
          localStore.set('user', updatedUser, { expires: 60 * 24 * 7 }); // 7 días
          window.dispatchEvent(new CustomEvent('userProfileUpdated'));
        }
      } catch (storageError) {
        console.warn('Error actualizando localStorage:', storageError);
      }

  messageApi.success('Avatar actualizado correctamente');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Error al subir avatar:', err);
  messageApi.error('Error al subir avatar: ' + errMsg);
    }
  };

  const handleSave = async () => {
    if (!userData) return;
    try {
      setSaving(true);
      // Normalizar los campos para que no haya null donde el backend espera string | undefined
      const updatePayload = {
        primer_nombre: formData.primer_nombre ?? '',
        segundo_nombre: formData.segundo_nombre ?? undefined,
        primer_apellido: formData.primer_apellido ?? '',
        segundo_apellido: formData.segundo_apellido ?? undefined,
        telefono: formData.telefono ?? undefined,
        direccion: formData.direccion ?? undefined,
        fecha_nacimiento: formData.fecha_nacimiento ?? undefined,
        username: formData.username ?? undefined,
        avatar_url: formData.avatar_url ?? undefined,
      };
      const { updateUsuario } = await import('../../../api/usuariosService');
      const updated = await updateUsuario(userData.id_perfil, updatePayload);
      // Normalizar fecha_registro y ultimo_acceso a string si vienen como Date
      const fecha_registro = typeof updated.fecha_registro === 'string'
        ? updated.fecha_registro
        : (updated.fecha_registro instanceof Date ? updated.fecha_registro.toISOString() : userData.fecha_registro);
      const ultimo_acceso =
        typeof updated.ultimo_acceso === 'string' || updated.ultimo_acceso === null || updated.ultimo_acceso === undefined
          ? updated.ultimo_acceso ?? null
          : (updated.ultimo_acceso instanceof Date ? updated.ultimo_acceso.toISOString() : userData.ultimo_acceso ?? null);
      setUserData({ ...userData, ...updated, fecha_registro: fecha_registro as string, ultimo_acceso: ultimo_acceso as string | null });
      setFormData({ ...formData, ...updated, fecha_registro: fecha_registro as string, ultimo_acceso: ultimo_acceso as string | null });
      setEditing(false);
      messageApi.success('Perfil actualizado correctamente');
    } catch (error) {
      console.error('Error updating profile:', error);
      messageApi.error('Error al actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(userData || {});
    setEditing(false);
  };

  const getInitials = (user: UsuarioDataType | null) => {
    if (!user) return 'U';
    const firstName = user.primer_nombre || '';
    const lastName = user.primer_apellido || '';
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    return firstName[0]?.toUpperCase() || lastName[0]?.toUpperCase() || 'U';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No especificada';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const ventasRegistradas = userData?.ventas_stats?.totalVentas ?? 0;
  const productosVendidos = userData?.ventas_stats?.totalProductos ?? 0;
  const ingresosGenerados = userData?.ventas_stats?.totalIngresos ?? 0;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-GT', {
      style: 'currency',
      currency: 'GTQ',
      maximumFractionDigits: 2,
    }).format(amount);

  if (loading) {
    return (
      <>
        {contextHolder}
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando perfil...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {contextHolder}
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Mi Perfil</h1>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FaEdit size={16} />
                Editar Perfil
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <FaSave size={16} />
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>

          {/* Profile Header */}
          <div className="flex items-center gap-6 mb-8">
            <div className="relative">
              {userData?.avatar_url ? (
                <img
                  src={userData.avatar_url}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-lg">
                  {getInitials(userData)}
                </div>
              )}
              {editing && (
                <>
                  <button className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors">
                    <FaCamera size={12} />
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute bottom-0 right-0 opacity-0 w-8 h-8 cursor-pointer"
                    style={{ zIndex: 2 }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      await handleAvatarUpload(file);
                      e.target.value = '';
                    }}
                  />
                </>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                {userData?.primer_nombre && userData?.primer_apellido
                  ? `${userData.primer_nombre} ${userData.segundo_nombre || ''} ${userData.primer_apellido} ${userData.segundo_apellido || ''}`.trim()
                  : userData?.username || 'Usuario'
                }
              </h2>
              <p className="text-gray-600 flex items-center gap-2">
                <FaUserTag size={14} />
                Estado: {userData?.estado || 'Desconocido'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Miembro desde {formatDate(userData?.fecha_registro || null)}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Información Personal */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaUser className="text-blue-600" />
              Información Personal
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primer Nombre</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.primer_nombre || ''}
                      onChange={(e) => handleInputChange('primer_nombre', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{userData?.primer_nombre || 'No especificado'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Segundo Nombre</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.segundo_nombre || ''}
                      onChange={(e) => handleInputChange('segundo_nombre', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{userData?.segundo_nombre || 'No especificado'}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Primer Apellido</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.primer_apellido || ''}
                      onChange={(e) => handleInputChange('primer_apellido', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{userData?.primer_apellido || 'No especificado'}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Segundo Apellido</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.segundo_apellido || ''}
                      onChange={(e) => handleInputChange('segundo_apellido', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{userData?.segundo_apellido || 'No especificado'}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de Usuario</label>
                {editing ? (
                  <input
                    type="text"
                    value={formData.username || ''}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-gray-900 font-medium">{userData?.username || 'No especificado'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Información de Contacto */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaEnvelope className="text-green-600" />
              Información de Contacto
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <FaPhone size={14} />
                  Teléfono
                </label>
                {editing ? (
                  <input
                    type="tel"
                    value={formData.telefono || ''}
                    onChange={(e) => handleInputChange('telefono', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+1234567890"
                  />
                ) : (
                  <p className="text-gray-900 font-medium">{userData?.telefono || 'No especificado'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                  <FaMapMarkerAlt size={14} />
                  Dirección
                </label>
                {editing ? (
                  <textarea
                    value={formData.direccion || ''}
                    onChange={(e) => handleInputChange('direccion', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ingresa tu dirección completa"
                  />
                ) : (
                  <p className="text-gray-900">{userData?.direccion || 'No especificada'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Información Adicional */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FaCalendarAlt className="text-purple-600" />
              Información Adicional
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Nacimiento</label>
                {editing ? (
                  <input
                    type="date"
                    value={formData.fecha_nacimiento ? formData.fecha_nacimiento.split('T')[0] : ''}
                    onChange={(e) => handleInputChange('fecha_nacimiento', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-gray-900 font-medium">{formatDate(userData?.fecha_nacimiento || null)}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Último Acceso</label>
                <p className="text-gray-900">{formatDate(userData?.ultimo_acceso || null)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado de la Cuenta</label>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  userData?.estado === 'activo' ? 'bg-green-100 text-green-800' :
                  userData?.estado === 'inactivo' ? 'bg-yellow-100 text-yellow-800' :
                  userData?.estado === 'suspendido' ? 'bg-orange-100 text-orange-800' :
                  userData?.estado === 'eliminado' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {userData?.estado || 'Desconocido'}
                </span>
              </div>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Estadísticas</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{ventasRegistradas}</div>
                <div className="text-sm text-gray-600">Ventas registradas</div>
                <div className="mt-2 text-xs text-gray-500">
                  {productosVendidos} productos vendidos
                </div>
                <div className="text-xs text-gray-500">{formatCurrency(ingresosGenerados)}</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {userData?.fecha_registro ? Math.floor((new Date().getTime() - new Date(userData.fecha_registro).getTime()) / (1000 * 60 * 60 * 24)) : 0}
                </div>
                <div className="text-sm text-gray-600">Días Activo</div>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <p className="text-gray-900 font-medium">{userData?.roles || 'No especificado'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Perfil;
