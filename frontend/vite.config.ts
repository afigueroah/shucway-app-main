// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: './dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor libraries
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('antd') || id.includes('@ant-design') || id.includes('lucide-react')) {
              return 'ui-vendor';
            }
            if (id.includes('react-hook-form')) {
              return 'form-vendor';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'query-vendor';
            }
            if (id.includes('recharts')) {
              return 'chart-vendor';
            }
            if (id.includes('supabase')) {
              return 'supabase-vendor';
            }
            if (id.includes('dayjs') || id.includes('date-fns')) {
              return 'date-vendor';
            }
            // Other node_modules go to vendor
            return 'vendor';
          }

          // Application chunks - dividir por funcionalidades principales
          if (id.includes('/src/features/Login/') ||
              id.includes('/src/context/AuthContext') ||
              id.includes('/src/hooks/useAuth') ||
              id.includes('/src/api/authService') ||
              id.includes('/src/api/handleLogin') ||
              id.includes('/src/api/handleLogout') ||
              id.includes('/src/api/validateToken')) {
            return 'auth';
          }

          if (id.includes('/src/features/Dashboard/Inicio') ||
              id.includes('/src/features/Dashboard/Perfil') ||
              id.includes('/src/views/Dashboard')) {
            return 'dashboard-core';
          }

          if (id.includes('/src/features/Dashboard/Inventario') ||
              id.includes('/src/api/inventarioService') ||
              id.includes('/src/api/productosService')) {
            return 'inventory';
          }

          if (id.includes('/src/features/Dashboard/Ventas') ||
              id.includes('/src/api/ventasService')) {
            return 'sales';
          }

          if (id.includes('/src/features/Dashboard/Administracion') ||
              id.includes('/src/components/UsuariosTable') ||
              id.includes('/src/components/Drawer/') ||
              id.includes('/src/api/usuariosService') ||
              id.includes('/src/api/addUsuario') ||
              id.includes('/src/api/editUsuario') ||
              id.includes('/src/api/deleteUsuario') ||
              id.includes('/src/api/getUsuario') ||
              id.includes('/src/api/getUsuarios') ||
              id.includes('/src/api/rolesService')) {
            return 'admin';
          }

          if (id.includes('/src/features/Dashboard/Reportes') ||
              id.includes('/src/api/dashboardService')) {
            return 'reports';
          }

          if (id.includes('/src/features/Dashboard/Configuracion')) {
            return 'settings';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000, // Aumentar el límite de advertencia a 1000KB
  },
})