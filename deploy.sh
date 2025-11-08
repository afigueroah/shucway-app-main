#!/bin/bash

echo "🚀 Iniciando despliegue..."

# Verificar si estamos en producción
if [ "$NODE_ENV" != "production" ]; then
    echo "⚠️  Advertencia: NODE_ENV no está en 'production'. Configúralo antes de desplegar."
fi

# Instalar dependencias del backend (solo producción)
echo "📦 Instalando dependencias del backend..."
cd backend
npm install --production

# Construir backend
echo "🔨 Construyendo backend..."
npm run build

# Volver a la raíz
cd ..

# Construir frontend
echo "🔨 Construyendo frontend..."
npm run build

echo "✅ Despliegue preparado. Para iniciar el servidor:"
echo "   cd backend && npm start"
echo ""
echo "El servidor servirá tanto la API en /api como el frontend estático."
