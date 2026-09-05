@echo off
setlocal enabledelayedexpansion
title CharacterBinder
cd /d "%~dp0"

echo.
echo   CharacterBinder
echo   ---------------
echo.

REM --- 1. Is Node.js installed? -------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo   [X] Node.js is not installed.
    echo.
    echo       CharacterBinder needs Node.js to run.
    echo       1. Go to  https://nodejs.org
    echo       2. Download the "LTS" version and install it
    echo       3. Close this window and double-click start.bat again
    echo.
    pause
    exit /b 1
)

REM --- 2. Is it new enough? (Vite needs Node 18+) -------------------------
for /f "tokens=1 delims=." %%v in ('node -v') do set "NODE_MAJOR=%%v"
set "NODE_MAJOR=!NODE_MAJOR:v=!"
if !NODE_MAJOR! LSS 18 (
    for /f %%v in ('node -v') do set "NODE_FULL=%%v"
    echo   [X] Your Node.js is too old ^(!NODE_FULL!^). Version 18 or newer is required.
    echo.
    echo       Install the current LTS from  https://nodejs.org
    echo       then double-click start.bat again.
    echo.
    pause
    exit /b 1
)

REM --- 3. Already running? Just open the browser. -------------------------
netstat -an | findstr ":3737" | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 (
    echo   CharacterBinder is already running.
    echo   Opening http://localhost:3737 ...
    start "" "http://localhost:3737"
    echo.
    REM Brief pause so the message is readable before the window closes.
    REM `ping` is used rather than `timeout`, which fails when stdin is redirected.
    ping -n 4 127.0.0.1 >nul 2>nul
    exit /b 0
)

REM --- 4. Install dependencies. -------------------------------------------
REM Unconditionally, not only when node_modules is missing: after a `git pull`
REM that changes package.json, an existing install is stale and the app fails at
REM import time with something that looks nothing like "run npm install". npm is
REM a fast no-op when the tree already matches the lock file.
if not exist "node_modules" (
    echo   First run - installing dependencies.
    echo   This happens once and takes a minute or two.
    echo.
)
call npm install
if errorlevel 1 (
    echo.
    echo   [X] Dependency install failed. Check your internet connection
    echo       and try again. The error is printed above.
    echo.
    pause
    exit /b 1
)
echo.

REM --- 5. Launch. ---------------------------------------------------------
echo   Starting CharacterBinder at http://localhost:3737
echo   Your browser will open automatically.
echo.
echo   Keep this window open while you work.
echo   Close it ^(or press Ctrl+C^) to stop the app.
echo.

call npm start

REM If we get here the server stopped or failed to start.
echo.
echo   CharacterBinder has stopped.
pause
