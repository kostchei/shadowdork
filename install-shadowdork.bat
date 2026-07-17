@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "SHADOWDORK_ROOT=%CD%"

echo Shadowdork Windows setup
echo ========================

where npm >nul 2>nul
if errorlevel 1 (
    where winget >nul 2>nul
    if errorlevel 1 (
        echo Node.js and npm are required, and winget is unavailable.
        echo Install Node.js LTS from https://nodejs.org/ and run this setup again.
        pause
        exit /b 1
    )
    echo Installing Node.js LTS and npm...
    winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
    if errorlevel 1 goto :failed
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
)

set "CHROME_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not defined CHROME_EXE (
    where winget >nul 2>nul
    if errorlevel 1 (
        echo Google Chrome was not found and winget is unavailable.
        echo Install Chrome manually, then run this setup again.
        pause
        exit /b 1
    )
    echo Installing Google Chrome...
    winget install --id Google.Chrome --exact --accept-package-agreements --accept-source-agreements
    if errorlevel 1 goto :failed
)

echo Installing project dependencies...
call npm install
if errorlevel 1 goto :failed

echo Creating the desktop shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=$env:SHADOWDORK_ROOT; $desktop=[Environment]::GetFolderPath('Desktop'); $shell=New-Object -ComObject WScript.Shell; $link=$shell.CreateShortcut((Join-Path $desktop 'Shadowdork.lnk')); $link.TargetPath=(Join-Path $root 'run-game.bat'); $link.WorkingDirectory=$root; $link.IconLocation=((Join-Path $root 'assets\shadowdork.ico') + ',0'); $link.Description='Launch Shadowdork in Google Chrome'; $link.Save()"
if errorlevel 1 goto :failed

echo.
echo Setup complete. Use the Shadowdork shortcut on your desktop.
pause
exit /b 0

:failed
echo.
echo Setup failed. Review the message above and run this file again.
pause
exit /b 1
