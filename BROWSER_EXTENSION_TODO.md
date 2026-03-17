# 浏览器扩展优化待办

## 当前状态
- ✅ 浏览器扩展和油猴脚本已添加到 main 分支
- ✅ Agent 端已支持 SQLite 本地存储
- ⚠️ 浏览器活动数据尚未集成到 SQLite 架构

## 待完成的关键优化

### 1. Agent 端集成（screenshot-server.py）

#### 1.1 添加浏览器活动数据库表
在 `init_database()` 函数中添加：
```python
cursor.execute("""
    CREATE TABLE IF NOT EXISTS browser_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL,
        seconds INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
""")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_browser_activity_timestamp ON browser_activity(timestamp)")
```

#### 1.2 添加消息处理
在 `MonitorLunaAgent._run_once()` 的消息处理部分添加：
```python
if msg.type === 'browser_activity':
    if not deviceId:
        ws.close(1008, 'not authenticated')
        return
    handleBrowserActivity(deviceId, msg).catch(e => ...)
    return
```

#### 1.3 添加存储函数
```python
def save_browser_activity_to_db(stats: dict):
    """保存浏览器活动到本地数据库"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        timestamp = datetime.now().isoformat()
        for domain, seconds in stats.items():
            cursor.execute("""
                INSERT INTO browser_activity (domain, seconds, timestamp)
                VALUES (?, ?, ?)
            """, (domain, seconds, timestamp))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Failed to save browser activity: {e}")
```

### 2. 浏览器脚本优化

#### 2.1 指数退避重连（background.js 和 monitorluna.user.js）
```javascript
let reconnectDelay = 3000;
function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, 60000); // 3s → 6s → 12s → 30s → 60s
}

// 连接成功后重置
ws.onopen = () => {
  reconnectDelay = 3000;
  // ...
};
```

#### 2.2 离线数据缓存（background.js）
```javascript
// 保存未发送的数据
async function savePendingStats() {
  await chrome.storage.local.set({ pendingStats });
}

// 加载未发送的数据
async function loadPendingStats() {
  const data = await chrome.storage.local.get(['pendingStats']);
  if (data.pendingStats) {
    pendingStats = data.pendingStats;
  }
}

// 在 init() 中加载
await loadPendingStats();

// 定期保存
setInterval(savePendingStats, 60000); // 每分钟保存一次
```

#### 2.3 油猴脚本离线缓存（monitorluna.user.js）
```javascript
// 保存到 GM_setValue
function savePendingStats() {
  GM_setValue('pending_stats', JSON.stringify(pendingStats));
}

// 加载
const saved = GM_getValue('pending_stats', '{}');
try {
  pendingStats = JSON.parse(saved);
} catch {}

// 定期保存
setInterval(savePendingStats, 60000);
```

### 3. Koishi 插件端集成（src/index.ts）

#### 3.1 添加数据库表
```typescript
ctx.model.extend('monitorluna_browser_activity', {
  id: 'unsigned',
  deviceId: 'string',
  domain: 'string',
  seconds: 'unsigned',
  timestamp: 'timestamp'
}, { autoInc: true })
```

#### 3.2 添加消息处理
在 WebSocket handler 中添加：
```typescript
if (msg.type === 'browser_activity') {
  if (!deviceId) {
    ws.close(1008, 'not authenticated')
    return
  }
  handleBrowserActivity(deviceId, msg).catch(e => ...)
  return
}
```

#### 3.3 添加处理函数
```typescript
async function handleBrowserActivity(deviceId: string, msg: any) {
  const stats = msg.stats
  if (!stats) return
  try {
    const now = new Date()
    const rows = Object.entries(stats).map(([domain, seconds]) => ({
      deviceId,
      domain,
      seconds: Number(seconds),
      timestamp: now
    }))
    await ctx.database.create('monitorluna_browser_activity', rows)
  } catch (e) {
    ctx.logger.warn(`[monitorluna] 记录浏览器活动失败: ${e.message}`)
  }
}
```

## 优先级
1. **高优先级**：Agent 端集成（数据库表 + 消息处理）
2. **中优先级**：浏览器脚本重连优化
3. **低优先级**：离线缓存（可选功能）

## 测试清单
- [ ] Agent 端能接收并存储 browser_activity 消息
- [ ] 浏览器扩展能正常连接并上报数据
- [ ] 油猴脚本能正常工作
- [ ] 重连机制正常（断网后能自动重连）
- [ ] 数据持久化正常（重启后数据不丢失）
