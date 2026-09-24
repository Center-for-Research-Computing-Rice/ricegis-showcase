@echo off
rem Double-click after adding/removing photos, or to save the latest Google Sheet into the page.
rem (The live site reads the sheet by itself; this just keeps the built-in copy fresh.)
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is required: https://nodejs.org & pause & exit /b 1)
if not exist node_modules\sharp (
  echo First run: installing the image tool...
  call npm install --no-fund --no-audit
)
call npm run images --silent
echo.
call npm run sheet --silent
echo.
pause
