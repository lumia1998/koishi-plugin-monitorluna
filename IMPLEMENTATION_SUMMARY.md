# MonitorLuna 增强功能实现总结

## 已完成的功能

### 1. 数据库扩展
- ✅ 新增 `monitorluna_input_stats` 表
- ✅ 字段：deviceId, process, displayName, iconBase64, keyPresses, leftClicks, rightClicks, scrollDistance, timestamp

### 2. Koishi 插件修改 (src/index.ts)
- ✅ 添加 InputStats 接口定义
- ✅ 添加 WebSocket 消息处理器 `handleInputStats`
- ✅ 修改 `buildSummaryHtml` 为异步函数，查询输入统计数据
- ✅ 添加 `formatAppName` 函数去除 .exe 后缀
- ✅ 替换"全天活跃时间 TOP 4"为"输入统计 TOP 6"
- ✅ 每小时 TOP 4 添加应用图标显示
- ✅ 新增 CSS 样式：.input-stats-item, .app-info, .app-icon, .stats-grid, .stat-cell

### 3. Python Agent 修改 (screenshot-server.py)
- ✅ 添加 Windows 钩子监听（键盘 + 鼠标）
- ✅ 实现输入事件统计（按键、左键、右键、滚轮）
- ✅ 实现图标提取功能 `extract_icon_base64`
- ✅ 添加图标缓存机制
- ✅ 新增 `get_input_stats_snapshot` 函数
- ✅ 添加 `_input_stats_sender` 任务（每 60 秒发送一次）
- ✅ 在 Agent 初始化时启动输入监听

## 技术实现细节

### 输入监听
- 使用 `SetWindowsHookExW` 安装低级键盘钩子 (WH_KEYBOARD_LL)
- 使用 `SetWindowsHookExW` 安装低级鼠标钩子 (WH_MOUSE_LL)
- 监听事件：WM_KEYDOWN, WM_LBUTTONDOWN, WM_RBUTTONDOWN, WM_MOUSEWHEEL
- 关联到前台窗口进程

### 图标提取
- 使用 `win32gui.ExtractIconEx` 从可执行文件提取图标
- 使用 win32ui 将图标转换为位图
- 使用 PIL 调整大小为 20x20 并转换为 PNG
- Base64 编码后缓存

### WebSocket 消息格式
```json
{
  "type": "input_stats",
  "device_id": "my-pc",
  "stats": {
    "chrome.exe": {
      "display_name": "chrome",
      "icon_base64": "iVBORw0KGgo...",
      "key_presses": 1234,
      "left_clicks": 567,
      "right_clicks": 89,
      "scroll_distance": 12345.0
    }
  }
}
```

## 测试步骤

1. 启动 Python Agent：`python screenshot-server.py`
2. 启动 Koishi 服务器
3. 使用一段时间后执行：`monitor.analytics <device_id>`
4. 检查生成的图片是否包含：
   - 应用名称无 .exe 后缀
   - 应用图标正常显示
   - 输入统计 TOP 6 部分（键盘、鼠标、滚轮数据）
   - 每小时 TOP 4 带图标

## 文件清单

### 已修改
- `src/index.ts` - Koishi 插件主文件
- `screenshot-server.py` - Python Agent
- `release/screenshot-server.py` - 发布版本

### 已复制到测试环境
- `F:/Lumia/Desktop/test/koishi/app/node_modules/koishi-plugin-monitorluna/`

## 注意事项

1. **性能**：输入钩子会增加 CPU 占用，已优化为每 60 秒批量发送
2. **兼容性**：如果没有输入统计数据，会显示"暂无输入统计数据"
3. **图标处理**：某些应用可能无法提取图标，会优雅降级（不显示图标）
4. **依赖**：需要 pywin32 库支持 Windows API 调用
