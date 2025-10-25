'use strict';

const { spawn } = require('child_process');
const net = require('net');
const { session, BrowserWindow } = require('electron');
const windows = require('./windows.ts');
const { readTorConfig } = require('./tor-settings.ts');

const TOR_HOST = '127.0.0.1';
const TOR_PORT = 9050;

let torChild = null;
let torState = { enabled: false, starting: false, reason: null };

function sendTorState(win) {
  const target = win || windows.getMainWindow();
  if (target && !target.isDestroyed?.()) {
    try {
      target.webContents.send('tor:state', { enabled: torState.enabled, reason: torState.reason || null });
    } catch {}
  }
}

function waitForPort(host, port, timeoutMs = 30000, intervalMs = 250) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const sock = net.connect({ host, port }, () => { sock.destroy(); resolve(true); });
      sock.on('error', () => {
        sock.destroy();
        if (Date.now() - started > timeoutMs) reject(new Error('timeout'));
        else setTimeout(check, intervalMs);
      });
    };
    check();
  });
}

async function applyProxy(enabled) {
  const rules = enabled
    ? `socks5://${TOR_HOST}:${TOR_PORT}`
    : '';
  await session.defaultSession.setProxy({ proxyRules: rules, proxyBypassRules: 'localhost,127.0.0.1' });
}

async function startTorAndProxy(winForFeedback, options = {}) {
  if (torState.enabled || torState.starting) return;
  let containerId = typeof options === 'object' && options && typeof options.containerId === 'string'
    ? options.containerId.trim()
    : '';
  if (!containerId) {
    try {
      const stored = await readTorConfig();
      containerId = stored?.containerId?.trim?.() || '';
    } catch {}
  }
  if (!containerId) {
    torState = { enabled: false, starting: false, reason: 'Libertine container identifier missing' };
    sendTorState(winForFeedback);
    return;
  }
  torState = { enabled: false, starting: true, reason: null };
  sendTorState(winForFeedback);

  const quick = new Promise((resolve) => {
    const socket = net.connect({ host: TOR_HOST, port: TOR_PORT }, () => { socket.destroy(); resolve(true); });
    socket.on('error', () => { try { socket.destroy(); } catch {} resolve(false); });
  });
  const alreadyUp = await quick;

  if (!alreadyUp) {
    try {
      torChild = spawn('libertine-launch', ['-i', containerId, 'tor'], {
        stdio: 'ignore',
        detached: true
      });
    } catch (err) {
      torState = { enabled: false, starting: false, reason: `Failed to spawn tor: ${err.message}` };
      sendTorState(winForFeedback);
      return;
    }

    try {
      await waitForPort(TOR_HOST, TOR_PORT, 30000, 250);
    } catch {
      try { process.kill(torChild.pid); } catch {}
      torChild = null;
      torState = { enabled: false, starting: false, reason: 'Tor did not open 9050 in time' };
      sendTorState(winForFeedback);
      return;
    }
  }

  try {
    await applyProxy(true);
    torState = { enabled: true, starting: false, reason: null };
    sendTorState(winForFeedback);

    const target = windows.getMainWindow() || await windows.getOrCreateMainWindow({ activate: true });
    if (target && !target.isDestroyed()) {
      target.webContents.send('mzr:open-url', { url: 'https://check.torproject.org', activate: true });
      target.focus();
    }
  } catch (err) {
    torState = { enabled: false, starting: false, reason: `Proxy error: ${err.message}` };
    sendTorState(winForFeedback);
  }
}

async function stopTorAndProxy(winForFeedback) {
  torState.starting = false;
  try {
    await applyProxy(false);
  } catch {}
  if (torChild) {
    try { process.kill(torChild.pid); } catch {}
    torChild = null;
  }
  torState = { enabled: false, starting: false, reason: null };
  sendTorState(winForFeedback);
}

function registerTorHandlers(ipcMain) {
  ipcMain.handle('tor:toggle', async (event, payload) => {
    const win = BrowserWindow.fromWebContents(event.sender) || windows.getMainWindow();
    if (torState.enabled || torState.starting) {
      await stopTorAndProxy(win);
    } else {
      const containerId = typeof payload === 'object' && payload && typeof payload.containerId === 'string'
        ? payload.containerId.trim()
        : '';
      await startTorAndProxy(win, { containerId });
    }
    return { ...torState };
  });

  ipcMain.handle('tor:get-state', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || windows.getMainWindow();
    sendTorState(win);
    return { ...torState };
  });
}

module.exports = {
  registerTorHandlers,
  sendTorState,
  startTorAndProxy,
  stopTorAndProxy,
  getTorState: () => ({ ...torState })
};
