import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CategoriaProducto {
  id_categoria?: number;
  nombre_categoria: string;
  descripcion?: string;
  estado: 'activo' | 'desactivado';
}

interface CategoriaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (categoria: Omit<CategoriaProducto, 'id_categoria'>) => void;
  categoria?: CategoriaProducto | null;
  mode: 'create' | 'edit';
}

// Componente Drawer que se desliza desde la derecha
const DrawerRight: React.FC<
  React.PropsWithChildren<{ open: boolean; onClose: () => void; widthClass?: string; title?: string }>
> = ({ open, onClose, widthClass = 'w-full sm:w-[420px]', title, children }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.24 }}
            className={`absolute right-0 top-0 h-full bg-white shadow-2xl ${widthClass} flex flex-col`}
          >
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="font-semibold text-gray-800">{title}</div>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="flex-1 overflow-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const CategoriaModal: React.FC<CategoriaDrawerProps> = ({
  isOpen,
  onClose,
  onSave,
  categoria,
  mode
}) => {
  const [formData, setFormData] = useState<Omit<CategoriaProducto, 'id_categoria'>>({
    nombre_categoria: '',
    descripcion: '',
    estado: 'activo'
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes or categoria changes
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && categoria) {
        setFormData({
          nombre_categoria: categoria.nombre_categoria,
          descripcion: categoria.descripcion || '',
          estado: categoria.estado
        });
      } else {
        setFormData({
          nombre_categoria: '',
          descripcion: '',
          estado: 'activo'
        });
      }
      setErrors({});
    }
  }, [isOpen, mode, categoria]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nombre_categoria.trim()) {
      newErrors.nombre_categoria = 'El nombre de la categoría es obligatorio';
    } else if (formData.nombre_categoria.length < 2) {
      newErrors.nombre_categoria = 'El nombre debe tener al menos 2 caracteres';
    } else if (formData.nombre_categoria.length > 50) {
      newErrors.nombre_categoria = 'El nombre no puede exceder 50 caracteres';
    }

    if (formData.descripcion && formData.descripcion.length > 255) {
      newErrors.descripcion = 'La descripción no puede exceder 255 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving categoria:', error);
      // Error handling could be improved with toast notifications
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <DrawerRight
      open={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Crear Categoría' : 'Editar Categoría'}
      widthClass="w-full sm:w-[480px]"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Nombre de la categoría */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Nombre de la categoría *
          </label>
          <input
            type="text"
            value={formData.nombre_categoria}
            onChange={(e) => handleInputChange('nombre_categoria', e.target.value)}
            placeholder="Ej. Hamburguesas, Bebidas, Postres..."
            className={`w-full h-11 rounded-lg border px-3 text-sm transition-colors focus:outline-none focus:ring-2 ${
              errors.nombre_categoria
                ? 'border-red-300 focus:ring-red-200'
                : 'border-gray-200 focus:ring-emerald-200 focus:border-emerald-400'
            }`}
            disabled={loading}
          />
          {errors.nombre_categoria && (
            <p className="mt-1 text-sm text-red-600">{errors.nombre_categoria}</p>
          )}
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Descripción
          </label>
          <textarea
            value={formData.descripcion}
            onChange={(e) => handleInputChange('descripcion', e.target.value)}
            placeholder="Describe brevemente esta categoría (opcional)"
            rows={3}
            className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 resize-none ${
              errors.descripcion
                ? 'border-red-300 focus:ring-red-200'
                : 'border-gray-200 focus:ring-emerald-200 focus:border-emerald-400'
            }`}
            disabled={loading}
          />
          {errors.descripcion && (
            <p className="mt-1 text-sm text-red-600">{errors.descripcion}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {formData.descripcion?.length || 0}/255 caracteres
          </p>
        </div>

        {/* Estado */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Estado
          </label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="estado"
                value="activo"
                checked={formData.estado === 'activo'}
                onChange={(e) => handleInputChange('estado', e.target.value as 'activo' | 'desactivado')}
                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                disabled={loading}
              />
              <span className="text-sm text-gray-700">Activo</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Disponible
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="estado"
                value="desactivado"
                checked={formData.estado === 'desactivado'}
                onChange={(e) => handleInputChange('estado', e.target.value as 'activo' | 'desactivado')}
                className="w-4 h-4 text-gray-600 focus:ring-gray-500"
                disabled={loading}
              />
              <span className="text-sm text-gray-700">Desactivado</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                Oculto
              </span>
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Las categorías activas se muestran en el catálogo de ventas
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="h-10 px-4 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                Guardando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {mode === 'create' ? 'Crear Categoría' : 'Guardar Cambios'}
              </>
            )}
          </button>
        </div>
      </form>
    </DrawerRight>
  );
};

export default CategoriaModal;