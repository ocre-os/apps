@echo off
setlocal
title OCRE Polimob Sync - Instalador
net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Solicitando permisos de administrador...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
set "DEST=%ProgramData%\OCRE\PolimobSync"
set "BASE=https://raw.githubusercontent.com/ocre-os/apps/main/polimob-sync"
set "VERSION=0.6.2"
if not exist "%DEST%" mkdir "%DEST%"
echo Instalando OCRE Polimob Sync v%VERSION%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} ('%BASE%/sync.ps1?v='+[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) -OutFile '%DEST%\sync.ps1.tmp'; if((Get-Content -Raw '%DEST%\sync.ps1.tmp') -notmatch '\$SyncVersion = \"%VERSION%\"'){ throw 'Version descargada incorrecta' }; Move-Item -Force '%DEST%\sync.ps1.tmp' '%DEST%\sync.ps1'"
if errorlevel 1 goto :error
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} ('%BASE%/sync.cmd?v='+[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) -OutFile '%DEST%\sync.cmd'"
if errorlevel 1 goto :error
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing -Headers @{'Cache-Control'='no-cache'} ('%BASE%/configure.ps1?v='+[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) -OutFile '%DEST%\configure.ps1'"
if errorlevel 1 goto :error
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $d=[Environment]::GetFolderPath('Desktop'); $s=$ws.CreateShortcut($d+'\OCRE Polimob Sync.lnk'); $s.TargetPath='%DEST%\sync.cmd'; $s.WorkingDirectory='%DEST%'; $s.Save(); $c=$ws.CreateShortcut($d+'\Configurar OCRE Polimob Sync.lnk'); $c.TargetPath='powershell.exe'; $c.Arguments='-NoProfile -ExecutionPolicy Bypass -File ""%DEST%\configure.ps1""'; $c.WorkingDirectory='%DEST%'; $c.Save()"
echo.
echo Instalacion terminada: OCRE Polimob Sync v%VERSION%.
echo Se creo "OCRE Polimob Sync" en el Escritorio.
echo.
echo La primera sincronizacion puede solicitar inicio de sesion en GitHub.
pause
exit /b 0
:error
echo.
echo No fue posible descargar los componentes del sincronizador.
pause
exit /b 1
