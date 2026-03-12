@echo off
chcp 65001 >nul
echo 正在启动截图服务...

python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Python 环境
    echo 请访问 https://www.python.org/downloads/ 下载安装 Python
    pause
    exit /b 1
)

echo 检查依赖...
python -c "import flask, pyautogui, PIL" >nul 2>&1
if errorlevel 1 (
    echo 安装依赖中...
    pip install flask pyautogui pillow
)

echo 启动截图服务...
python screenshot-server.py
pause
