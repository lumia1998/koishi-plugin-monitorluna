#!/usr/bin/env python3
"""
远程截图服务端
在需要被截图的设备上运行此脚本
"""
from flask import Flask, send_file
import pyautogui
import io

app = Flask(__name__)

@app.route('/api/screenshot')
def screenshot():
    img = pyautogui.screenshot()
    img_io = io.BytesIO()
    img.save(img_io, 'JPEG', quality=85)
    img_io.seek(0)
    return send_file(img_io, mimetype='image/jpeg')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=6314)
