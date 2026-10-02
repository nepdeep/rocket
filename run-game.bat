@echo off
setlocal
title Little Rocket: Moon Mail Delivery

rem ---- Check Node.js ----
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get it from https://nodejs.org ^(version 18 or newer^).
  pause
  exit /b 1
)

rem ---- Get the code if this script is not already inside the project ----
if not exist "%~dp0package.json" (
  where git >nul 2>nul
  if errorlevel 1 (
    echo Git is not installed. Get it from https://git-scm.com
    pause
    exit /b 1
  )
  if not exist "%~dp0rocket" (
    git clone https://github.com/nepdeep/rocket.git "%~dp0rocket" || goto :fail
  )
  cd /d "%~dp0rocket"
  git checkout claude/brave-turing-pfoztd || goto :fail
) else (
  cd /d "%~dp0"
)

rem ---- Install packages (first run only) ----
if not exist "node_modules" (
  echo Installing packages...
  call npm install || goto :fail
)

rem ---- Choose what to do ----
echo.
echo   1 = Play now (opens in your browser)
echo   2 = Build one offline file (dist\index.html)
echo.
set /p CHOICE=Type 1 or 2 and press Enter:

if "%CHOICE%"=="2" (
  call npm run build || goto :fail
  echo.
  echo Done! Opening dist\index.html ...
  start "" "%cd%\dist\index.html"
  pause
  exit /b 0
)

echo Starting the game. Close this window to stop it.
start "" cmd /c "timeout /t 4 >nul & start http://localhost:5173"
call npm run dev
exit /b 0

:fail
echo.
echo Something went wrong. See the messages above.
pause
exit /b 1
