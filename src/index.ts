import { Context, Schema, h } from 'koishi'
import { IncomingMessage } from 'http'
import { WebSocket } from 'ws'
import {} from '@koishijs/plugin-server'
import * as fs from 'fs/promises'
import * as path from 'path'

export const name = 'screenluna'
export const inject = {
  required: ['server'],
  optional: ['puppeteer']
}

// ── Storage Backend Interface ──
interface StorageBackend {
  upload(buffer: Buffer, filename: string): Promise<{ key: string; url: string }>
  delete(key: string): Promise<void>
  init(): Promise<void>
  cleanup(days: number): Promise<void>
}

// ── Local Storage ──
class LocalStorage implements StorageBackend {
  constructor(private ctx: Context, private config: Config) {}

  async init() {
    const dir = path.join(this.ctx.baseDir, this.config.storagePath || 'data/screenluna')
    await fs.mkdir(dir, { recursive: true })

    // Mount HTTP route
    this.ctx.server.get('/monitorluna/:filename', async (ctx) => {
      try {
        const file = path.join(dir, ctx.params.filename)
        const buf = await fs.readFile(file)
        ctx.type = 'image/jpeg'
        ctx.body = buf
      } catch {
        ctx.status = 404
      }
    })
  }

  async upload(buffer: Buffer, filename: string) {
    const dir = path.join(this.ctx.baseDir, this.config.storagePath || 'data/screenluna')
    const filepath = path.join(dir, filename)
    await fs.writeFile(filepath, buffer)
    const baseUrl = this.config.serverPath || 'http://127.0.0.1:5140'
    return { key: filename, url: `${baseUrl}/monitorluna/${filename}` }
  }

  async delete(key: string) {
    const dir = path.join(this.ctx.baseDir, this.config.storagePath || 'data/screenluna')
    await fs.unlink(path.join(dir, key)).catch(() => {})
  }

  async cleanup(days: number) {
    const dir = path.join(this.ctx.baseDir, this.config.storagePath || 'data/screenluna')
    const cutoff = Date.now() - days * 86400000
    const files = await fs.readdir(dir)
    for (const file of files) {
      const stat = await fs.stat(path.join(dir, file))
      if (stat.mtimeMs < cutoff) await this.delete(file)
    }
  }
}

// ── WebDAV Storage ──
class WebDAVStorage implements StorageBackend {
  constructor(private config: Config) {}

  async init() {}

  async upload(buffer: Buffer, filename: string) {
    const url = `${this.config.webdavEndpoint}/${filename}`
    const auth = Buffer.from(`${this.config.webdavUsername}:${this.config.webdavPassword}`).toString('base64')
    await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': `Basic ${auth}` },
      body: buffer as unknown as BodyInit
    })
    const publicUrl = this.config.webdavPublicUrl || this.config.webdavEndpoint
    return { key: filename, url: `${publicUrl}/${filename}` }
  }

  async delete(key: string) {
    const url = `${this.config.webdavEndpoint}/${key}`
    const auth = Buffer.from(`${this.config.webdavUsername}:${this.config.webdavPassword}`).toString('base64')
    await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Basic ${auth}` } }).catch(() => {})
  }

  async cleanup(days: number) {
    // WebDAV cleanup requires listing - simplified: skip for now
  }
}

// ── S3 Storage ──
class S3Storage implements StorageBackend {
  constructor(private config: Config) {}

  async init() {}

  async upload(buffer: Buffer, filename: string) {
    const url = this.getUrl(filename)
    const headers = await this.signRequest('PUT', filename, buffer)
    await fetch(url, { method: 'PUT', headers, body: buffer as unknown as BodyInit })
    const publicUrl = this.config.s3PublicUrl || url
    return { key: filename, url: publicUrl }
  }

  async delete(key: string) {
    const url = this.getUrl(key)
    const headers = await this.signRequest('DELETE', key)
    await fetch(url, { method: 'DELETE', headers }).catch(() => {})
  }

  async cleanup(days: number) {}

  private getUrl(key: string) {
    const { s3Endpoint, s3Bucket, s3PathStyle } = this.config
    if (!s3Endpoint) throw new Error('s3Endpoint is required')
    if (s3PathStyle) return `${s3Endpoint}/${s3Bucket}/${key}`
    return `${s3Endpoint.replace('://', `://${s3Bucket}.`)}/${key}`
  }

  private async signRequest(method: string, key: string, body?: Buffer) {
    const date = new Date().toUTCString()
    const contentType = 'image/jpeg'
    const resource = `/${this.config.s3Bucket}/${key}`
    const stringToSign = `${method}\n\n${contentType}\n${date}\n${resource}`

    const crypto = await import('crypto')
    const secret = this.config.s3SecretAccessKey || ''
    const signature = crypto.createHmac('sha1', secret)
      .update(stringToSign).digest('base64')

    return {
      'Authorization': `AWS ${this.config.s3AccessKeyId}:${signature}`,
      'Date': date,
      'Content-Type': contentType
    }
  }
}

// ── Config Schema ──
export interface Config {
  token: string
  commandTimeout: number
  storageType: 'local' | 'webdav' | 's3'
  storagePath?: string
  serverPath?: string
  webdavEndpoint?: string
  webdavUsername?: string
  webdavPassword?: string
  webdavPublicUrl?: string
  s3Endpoint?: string
  s3Bucket?: string
  s3Region?: string
  s3AccessKeyId?: string
  s3SecretAccessKey?: string
  s3PublicUrl?: string
  s3PathStyle?: boolean
  imageRetentionDays: number
  pushTargets: Array<{
    deviceId: string
    channelIds: string[]
    pollInterval: number
  }>
  dailySummaryEnabled: boolean
  dailySummaryTime: string
  dailySummaryTargets: Array<{
    deviceId: string
    channelIds: string[]
  }>
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    token: Schema.string().required().description('鉴权 Token，需与 Agent 端一致'),
    commandTimeout: Schema.number().default(15000).description('指令超时时间（毫秒）'),
    storageType: Schema.union(['local', 'webdav', 's3']).default('local').description('存储后端类型'),
  }),
  Schema.union([
    Schema.object({
      storageType: Schema.const('local'),
      storagePath: Schema.string().default('data/screenluna').description('本地存储目录'),
      serverPath: Schema.string().description('Koishi 公网地址（用于生成图片 URL）'),
    }),
    Schema.object({
      storageType: Schema.const('webdav'),
      webdavEndpoint: Schema.string().required().description('WebDAV 端点'),
      webdavUsername: Schema.string().required().description('WebDAV 用户名'),
      webdavPassword: Schema.string().role('secret').required().description('WebDAV 密码'),
      webdavPublicUrl: Schema.string().description('WebDAV 公网访问地址'),
    }),
    Schema.object({
      storageType: Schema.const('s3'),
      s3Endpoint: Schema.string().required().description('S3 端点'),
      s3Bucket: Schema.string().required().description('S3 Bucket'),
      s3Region: Schema.string().default('us-east-1').description('S3 区域'),
      s3AccessKeyId: Schema.string().required().description('Access Key ID'),
      s3SecretAccessKey: Schema.string().role('secret').required().description('Secret Access Key'),
      s3PublicUrl: Schema.string().description('S3 公网访问地址'),
      s3PathStyle: Schema.boolean().default(false).description('使用路径风格 URL'),
    }),
  ]),
  Schema.object({
    imageRetentionDays: Schema.number().default(7).description('图片保存天数'),
    pushTargets: Schema.array(Schema.object({
      deviceId: Schema.string().required().description('设备 ID'),
      channelIds: Schema.array(String).description('推送目标群组（格式: platform:botId:channelId）'),
      pollInterval: Schema.number().default(10000).description('轮询间隔（毫秒）'),
    })).default([]).description('实时推送配置'),
    dailySummaryEnabled: Schema.boolean().default(false).description('启用每日总结'),
    dailySummaryTime: Schema.string().default('22:00').description('每日总结时间（HH:mm）'),
    dailySummaryTargets: Schema.array(Schema.object({
      deviceId: Schema.string().required().description('设备 ID'),
      channelIds: Schema.array(String).description('推送目标群组'),
    })).default([]).description('每日总结推送配置'),
  }),
])

// ── Interfaces ──
interface DeviceConnection {
  ws: WebSocket
  deviceId: string
  pendingCommands: Map<string, {
    resolve: (data: string) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>
}

interface ActivityRecord {
  deviceId: string
  process: string
  title: string
  screenshotUrl: string
  timestamp: Date
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// ── Main Plugin ──
export function apply(ctx: Context, config: Config) {
  const devices = new Map<string, DeviceConnection>()
  const lastKnownApp = new Map<string, { title: string; process: string }>()
  const activityHistory: ActivityRecord[] = []
  const pollTimers: ReturnType<typeof setInterval>[] = []
  let storage: StorageBackend

  // Initialize storage
  if (config.storageType === 'local') storage = new LocalStorage(ctx, config)
  else if (config.storageType === 'webdav') storage = new WebDAVStorage(config)
  else storage = new S3Storage(config)

  ctx.on('ready', async () => {
    await storage.init()
    startCleanupTimer()
    startPushPolling()
    if (config.dailySummaryEnabled) startDailySummary()
  })

  ctx.on('dispose', () => {
    pollTimers.forEach(t => clearInterval(t))
  })

  // WebSocket handler
  ctx.server.ws('/screenluna', (ws: WebSocket, req: IncomingMessage) => {
    let deviceId: string | null = null
    let device: DeviceConnection | null = null

    ws.on('message', (raw) => {
      let msg: any
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        ws.close(1008, 'invalid json')
        return
      }

      if (msg.type === 'hello') {
        if (msg.token !== config.token) {
          ws.send(JSON.stringify({ type: 'error', message: 'invalid token' }))
          ws.close(1008, 'invalid token')
          return
        }
        deviceId = String(msg.device_id || 'unknown')
        device = { ws, deviceId, pendingCommands: new Map() }
        devices.set(deviceId, device)
        ctx.logger.info(`[screenluna] 设备上线: ${deviceId}`)
        ws.send(JSON.stringify({ type: 'hello_ack', message: 'connected' }))
        return
      }

      if (!device) {
        ws.close(1008, 'not authenticated')
        return
      }

      if (msg.type === 'result' && msg.id) {
        const pending = device.pendingCommands.get(msg.id)
        if (pending) {
          clearTimeout(pending.timer)
          device.pendingCommands.delete(msg.id)
          if (msg.ok) pending.resolve(msg.data)
          else pending.reject(new Error(msg.error || 'unknown error'))
        }
      }
    })

    ws.on('close', () => {
      if (deviceId) {
        devices.delete(deviceId)
        ctx.logger.info(`[screenluna] 设备下线: ${deviceId}`)
        if (device) {
          for (const pending of device.pendingCommands.values()) {
            clearTimeout(pending.timer)
            pending.reject(new Error('设备断开连接'))
          }
          device.pendingCommands.clear()
        }
      }
    })

    ws.on('error', (err) => {
      ctx.logger.warn(`[screenluna] WebSocket 错误: ${err.message}`)
    })
  })

  function sendCommand(deviceId: string, cmd: string): Promise<string> {
    const device = devices.get(deviceId)
    if (!device) return Promise.reject(new Error(`设备 "${deviceId}" 不在线`))
    const id = generateId()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        device.pendingCommands.delete(id)
        reject(new Error('指令超时'))
      }, config.commandTimeout)
      device.pendingCommands.set(id, { resolve, reject, timer })
      device.ws.send(JSON.stringify({ type: 'command', id, cmd }))
    })
  }

  function startCleanupTimer() {
    setInterval(() => {
      storage.cleanup(config.imageRetentionDays).catch(e =>
        ctx.logger.warn(`[screenluna] 清理失败: ${e.message}`)
      )
    }, 86400000) // Daily
  }

  function startPushPolling() {
    for (const target of config.pushTargets) {
      const timer = setInterval(async () => {
        try {
          const data = await sendCommand(target.deviceId, 'window_info')
          const info = JSON.parse(data)
          const last = lastKnownApp.get(target.deviceId)

          if (!last || last.process !== info.process || last.title !== info.title) {
            lastKnownApp.set(target.deviceId, { process: info.process, title: info.title })

            const screenshot = await sendCommand(target.deviceId, 'window_screenshot')
            const buf = Buffer.from(screenshot, 'base64')
            const filename = `${target.deviceId}_${Date.now()}.jpg`
            const { url } = await storage.upload(buf, filename)

            activityHistory.push({
              deviceId: target.deviceId,
              process: info.process,
              title: info.title,
              screenshotUrl: url,
              timestamp: new Date()
            })

            const msg = `应用切换: ${info.process}\n${info.title}\n` + h.image(url)
            for (const channelId of target.channelIds) {
              const [platform, selfId, gid] = channelId.split(':')
              await ctx.bots[`${platform}:${selfId}`]?.sendMessage(gid, msg)
            }
          }
        } catch (e) {
          // Device offline, skip
        }
      }, target.pollInterval)
      pollTimers.push(timer)
    }
  }

  function startDailySummary() {
    const [hour, minute] = config.dailySummaryTime.split(':').map(Number)
    setInterval(() => {
      const now = new Date()
      if (now.getHours() === hour && now.getMinutes() === minute) {
        generateDailySummary()
      }
    }, 60000)
  }

  async function generateDailySummary() {
    const today = new Date().toISOString().split('T')[0]
    for (const target of config.dailySummaryTargets) {
      const records = activityHistory.filter(r =>
        r.deviceId === target.deviceId &&
        r.timestamp.toISOString().startsWith(today)
      )
      if (records.length === 0) continue

      const html = buildSummaryHtml(records, target.deviceId)
      const puppeteer = (ctx as any)['puppeteer']
      if (!puppeteer) {
        ctx.logger.warn('[screenluna] puppeteer 服务未启用，跳过每日总结')
        continue
      }
      const buf = await puppeteer.render(html)
      const filename = `summary_${target.deviceId}_${Date.now()}.jpg`
      const { url } = await storage.upload(buf, filename)

      for (const channelId of target.channelIds) {
        const [platform, selfId, gid] = channelId.split(':')
        await ctx.bots[`${platform}:${selfId}`]?.sendMessage(gid, h.image(url))
      }
    }
    activityHistory.length = 0
  }

  function buildSummaryHtml(records: ActivityRecord[], deviceId: string): string {
    const date = new Date().toLocaleDateString('zh-CN')
    const appCount = new Map<string, number>()
    records.forEach(r => appCount.set(r.process, (appCount.get(r.process) || 0) + 1))
    const top3 = [...appCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body{margin:0;padding:40px;background:linear-gradient(180deg,#fbfbf9,#efefe9);font-family:serif;width:600px}
h1{font-size:28px;color:#333;margin:0 0 30px}
.timeline{position:relative;padding-left:30px;border-left:1px solid #e7e5e4}
.item{margin-bottom:20px;position:relative}
.item::before{content:'';position:absolute;left:-34px;top:6px;width:8px;height:8px;border-radius:50%;background:#588157}
.time{font-size:12px;color:#999}
.app{font-size:16px;color:#588157;font-weight:600}
.title{font-size:14px;color:#666;font-style:italic}
.stats{margin-top:40px;padding:20px;background:#f5f5f0;border-radius:8px}
</style></head><body>
<h1>今日活动总结 · ${date}</h1>
<div style="color:#999;margin-bottom:20px">设备: ${deviceId}</div>
<div class="timeline">
${records.map(r => `<div class="item">
<div class="time">${r.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
<div class="app">${r.process}</div>
<div class="title">${r.title}</div>
</div>`).join('')}
</div>
<div class="stats">
<div style="font-weight:600;margin-bottom:10px">最常使用</div>
${top3.map(([app, count]) => `<div>${app}: ${count} 次</div>`).join('')}
</div>
</body></html>`
  }

  // Bot commands
  const monitor = ctx.command('monitor', '远程设备监控')

  monitor.subcommand('.list', '列出所有在线设备')
    .action(() => {
      if (devices.size === 0) return '当前没有在线设备'
      return '在线设备：\n' + [...devices.keys()].map(id => `• ${id}`).join('\n')
    })

  monitor.subcommand('.screen <device:string>', '截取远程设备屏幕')
    .action(async ({ session }, device) => {
      if (!device) return '请指定设备名称'
      try {
        const data = await sendCommand(device, 'screenshot')
        const buf = Buffer.from(data, 'base64')
        return h.image(buf, 'image/jpeg')
      } catch (e) {
        return `截图失败: ${e instanceof Error ? e.message : String(e)}`
      }
    })

  monitor.subcommand('.window <device:string>', '截取远程设备当前活跃窗口')
    .action(async ({ session }, device) => {
      if (!device) return '请指定设备名称'
      try {
        const data = await sendCommand(device, 'window_screenshot')
        const buf = Buffer.from(data, 'base64')
        return h.image(buf, 'image/jpeg')
      } catch (e) {
        return `窗口截图失败: ${e instanceof Error ? e.message : String(e)}`
      }
    })

  monitor.subcommand('.status <device:string>', '查看远程设备系统状态')
    .action(async ({ session }, device) => {
      if (!device) return '请指定设备名称'
      try {
        const data = await sendCommand(device, 'system_status')
        const info = JSON.parse(data)
        let result = `CPU: ${info.cpu_percent.toFixed(1)}%\n`
        result += `内存: ${info.memory.used} MB / ${info.memory.total} MB (${info.memory.percent.toFixed(1)}%)`
        if (info.gpu && info.gpu.length > 0) {
          for (const gpu of info.gpu) {
            result += `\nGPU: ${gpu.name}`
            if (gpu.load >= 0) result += `\n  负载: ${gpu.load.toFixed(1)}%`
            if (gpu.memory_used >= 0) result += `\n  显存: ${gpu.memory_used} MB / ${gpu.memory_total} MB`
            else if (gpu.memory_total > 0) result += `\n  显存: ${gpu.memory_total} MB`
          }
        } else {
          result += '\nGPU: 未检测到独立显卡'
        }
        return result
      } catch (e) {
        return `获取系统状态失败: ${e instanceof Error ? e.message : String(e)}`
      }
    })

  monitor.subcommand('.history <device:string>', '查看当天活动历史')
    .action(async ({ session }, device) => {
      if (!device) return '请指定设备名称'
      const today = new Date().toISOString().split('T')[0]
      const records = activityHistory
        .filter(r => r.deviceId === device && r.timestamp.toISOString().startsWith(today))
        .slice(-10)
      if (records.length === 0) return '今日暂无活动记录'
      return records.map(r =>
        `${r.timestamp.toLocaleTimeString('zh-CN')} - ${r.process}: ${r.title}`
      ).join('\n')
    })
}
