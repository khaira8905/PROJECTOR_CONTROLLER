@echo off
REM ============================================================
REM  EventControl - double-click this file to start the app.
REM  First run installs packages (1-3 minutes). Keep this window
REM  open while you use EventControl; close it to stop the app.
REM ============================================================
title EventControl
cd /d "%~dp0"

if not exist "package.json" (
  echo.
  echo  ERROR: package.json not found next to this file.
  echo  Extract the whole ZIP first, then run this file from inside the extracted folder.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed.
  echo  1. Download the LTS version from https://nodejs.org and install it.
  echo  2. Restart your computer, then double-click this file again.
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo.
  echo  Installing packages - first time only, this takes 1-3 minutes...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  ERROR: npm install failed. Take a screenshot of this window for help.
    pause
    exit /b 1
  )
)

echo.
echo  Starting EventControl...
echo  Your browser will open http://localhost:5173 in a few seconds.
echo  Keep this window open. Close it to stop EventControl.
echo.
start "" /min cmd /c "timeout /t 15 /nobreak >nul && start http://localhost:5173"
call npm run dev
pause
