# MonitorLuna Agent 运行包

## 快速开始

### Windows

**方式 1：普通启动（有控制台窗口）**
双击 `start.bat`

**方式 2：静默启动（无窗口，后台运行）**
双击 `start-silent.vbs`

首次运行会自动下载 uv 和安装依赖，请耐心等待。

### Linux

```bash
# 安装 uv（如果未安装）
curl -LsSf https://astral.sh/uv/install.sh | sh

# 运行
uv run --project . python screenshot-server.py
```

## 配置

启动后访问 http://127.0.0.1:6315 进行配置。

## 功能支持

| 功能 | Windows | Linux |
|------|---------|-------|
| 截图 | ✅ | ✅ |
| 系统状态 | ✅ | ✅ |
| 窗口监控 | ✅ | ⚠️ 简化 |
| 输入统计 | ✅ | ❌ |
| 应用图标 | ✅ | ❌ |
| 托盘图标 | ✅ | ❌ |

## 依赖说明

本包使用 uv 管理 Python 依赖，无需预装 Python 环境。
uv 会自动下载合适的 Python 版本并安装所需依赖。

## 开机自启（Windows）

1. 按 Win+R，输入 `shell:startup`
2. 创建 `start-silent.vbs` 的快捷方式到启动文件夹
