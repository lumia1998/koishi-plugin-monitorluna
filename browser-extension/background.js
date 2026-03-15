// MonitorLuna Browser Extension - Background Service Worker
// Tracks active foreground tab time per domain, reports via WebSocket

const REPORT_INTERVAL_MS = 30000; // 30 seconds

let ws = null;
let wsConnected = false;
let config = { url: '', token: '', deviceId: '' };

// domain -> accumulated seconds (since last report)
let pendingStats = {};

// Currently tracked tab
let activeTabId = null;
let activeTabDomain = null;
let trackingStartTime = null;
let windowFocused = true;

// ── Config ────────────────────────────────────────────────────────────────────
async function loadConfig() {
  const data = await chrome.storage.local.get(['url', 'token', 'deviceId']);
  config.url = data.url || '';
  config.token = data.token || '';
  config.deviceId = data.deviceId || '';
}

// ── Domain extraction ─────────────────────────────────────────────────────────
function extractDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname;
  } catch {
    return null;
  }
}

// ── Time tracking ─────────────────────────────────────────────────────────────
function flushCurrentTab() {
  if (activeTabDomain && trackingStartTime && windowFocused) {
    const elapsed = (Date.now() - trackingStartTime) / 1000; // seconds
    if (elapsed > 0.5) {
      pendingStats[activeTabDomain] = (pendingStats[activeTabDomain] || 0) + elapsed;
    }
  }
  trackingStartTime = null;
}

function startTracking(tabId, domain) {
  flushCurrentTab();
  activeTabId = tabId;
  activeTabDomain = domain;
  if (domain && windowFocused) {
    trackingStartTime = Date.now();
  }
}

function stopTracking() {
  flushCurrentTab();
  activeTabId = null;
  activeTabDomain = null;
  trackingStartTime = null;
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
function connect() {
  if (!config.url || !config.token || !config.deviceId) return;
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }

  try {
    ws = new WebSocket(config.url);
  } catch {
    wsConnected = false;
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    ws.send(JSON.stringify({
      type: 'hello',
      token: config.token,
      device_id: config.deviceId,
    }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'hello_ack') {
        wsConnected = true;
      }
    } catch {}
  };

  ws.onerror = () => {
    wsConnected = false;
  };

  ws.onclose = () => {
    wsConnected = false;
    ws = null;
    scheduleReconnect();
  };
}

let reconnectTimer = null;
function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 10000);
}

function sendStats() {
  // Flush current tab before reporting
  if (activeTabDomain && trackingStartTime && windowFocused) {
    const elapsed = (Date.now() - trackingStartTime) / 1000;
    if (elapsed > 0.5) {
      pendingStats[activeTabDomain] = (pendingStats[activeTabDomain] || 0) + elapsed;
    }
    trackingStartTime = Date.now(); // reset start time so we don't double-count
  }

  if (!wsConnected || !ws || Object.keys(pendingStats).length === 0) return;

  // Round seconds and remove zero entries
  const stats = {};
  for (const [domain, secs] of Object.entries(pendingStats)) {
    const rounded = Math.round(secs);
    if (rounded > 0) stats[domain] = rounded;
  }
  if (Object.keys(stats).length === 0) return;

  try {
    ws.send(JSON.stringify({
      type: 'browser_activity',
      device_id: config.deviceId,
      token: config.token,
      stats,
    }));
    pendingStats = {};
  } catch {
    wsConnected = false;
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const domain = extractDomain(tab.url);
    startTracking(activeInfo.tabId, domain);
  } catch {
    stopTracking();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId !== activeTabId) return;
  if (changeInfo.url || changeInfo.status === 'complete') {
    const domain = extractDomain(tab.url);
    startTracking(tabId, domain);
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Window lost focus
    windowFocused = false;
    flushCurrentTab();
    trackingStartTime = null;
  } else {
    windowFocused = true;
    if (activeTabDomain) {
      trackingStartTime = Date.now();
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) stopTracking();
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await loadConfig();
  connect();

  // Get current active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) {
      startTracking(tab.id, extractDomain(tab.url));
    }
  } catch {}

  // Periodic reporting
  setInterval(sendStats, REPORT_INTERVAL_MS);
}

// Listen for config updates from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'config_updated') {
    loadConfig().then(() => {
      wsConnected = false;
      if (ws) { try { ws.close(); } catch {} ws = null; }
      connect();
    });
  }
});

init();
