// popup.js - MonitorLuna Extension Settings

async function load() {
  const data = await chrome.storage.local.get(['url', 'token', 'deviceId']);
  document.getElementById('url').value = data.url || '';
  document.getElementById('token').value = data.token || '';
  document.getElementById('deviceId').value = data.deviceId || '';
}

document.getElementById('save').addEventListener('click', async () => {
  const url = document.getElementById('url').value.trim();
  const token = document.getElementById('token').value.trim();
  const deviceId = document.getElementById('deviceId').value.trim();

  if (!url || !token || !deviceId) {
    showStatus('请填写所有字段', false);
    return;
  }

  await chrome.storage.local.set({ url, token, deviceId });
  chrome.runtime.sendMessage({ type: 'config_updated' });
  showStatus('已保存，正在重新连接...', true);
});

function showStatus(msg, ok) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status ' + (ok ? 'ok' : 'error');
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

load();
