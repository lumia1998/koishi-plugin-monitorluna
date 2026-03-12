"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.name = void 0;
exports.apply = apply;
const koishi_1 = require("koishi");
exports.name = 'screenluna';
exports.Config = koishi_1.Schema.object({
    devices: koishi_1.Schema.array(koishi_1.Schema.object({
        name: koishi_1.Schema.string().description('设备名称'),
        ip: koishi_1.Schema.string().description('设备 IP 地址'),
        port: koishi_1.Schema.number().default(6314).description('截图服务端口')
    })).default([]).description('设备列表')
});
function apply(ctx, config) {
    ctx.command('screen <device:string>', '截取远程设备屏幕')
        .action(async ({ session }, device) => {
        if (!device) {
            return '请指定设备名称';
        }
        if (device === '-l') {
            if (config.devices.length === 0) {
                return '当前没有绑定任何设备';
            }
            return '已绑定设备：\n' + config.devices.map(d => `${d.name}: ${d.ip}:${d.port}`).join('\n');
        }
        const targetDevice = config.devices.find(d => d.name === device);
        if (!targetDevice) {
            return `未找到设备: ${device}`;
        }
        try {
            const response = await ctx.http.get(`http://${targetDevice.ip}:${targetDevice.port}/api/screenshot`, {
                timeout: 10000,
                responseType: 'arraybuffer'
            });
            return koishi_1.h.image(response, 'image/jpeg');
        }
        catch (error) {
            return `截图失败: ${error instanceof Error ? error.message : String(error)}`;
        }
    });
}
