# koishi-plugin-monitorluna

[![npm](https://img.shields.io/npm/v/koishi-plugin-monitorluna?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-monitorluna)

`koishi-plugin-monitorluna` 通过本地 Windows Agent 与 Koishi 建立 WebSocket 连接，提供远程截图、系统状态查看、前台窗口追踪、输入统计、浏览器站点统计与每日总结图片生成能力。

## 功能概览

- 远程截图：支持全屏截图和当前活跃窗口截图。
- 系统状态：查看 CPU、内存、GPU 使用情况。
- 窗口活动追踪：记录前台应用与窗口标题变化。
- 输入统计：按应用汇总键盘、鼠标、滚轮使用次数。
- 浏览器站点统计：单独统计浏览器网页活动，并将同站点子域名聚合显示。
- 每日总结图：生成包含应用时长占比、输入 TOP 6、每小时 TOP 4、浏览器 TOP 4 的总结图。
- 多存储后端：支持本地、WebDAV、S3 三种图片存储方式。

## 安装

### Koishi 插件

安装 `koishi-plugin-monitorluna`，并确保同时具备：

- `@koishijs/plugin-server`
- 任意数据库插件，例如 SQLite / MySQL / PostgreSQL
- `@koishijs/plugin-puppeteer`，仅在需要生成总结图时安装

### Windows Agent

Agent 文件位于 [`client/`](./client) 目录。

推荐方式：

1. 运行 [`client/start-server.bat`](./client/start-server.bat)
2. 如需静默启动，运行 [`client/start-silent.vbs`](./client/start-silent.vbs)
3. 首次启动会自动下载 `uv`，并使用 Python 3.12 创建独立虚拟环境

手动运行方式：

```bash
cd client
uv run --python 3.12 screenshot-server.py
```

## Agent 配置

启动后访问 `http://127.0.0.1:6315` 打开本地配置页面。

主要配置项：

- `Koishi WebSocket URL`：例如 `ws://127.0.0.1:5140/monitorluna`
- `Token`：必须与 Koishi 插件配置一致
- `Device ID`：设备唯一标识
- `浏览器扩展密码`：浏览器脚本连接 `ws://127.0.0.1:6315/ws/browser` 时使用，可留空

Agent 会在 `client/monitorluna.db` 中保存：

- 前台活动记录
- 输入统计
- 浏览器站点统计
- 图标缓存

## 浏览器统计

仓库中附带油猴脚本：[`client/monitorluna.user.js`](./client/monitorluna.user.js)

使用方式：

1. 安装 Tampermonkey 或 Violentmonkey
2. 导入 [`client/monitorluna.user.js`](./client/monitorluna.user.js)
3. 在脚本菜单中配置本地 Agent 地址，默认 `ws://127.0.0.1:6315/ws/browser`
4. 如已设置浏览器扩展密码，脚本中也需要填写相同 token

浏览器统计规则：

- 浏览器多个窗口仍归属于同一个桌面应用，例如 `chrome.exe`
- 网页活动单独统计，不混入桌面应用输入统计
- 同一站点及其子域名会聚合显示，例如 GitHub 相关页面会统一归为一类
- 展示名优先使用基础站点标题，而不是直接显示完整域名

## 每日总结图

当前总结图默认包含：

- 应用时长占比饼图
- TOP 6 应用输入统计
- 浏览器记录 TOP 4
- 每小时 TOP 4

## Koishi 配置

基础配置：

- `token`：Agent 握手 token
- `commandTimeout`：命令超时时间，默认 `15000`
- `debug`：是否输出调试日志

存储配置：

- `storageType=local`：使用 `storagePath` 保存图片，本地 URL 基于 `serverPath` 或 Koishi `selfUrl` 生成
- `storageType=webdav`：需要 `webdavEndpoint`、`webdavUsername`、`webdavPassword`
- `storageType=s3`：需要 `s3Endpoint`、`s3Bucket`、`s3AccessKeyId`、`s3SecretAccessKey`

推送配置：

- `pushChannelIds`：群聊目标，格式 `platform:selfId:channelId`
- `pushPrivateIds`：私聊目标，格式 `platform:selfId:userId`
- `pushPollInterval`：窗口切换轮询间隔
- `dailySummaryEnabled`：是否启用每日总结推送
- `dailySummaryTime`：每日总结时间，格式 `HH:mm`

## 命令

- `monitor.list`：列出在线设备
- `monitor.screen <设备ID>`：截取设备全屏并返回图片
- `monitor.window <设备ID>`：截取当前活跃窗口并返回图片
- `monitor.status <设备ID>`：查看设备 CPU / 内存 / GPU 状态
- `monitor.analytics <设备ID>`：生成当天活动总结图

## 项目结构

```text
koishi-plugin-monitorluna/
├── src/
│   └── index.ts
├── client/
│   ├── screenshot-server.py
│   ├── start-server.bat
│   ├── start-silent.vbs
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── uv.lock
│   └── monitorluna.user.js
├── .github/workflows/release.yml
├── package.json
├── CHANGELOG.md
└── readme.md
```

## 发布说明

为 `v*` tag 推送后，GitHub Actions 会自动从 `client/` 目录打包 `monitorluna-agent.zip` 并创建 Release。
