import { Context, Schema, h } from 'koishi'

export const name = 'screenluna'

export interface Config {
  devices: Device[]
}

export interface Device {
  name: string
  ip: string
  port: number
}

export const Config: Schema<Config> = Schema.object({
  devices: Schema.array(Schema.object({
    name: Schema.string().description('设备名称'),
    ip: Schema.string().description('设备 IP 地址'),
    port: Schema.number().default(6314).description('截图服务端口')
  })).default([]).description('设备列表')
})

export function apply(ctx: Context, config: Config) {
  ctx.command('screen <device:string>', '截取远程设备屏幕')
    .action(async ({ session }, device) => {
      if (!device) {
        return '请指定设备名称'
      }

      if (device === '-l') {
        if (config.devices.length === 0) {
          return '当前没有绑定任何设备'
        }
        return '已绑定设备：\n' + config.devices.map(d => `${d.name}: ${d.ip}:${d.port}`).join('\n')
      }

      const targetDevice = config.devices.find(d => d.name === device)
      if (!targetDevice) {
        return `未找到设备: ${device}`
      }

      try {
        const response = await ctx.http.get(`http://${targetDevice.ip}:${targetDevice.port}/api/screenshot`, {
          timeout: 10000,
          responseType: 'arraybuffer'
        })

        return h.image(response, 'image/jpeg')
      } catch (error) {
        return `截图失败: ${error instanceof Error ? error.message : String(error)}`
      }
    })
}
