@echo off
setlocal

set "APP_DIR=%USERPROFILE%\Desktop\plant-speaks\norihau-office"
set "APP_URL=http://127.0.0.1:5174"
set "LOG_FILE=%TEMP%\norihau-office-dev.log"

if not exist "%APP_DIR%\package.json" (
  echo Norihau Office project folder was not found.
  echo %APP_DIR%
  pause
  exit /b 1
)

start "Norihau Office Server" /min cmd /c "cd /d "%APP_DIR%" && call npm.cmd run dev -- --host 127.0.0.1 --port 5174 --strictPort > "%LOG_FILE%" 2>&1"

timeout /t 4 /nobreak >nul
start "" "%APP_URL%"

endlocal
