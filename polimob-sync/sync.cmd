@echo off
title OCRE Polimob Sync
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ProgramData%\OCRE\PolimobSync\sync.ps1"
echo.
pause
