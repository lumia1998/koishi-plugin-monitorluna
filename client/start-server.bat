@echo off
cd /d "%~dp0"

REM Check local uv.exe
if exist "%~dp0uv.exe" (
    set UV="%~dp0uv.exe"
    goto :run
)

REM Check system uv
where uv >nul 2>&1
if %errorlevel% == 0 (
    set UV=uv
    goto :run
)

REM Download uv to current directory
echo Downloading uv...
powershell -ExecutionPolicy Bypass -Command "$env:UV_INSTALL_DIR='%~dp0'; irm https://astral.sh/uv/install.ps1 | iex"
if exist "%~dp0uv.exe" (
    set UV="%~dp0uv.exe"
    goto :run
)
echo Failed to download uv
pause
exit /b 1

:run
echo Starting MonitorLuna Agent with Python 3.12...
%UV% sync --python 3.12 --link-mode copy
if errorlevel 1 (
    echo Failed to prepare Python environment.
    pause
    exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
    echo Python environment was created, but .venv\Scripts\python.exe was not found.
    pause
    exit /b 1
)

.venv\Scripts\python.exe screenshot-server.py
pause
