@echo off
cd /d "%~dp0"

REM 检查本地 uv.exe 是否存在
if exist "%~dp0uv.exe" (
    set UV="%~dp0uv.exe"
    goto :run
)

REM 检查系统 PATH 中是否有 uv
where uv >nul 2>&1
if %errorlevel% == 0 (
    set UV=uv
    goto :run
)

REM 下载 uv 到当前目录
echo 正在下载 uv 包管理器...
powershell -ExecutionPolicy Bypass -Command "$env:UV_INSTALL_DIR='%~dp0'; irm https://astral.sh/uv/install.ps1 | iex"
if exist "%~dp0uv.exe" (
    set UV="%~dp0uv.exe"
    goto :run
)
echo uv 下载失败，请检查网络连接后重试
pause
exit /b 1

:run
echo 正在启动 MonitorLuna Agent...
%UV% run --project "%~dp0" python "%~dp0screenshot-server.py"
pause
