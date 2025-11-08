# Script de diagnóstico para verificar el problema del estado

Write-Host "=== DIAGNÓSTICO DE ESTADO DE GASTOS OPERATIVOS ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar que el backend esté compilado
Write-Host "1. Verificando compilación del backend..." -ForegroundColor Yellow
if (Test-Path "backend\dist\controllers\gastos_operativos.controller.js") {
    $backendModified = (Get-Item "backend\dist\controllers\gastos_operativos.controller.js").LastWriteTime
    Write-Host "   ✓ Backend compilado - Última modificación: $backendModified" -ForegroundColor Green
    
    # Verificar si el archivo compilado contiene 'estado'
    $content = Get-Content "backend\dist\controllers\gastos_operativos.controller.js" -Raw
    if ($content -match "estado") {
        Write-Host "   ✓ El archivo compilado incluye el campo 'estado'" -ForegroundColor Green
    }
    else {
        Write-Host "   ✗ ADVERTENCIA: El archivo compilado NO incluye 'estado'" -ForegroundColor Red
    }
}
else {
    Write-Host "   ✗ Backend NO compilado" -ForegroundColor Red
}

Write-Host ""
Write-Host "2. Próximos pasos:" -ForegroundColor Yellow
Write-Host "   a) Ejecuta el script SQL: database\fix_estado_gastos.sql" -ForegroundColor White
Write-Host "      (Esto actualizará todos los registros existentes a 'activo')" -ForegroundColor Gray
Write-Host ""
Write-Host "   b) Reinicia el servidor backend para aplicar los cambios" -ForegroundColor White
Write-Host "      cd backend" -ForegroundColor Gray
Write-Host "      npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "   c) Reinicia el frontend" -ForegroundColor White
Write-Host "      cd frontend" -ForegroundColor Gray
Write-Host "      npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "=== FIN DEL DIAGNÓSTICO ===" -ForegroundColor Cyan
