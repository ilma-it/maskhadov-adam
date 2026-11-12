@echo off
title Smart Greenhouse - Local Server
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Server stopped with error code %ERRORLEVEL%.
    pause
)