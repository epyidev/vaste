@echo off
REM ====================================
REM  Vaste Game Server - Windows Launcher
REM ====================================

echo.
echo  ====================================
echo   VASTE GAME SERVER
echo  ====================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Display Node.js version
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [INFO] Node.js version: %NODE_VERSION%

REM Check if npm dependencies are installed
if not exist "vaste\node_modules\" (
    echo [WARN] Dependencies not found!
    echo [INFO] Installing dependencies...
    cd vaste
    call npm install
    cd ..
    echo.
)

REM Start the server
echo [INFO] Starting Vaste Game Server...
echo [INFO] Press Ctrl+C to stop the server
echo.

cd vaste
node server.js

REM If server crashes, pause to see error
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Server crashed with error code %ERRORLEVEL%
    echo.
    pause
)
