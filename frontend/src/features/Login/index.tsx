import logo from "/img/logo.png";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, type MouseEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { handleLogin } from "../../api/handleLogin";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useAuth } from "../../hooks/useAuth";

import './Login.css';

const SUPPORT_TEAM = [
  {
    name: 'Andrea Sofia Chafolla Mendez',
    carne: '5090-22-216',
    phone: '+502 3052 6004',
    email: 'achafollam@miumg.edu.gt',
  },
  {
    name: 'Carmi Emileny Cuxum Gonzalez',
    carne: '5090-22-3686',
    phone: '+502 3031 8249',
    email: 'ccuxumg@miumg.edu.gt',
  },
  {
    name: 'Josué Daniel Figueroa Herrera',
    carne: '5090-22-36',
    phone: '+502 5625 2922',
    email: 'jfigueroah4@miumg.edu.gt',
  },
  {
    name: 'Dilan René Escobar Rodríguez',
    carne: '5090-22-1010',
    phone: '+502 5748 1467',
    email: 'descobarr9@miumg.edu.gt',
  },
  {
    name: 'Bartola Angelica Grave Barrera',
    carne: '5090-22-7985',
    phone: '+502 3652 9993',
    email: 'Bgraveb@miumg.edu.gt',
  },
];

const Login = () => {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const {
    handleSubmit,
    formState: { errors },
    control,
    reset,
  } = useForm<{ identifier: string; password: string }>({
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const onSubmit = async (data: { identifier: string; password: string }) => {
    setIsLoading(true);
    try {
      const { identifier, password } = data;
      const success = await handleLogin(identifier, password);

      if (success) {
        await refreshUser();
        navigate('/dashboard');
        return;
      }

      // Si el login no fue exitoso (p. ej. credenciales incorrectas),
      // handleLogin ya muestra el mensaje (por ejemplo 'Usuario no autorizado').
      // Solo reactivar el botón para permitir reintento.
      setIsLoading(false);
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      // En caso de excepción, también reactivar botón y limpiar campos.
      setIsLoading(false);
      reset({ identifier: '', password: '' });
    }
  };

  useEffect(() => {
    if (!isSupportModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSupportModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSupportModalOpen]);

  const openSupportModal = () => setIsSupportModalOpen(true);
  const closeSupportModal = () => setIsSupportModalOpen(false);

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeSupportModal();
    }
  };

  return (
    <div className="login-bg">
      <div className="floating-food">🥬</div>
      <div className="floating-food">🍅</div>
      <div className="floating-food">🧅</div>
      <div className="floating-food">🥓</div>
      <div className="floating-food">🍎</div>
      <div className="floating-food">🥕</div>
      <div className="floating-food">🍌</div>
      <div className="floating-food">🍇</div>
      <div className="floating-food">🍊</div>
      <div className="floating-food">🥑</div>
      <div className="floating-food">🍓</div>
      <div className="floating-food">🥝</div>

      <div className="login-card">
        <div className="login-left">
          <img src={logo} alt="logo shucway" className="login-logo" />
          <h2 className="login-title">
            Bienvenido a <span className="rainbow-text">Shucway</span>
          </h2>
          <p className="login-subtitle">Ingresa con tu email y contraseña</p>

          <div className="login-form-container">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="input-group">
                <svg className="input-icon" width="22" height="22" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M10 10a3.333 3.333 0 100-6.667 3.333 3.333 0 000 6.667zM15 16.667a5 5 0 10-10 0"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <Controller
                  name="identifier"
                  control={control}
                  rules={{
                    required: "El correo electrónico o username es requerido",
                  }}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="text"
                      placeholder="Correo electrónico o username"
                      autoComplete="username"
                    />
                  )}
                />
                {errors?.identifier?.message && (
                  <p className="text-red-600">{errors?.identifier?.message as string}</p>
                )}
              </div>

              <div className="input-group password-group">
                <svg className="input-icon" width="22" height="22" viewBox="0 0 20 20" fill="none">
                  <path d="M15.833 9.167H4.167C3.247 9.167 2.5 9.914 2.5 10.833v4.167c0 .92.747 1.667 1.667 1.667h11.666c.92 0 1.667-.746 1.667-1.667v-4.167c0-.92-.746-1.666-1.667-1.666zM5.833 9.167V5.833a4.167 4.167 0 018.334 0v3.334" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <Controller
                  name="password"
                  control={control}
                  rules={{ required: "La contraseña es requerida" }}
                  render={({ field }) => (
                    <input
                      {...field}
                      type={passwordVisible ? "text" : "password"}
                      placeholder="Contraseña"
                      autoComplete="current-password"
                      className="focus:ring-2 focus:ring-primary-green focus:border-primary-green"
                    />
                  )}
                />
                <div
                  className="password-toggle"
                  onClick={() => setPasswordVisible((v) => !v)}
                >
                  {passwordVisible ? <FaEye /> : <FaEyeSlash />}
                </div>
                {errors?.password?.message && (
                  <p className="text-red-600">{errors?.password?.message as string}</p>
                )}
              </div>

              <button
                type="submit"
                className="login-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Cargando...
                  </span>
                ) : (
                  'Iniciar Sesión'
                )}
              </button>
            </form>

            <div className="help-text">
              <p>
                ¿Problemas para ingresar?{' '}
                <button
                  type="button"
                  className="help-link"
                  onClick={openSupportModal}
                >
                  Contacta al administrador
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Right Side - Image */}
        <div className="login-right">
          <button
            type="button"
            className="close-btn"
            onClick={() => navigate("/home")}
          >
            ✕
          </button>
          
          {/* Fading texts on background image */}
          <div className="fading-text text-1">Sistema de Gestión de Restaurante</div>
          <div className="fading-text text-2">Control de Inventario en Tiempo Real</div>
          <div className="fading-text text-3">Gestión de Pedidos Eficiente</div>
          <div className="fading-text text-4">Reportes y Estadísticas Detalladas</div>
        </div>
      </div>

      {isSupportModalOpen && (
        <div
          className="support-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-modal-title"
          onClick={handleOverlayClick}
        >
          <div className="support-modal">
            <button
              type="button"
              className="support-modal-close"
              onClick={closeSupportModal}
              aria-label="Cerrar"
            >
              ✕
            </button>

            <div className="support-modal-header">
              <img
                src="/image/other/logo-umg.png"
                alt="Logo Universidad Mariano Gálvez"
                className="support-modal-logo"
              />
              <h2 id="support-modal-title">Equipo de soporte</h2>
              <p>Comunícate con cualquiera de nuestros integrantes para recibir ayuda inmediata.</p>
            </div>

            <div className="support-modal-grid">
              {SUPPORT_TEAM.map((member) => (
                <div key={member.carne} className="support-card">
                  <div className="support-card-header">
                    <img
                      src="/image/other/logo-umg.png"
                      alt="Logo UMG"
                      className="support-card-logo"
                    />
                    <div>
                      <h3>{member.name}</h3>
                      <p>Carné: {member.carne}</p>
                    </div>
                  </div>

                  <div className="support-card-body">
                    <div>
                      <span className="support-card-label">Teléfono:</span>
                      <a href={`tel:${member.phone}`} className="support-card-link">
                        {member.phone}
                      </a>
                    </div>
                    <div>
                      <span className="support-card-label">Correo:</span>
                      <a href={`mailto:${member.email}`} className="support-card-link">
                        {member.email}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
