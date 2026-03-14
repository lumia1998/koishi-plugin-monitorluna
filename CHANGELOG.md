# Changelog

## [1.0.0] - 2026-03-15

### ✨ 新增功能

- **输入统计 TOP 6**：新增每日输入统计功能，显示各应用的键盘按键、鼠标点击、滚轮滚动次数
- **应用图标显示**：自动提取并显示应用程序图标（Windows）
- **跨平台支持**：Python Agent 支持 Linux 系统（截图、系统状态功能可用）
- **uv 环境管理**：提供 `run` 文件夹，使用 uv 管理依赖，无需预装 Python
- **静默启动**：新增 `start-silent.vbs` 实现无窗口后台启动

### 🎨 界面优化

- 应用名称自动去除 `.exe` 后缀
- 输入统计表格采用进度条可视化设计（参考 keyStats）
- 表头改为文字显示（键盘、鼠标、滚轮）
- 每小时 TOP 4 改为胶囊双色样式（蓝色程序名 + 白色时长）
- 删除容器内部虚线边框，界面更简洁

### 🐛 问题修复

- **修复键盘统计异常**：长按键时不再重复计数，只在首次按下计数
- **修复滚轮统计异常**：从 mouseData 读取实际滚动量，而非每次事件 +1
- **修复图标提取失败**：使用正确的 `win32api.ExtractIconEx` API
- 查询范围改为"今天0点到当前时刻"，确保有数据显示

### 📦 部署改进

- 新增 `run` 文件夹，包含最小运行环境
- 提供 `start.bat`（普通启动）和 `start-silent.vbs`（静默启动）
- 使用 `pyproject.toml` 管理依赖，自动区分 Windows/Linux

### 🔧 技术改进

- 参考 keyStats 实现输入监听逻辑
- 使用 `_pressed_keys` HashSet 防止长按重复计数
- 滚轮统计改为读取 delta 值除以 WHEEL_DELTA (120)
- 图标提取使用 `win32gui.DrawIconEx` 绘制到内存 DC

### 📝 文档更新

- 新增 `IMPLEMENTATION_SUMMARY.md` 实现总结文档
- 更新 `run/README.md` 使用说明
