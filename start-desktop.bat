@echo off
setlocal enabledelayedexpansion
title CharacterBinder (Desktop)
cd /d "%~dp0"

echo.
echo   CharacterBinder - Desktop App
echo   ----------------------------
echo.
echo   This runs CharacterBinder in its own window instead of a browser tab.
echo   It needs Rust in addition to Node.js.
echo.
echo   Just want to use the app? Double-click start.bat instead - it only
echo   needs Node.js and opens in your browser.
echo.

REM --- 1. Node.js ---------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo   [X] Node.js is not installed. Get the LTS build from https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -v') do set "NODE_MAJOR=%%v"
set "NODE_MAJOR=!NODE_MAJOR:v=!"
if !NODE_MAJOR! LSS 18 (
    echo   [X] Node.js 18 or newer is required. Update from https://nodejs.org
    echo.
    pause
    exit /b 1
)

REM --- 2. Rust ------------------------------------------------------------
where cargo >nul 2>nul
if errorlevel 1 (
    echo   [X] Rust is not installed.
    echo.
    echo       The desktop build compiles a small Rust shell around the app.
    echo       1. Go to  https://rustup.rs  and run the installer
    echo       2. Close this window and double-click start-desktop.bat again
    echo.
    echo       Or skip it entirely - start.bat runs the same app in your browser.
    echo.
    pause
    exit /b 1
)

REM --- 3. Dependencies ----------------------------------------------------
if not exist "node_modules" (
    echo   Installing dependencies. This happens once.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo   [X] Dependency install failed. The error is printed above.
        echo.
        pause
        exit /b 1
    )
    echo.
)

REM --- 4. Launch ----------------------------------------------------------
echo   Starting the desktop app.
echo   The first launch compiles Rust and can take several minutes.
echo   Later launches are fast.
echo.

call npm run tauri:dev

echo.
echo   CharacterBinder has stopped.
pause
