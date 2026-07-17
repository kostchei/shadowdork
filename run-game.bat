@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
    echo npm was not found. Run install-shadowdork.bat first.
    pause
    exit /b 1
)

echo Starting Shadowdork dev server...
start "Shadowdork Server" cmd /c "npm run dev"
echo Waiting for server to initialize...
timeout /t 2 >nul

set "CHROME_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if defined CHROME_EXE (
    echo Opening game in Google Chrome...
    start "" "%CHROME_EXE%" --new-window "http://localhost:5173"
) else (
    echo Google Chrome was not found. Opening the default browser instead.
    start "" "http://localhost:5173"
)
