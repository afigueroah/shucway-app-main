# Script de despliegue para Windows PowerShell

Write-Host "🚀 Iniciando despliegue..." -ForegroundColor Green

# Verificar NODE_ENV
if ($env:NODE_ENV -ne "production") {
    Write-Host "⚠️  Advertencia: NODE_ENV no está en 'production'. Configúralo antes de desplegar." -ForegroundColor Yellow
}

# Instalar dependencias del backend
Write-Host "📦 Instalando dependencias del backend..." -ForegroundColor Cyan
Set-Location backend
npm install --production

# Construir backend
Write-Host "🔨 Construyendo backend..." -ForegroundColor Cyan
npm run build

# Volver a la raíz
Set-Location ..

# Construir frontend
Write-Host "🔨 Construyendo frontend..." -ForegroundColor Cyan
npm run build

Write-Host "✅ Despliegue preparado. Para iniciar el servidor:" -ForegroundColor Green
Write-Host "   cd backend; npm start" -ForegroundColor White
Write-Host ""
Write-Host "El servidor servirá tanto la API en /api como el frontend estático." -ForegroundColor White
