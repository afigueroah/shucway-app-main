// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: './',
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
    // Eliminado manualChunks para que React y dependencias críticas estén en el bundle principal
    // Esto previene errores de createContext en librerías que esperan React global antes de cargar estilos
    chunkSizeWarningLimit: 1000, // Aumentar el límite de advertencia a 1000KB
  },
})