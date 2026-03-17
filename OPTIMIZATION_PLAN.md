# MonitorLuna 优化方案

## 1. 客户端本地 SQLite 存储

### 目标
- 减轻 Koishi 服务器压力
- 活动记录、输入统计存储在客户端本地
- Icon 通过 hash 去重，只上传新 icon

### 实现
- Agent 端引入 SQLite 数据库
- 表结构：
  - `activity`: 窗口活动记录
  - `input_stats`: 输入统计（按应用）
  - `icons`: Icon 数据（hash 为主键）
- 只在 Koishi 请求时才发送数据（如生成每日总结）

## 2. S3 签名升级到 V4

### 当前问题
- 使用 AWS Signature V2（SHA1）
- 部分区域不支持，安全性较低

### 改进
- 升级到 AWS Signature V4（SHA256）
- 支持所有 S3 兼容服务

## 3. WebDAV 和 S3 定期清理

### WebDAV
- 实现 PROPFIND 列出文件
- 按 mtime 删除过期文件

### S3
- 实现 ListObjectsV2 API
- 按 LastModified 删除过期文件

## 4. 架构调整

### 数据流
**旧架构**：
```
Agent → 实时发送所有数据 → Koishi → 存储到数据库
```

**新架构**：
```
Agent → 本地 SQLite 存储 → 按需查询/定期同步摘要 → Koishi
Icon → hash 去重 → 仅新 icon 上传 → Koishi
```

### 优势
- Koishi 数据库压力大幅降低
- 网络传输量减少
- 客户端可离线工作，重连后补发摘要
