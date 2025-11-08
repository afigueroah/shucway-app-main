#!/bin/bash

echo "🚀 Iniciando proceso de build..."

# Instalar dependencias de la raíz (frontend)
echo "📦 Instalando dependencias del frontend..."
npm install

# Construir backend
echo "🔨 Construyendo backend..."
npm run build:backend

# Construir frontend
echo "🔨 Construyendo frontend..."
npm run build

echo "✅ Build completado exitosamente!"