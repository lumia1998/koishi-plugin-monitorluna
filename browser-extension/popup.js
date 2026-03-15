// popup.js - MonitorLuna Extension Settings

let statusInterval = null;

async function load() {
  const data = await chrome.storage.local.get(['url', 'token', 'deviceId']);
  document.getElementById('url').value = data.url || '';
  document.getElementById('token').value = data.token || '';
  document.getElementById('deviceId').value = data.deviceId || '';
  updateStatus();
  statusInterval = setInterval(updateStatus, 2000);
}

async function updateStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'get_status' });
    const dot = document.getElementById('dot');
    const text = document.getElementById('statusText');

    if (response && response.connected) {
      dot.className = 'status-dot connected';
      text.textContent = '已连接';
    } else if (response && response.connecting) {
      dot.className = 'status-dot connecting';
      text.textContent = '连接中';
    } else {
      dot.className = 'status-dot disconnected';
      text.textContent = '未连接';
    }
  } catch {
    document.getElementById('dot').className = 'status-dot disconnected';
    document.getElementById('statusText').textContent = '未连接';
  }
}

document.getElementById('save').addEventListener('click', async () => {
  const url = document.getElementById('url').value.trim();
  const token = document.getElementById('token').value.trim();
  const deviceId = document.getElementById('deviceId').value.trim();

  if (!url || !token || !deviceId) {
    showToast('请填写所有字段', false);
    return;
  }

  await chrome.storage.local.set({ url, token, deviceId });
  chrome.runtime.sendMessage({ type: 'config_updated' });
  showToast('已保存，正在连接...', true);
  setTimeout(updateStatus, 1000);
});

function showToast(msg, ok) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + (ok ? 'ok' : 'err');
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

window.addEventListener('unload', () => {
  if (statusInterval) clearInterval(statusInterval);
});

load();
