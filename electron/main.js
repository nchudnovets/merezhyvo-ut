'use strict';

const {
  app,
  BrowserWindow,
  Menu,
  screen,
  ipcMain,
  session,
  nativeTheme,
  powerSaveBlocker,
  clipboard
} = require('electron');
const path = require('path');
const fs = require('fs');
const { existsSync } = fs;
const fsp = fs.promises;
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const net = require('net');
const { resolveMode } = require('./mode');

try { nativeTheme.themeSource = 'dark'; } catch {}

const DEFAULT_URL = 'https://duckduckgo.com';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';
const DESKTOP_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const TOR_HOST = '127.0.0.1';
const TOR_PORT = 9050;
const TOR_CONTAINER = 'main';
let torChild = null;
let torState = { enabled: false, starting: false, reason: null };

let currentMode = null; // 'mobile' | 'desktop'
const baseZoomFor = (mode) => (mode === 'mobile' ? 2.0 : 1.0);

const isMobileExceptionDomain = (url) => {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname === 'messenger.com' ||
      hostname.endsWith('.messenger.com') ||
      hostname === 'youtube.com' ||
      hostname.endsWith('.youtube.com');
  } catch {
    return false;
  }
};

const installUserAgentOverride = (session) => {
  if (!session || session.__mzrUAOverrideInstalled) return;
  session.__mzrUAOverrideInstalled = true;
  session.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    if (isMobileExceptionDomain(details.url)) {
      headers['User-Agent'] = DESKTOP_USER_AGENT;
    } else {
      headers['User-Agent'] = currentUserAgentMode === 'mobile' ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT;
    }
    callback({ cancel: false, requestHeaders: headers });
  });
};

let mainWindow;
const pendingOpenUrls = [];
let tabsReady = false;
let playbackBlockerId = null;

app.setName('Merezhyvo');

if (process.platform === 'linux' && typeof app.setDesktopName === 'function') {
  const base = 'merezhyvo.naz.r_merezhyvo';
  const ver = (typeof app.getVersion === 'function') ? app.getVersion() : null;

  let desktopName = ver ? `${base}_${ver}.desktop` : null;

  if (!desktopName) {
    try {
      const appsDir = path.join(app.getPath('home'), '.local', 'share', 'applications');
      const candidates = fs.readdirSync(appsDir)
        .filter(f => f.startsWith(base + '_') && f.endsWith('.desktop'))
        .sort()
        .reverse();
      if (candidates.length) desktopName = candidates[0];
    } catch {}
  }

  if (desktopName) {
    app.setDesktopName(desktopName);
  }
}

const stopPlaybackBlocker = (id) => {
  const blockerId = typeof id === 'number' ? id : playbackBlockerId;
  if (typeof blockerId === 'number') {
    try {
      if (powerSaveBlocker.isStarted(blockerId)) {
        powerSaveBlocker.stop(blockerId);
      }
    } catch (err) {
      console.warn('[merezhyvo] power blocker stop failed:', err);
    }
    if (playbackBlockerId === blockerId) {
      playbackBlockerId = null;
    }
  }
};
const applyUserAgentForUrl = (contents, url) => {
  if (!contents) return;
  const baseUA = currentUserAgentMode === 'mobile' ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT;
  const ua = isMobileExceptionDomain(url) ? DESKTOP_USER_AGENT : baseUA;
  try { contents.setUserAgent(ua); } catch {}
};


function isSingleWindow(win) {
  if (!win || win.isDestroyed?.()) return false;
  if (win.__mzrRole) return win.__mzrRole === 'single';
  try {
    const u = new URL(win.webContents.getURL());
    return u.searchParams.get('single') === '1';
  } catch { return false; }
}

function findMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed?.() && !isSingleWindow(mainWindow)) {
    return mainWindow;
  }
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed?.() && !isSingleWindow(w)) return w;
  }
  return null;
}

async function openInMain(url, { activate = true } = {}) {
  const win = await getOrCreateMainWindow({ activate });
  if (!tabsReady || win.webContents.isLoading()) {
    pendingOpenUrls.push(url);
    return;
  }
  sendOpenUrl(win, url, /* activate */ true);
}

async function getOrCreateMainWindow({ activate = true } = {}) {
  let win = findMainWindow();
  if (win) {
    if (activate) focusMainWindow(mainWindow);
    return win;
  }

  win = createMainWindow({ role: 'main' });
  await new Promise(resolve => {
    const onReady = () => {
      win.off('ready-to-show', onReady);
      if (activate) focusMainWindow(win);
      resolve(win);
    };
    if (win.isReadyToShow && win.isReadyToShow()) onReady();
    else win.once('ready-to-show', onReady);
  });
  return win;
}

function focusMainWindow(win) {
  if (!win || win.isDestroyed()) return;
  try {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    if (typeof win.moveTop === 'function') win.moveTop();
    win.flashFrame(true);
    setTimeout(() => { try { win.flashFrame(false); } catch {} }, 1200);
  } catch {}
}

function flushPendingUrls(win) {
  if (!win || win.isDestroyed()) return;
  if (!tabsReady) return;
  try {
    while (pendingOpenUrls.length) {
      const url = pendingOpenUrls.shift();
      sendOpenUrl(win, url, /* activate */ true);
    }
  } catch {}
}

function sendOpenUrl(win, url, activate = true) {
  try {
    if (win && !win.isDestroyed() && win.webContents) {
      win.webContents.send('mzr:open-url', { url, activate });
    }
  } catch {}
}

let currentUserAgentMode = 'desktop';

// Application identifier for the host OS
app.setAppUserModelId('dev.naz.r.merezhyvo');

// Remove the default application menu
Menu.setApplicationMenu(null);

// ---------- safe insets (workaround for Ubuntu Touch / Lomiri) ----------
const SAFE_BOTTOM = Math.max(0, parseInt(process.env.MZV_SAFE_BOTTOM || '0', 10));
const SAFE_RIGHT  = Math.max(0, parseInt(process.env.MZV_SAFE_RIGHT  || '0', 10));

// ---------- utils ----------
const slugify = (s) =>
  (s || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'merezhyvo';

const ensureDir = (dir) => { try { fs.mkdirSync(dir, { recursive: true }); } catch {} };

const BUNDLED_ICON_PATH = path.resolve(__dirname, '..', 'merezhyvo_256.png');

const SESSION_SCHEMA = 1;
const SETTINGS_SCHEMA = 1;

const getProfileDir = () => {
  const dir = path.join(app.getPath('userData'), 'profiles', 'default');
  ensureDir(dir);
  return dir;
};

const getSessionFilePath = () => path.join(getProfileDir(), 'session.json');
const getSettingsFilePath = () => path.join(getProfileDir(), 'settings.json');

const makeSessionTabId = () => `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createDefaultSessionState = () => {
  const id = makeSessionTabId();
  const now = Date.now();
  return {
    schema: SESSION_SCHEMA,
    activeId: id,
    tabs: [
      {
        id,
        url: DEFAULT_URL,
        title: 'DuckDuckGo',
        favicon: '',
        pinned: false,
        muted: false,
        discarded: false,
        lastUsedAt: now
      }
    ]
  };
};

const sanitizeSessionPayload = (payload) => {
  const now = Date.now();
  if (!payload || typeof payload !== 'object' || payload.schema !== SESSION_SCHEMA) {
    return createDefaultSessionState();
  }

  const sourceTabs = Array.isArray(payload.tabs) ? payload.tabs : [];
  const tabs = [];

  for (const raw of sourceTabs) {
    if (!raw || typeof raw !== 'object') continue;
    const id =
      typeof raw.id === 'string' && raw.id.trim().length ? raw.id.trim() : makeSessionTabId();
    const url =
      typeof raw.url === 'string' && raw.url.trim().length ? raw.url.trim() : DEFAULT_URL;
    const title = typeof raw.title === 'string' ? raw.title : '';
    const favicon = typeof raw.favicon === 'string' ? raw.favicon : '';
    const pinned = !!raw.pinned;
    const muted = !!raw.muted;
    const discarded = !!raw.discarded;
    const lastUsedAt =
      typeof raw.lastUsedAt === 'number' && Number.isFinite(raw.lastUsedAt)
        ? raw.lastUsedAt
        : now;

    tabs.push({
      id,
      url,
      title,
      favicon,
      pinned,
      muted,
      discarded,
      lastUsedAt
    });
  }

  if (!tabs.length) {
    return createDefaultSessionState();
  }

  const activeId =
    typeof payload.activeId === 'string' && tabs.some((tab) => tab.id === payload.activeId)
      ? payload.activeId
      : tabs[0].id;

  const normalizedTabs = tabs.map((tab) => {
    if (tab.id === activeId) {
      if (!tab.discarded) return tab;
      return { ...tab, discarded: false };
    }
    if (tab.discarded) return tab;
    return { ...tab, discarded: true };
  });

  return {
    schema: SESSION_SCHEMA,
    activeId,
    tabs: normalizedTabs
  };
};

const createDefaultSettingsState = () => ({
  schema: SETTINGS_SCHEMA,
  installedApps: []
});

const normalizeInstalledAppUrl = (value) => {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') return null;
    const hrefLower = parsed.href.toLowerCase();
    if (hrefLower === 'https://mail.google.com' || hrefLower.startsWith('https://mail.google.com/')) {
      return 'https://mail.google.com';
    }
    return parsed.href;
  } catch {
    return null;
  }
};

const sanitizeInstalledAppEntry = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id.trim().length ? raw.id.trim() : null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const desktopFilePath = typeof raw.desktopFilePath === 'string' ? raw.desktopFilePath.trim() : '';
  const iconPath = typeof raw.iconPath === 'string' ? raw.iconPath.trim() : '';
  const single = !!raw.single;
  const normalizedUrl = normalizeInstalledAppUrl(raw.url);
  if (!id || !title || !desktopFilePath || !normalizedUrl) return null;
  const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
  const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt;
  return {
    id,
    title,
    url: normalizedUrl,
    desktopFilePath,
    iconPath,
    single,
    createdAt,
    updatedAt
  };
};

const sanitizeSettingsPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || payload.schema !== SETTINGS_SCHEMA) {
    return createDefaultSettingsState();
  }
  const source = Array.isArray(payload.installedApps) ? payload.installedApps : [];
  const installedApps = [];
  for (const raw of source) {
    const sanitized = sanitizeInstalledAppEntry(raw);
    if (sanitized) {
      installedApps.push(sanitized);
    }
  }
  return {
    schema: SETTINGS_SCHEMA,
    installedApps
  };
};

const readSettingsState = async () => {
  const file = getSettingsFilePath();
  let parsed = null;
  try {
    const raw = await fsp.readFile(file, 'utf8');
    parsed = JSON.parse(raw);
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      console.warn('[merezhyvo] settings read failed, falling back', err);
    }
    if (!parsed) {
      const defaults = createDefaultSettingsState();
      try {
        await fsp.writeFile(file, JSON.stringify(defaults, null, 2), 'utf8');
      } catch (writeErr) {
        console.error('[merezhyvo] settings init failed', writeErr);
      }
      return defaults;
    }
  }
  const sanitized = sanitizeSettingsPayload(parsed);
  try {
    await fsp.writeFile(file, JSON.stringify(sanitized, null, 2), 'utf8');
  } catch (err) {
    console.error('[merezhyvo] settings sanitize write failed', err);
  }
  return sanitized;
};

const writeSettingsState = async (state) => {
  const sanitized = sanitizeSettingsPayload(state);
  const file = getSettingsFilePath();
  await fsp.writeFile(file, JSON.stringify(sanitized, null, 2), 'utf8');
  return sanitized;
};

const upsertInstalledApp = async (entry) => {
  const sanitizedEntry = sanitizeInstalledAppEntry(entry);
  if (!sanitizedEntry) {
    throw new Error('Invalid shortcut entry.');
  }
  const current = await readSettingsState();
  const now = Date.now();
  const nextApps = [...current.installedApps];
  const index = nextApps.findIndex((app) => app.id === sanitizedEntry.id || app.desktopFilePath === sanitizedEntry.desktopFilePath);
  if (index >= 0) {
    const existing = nextApps[index];
    nextApps[index] = {
      ...existing,
      ...sanitizedEntry,
      createdAt: typeof existing.createdAt === 'number' ? existing.createdAt : sanitizedEntry.createdAt,
      updatedAt: now
    };
  } else {
    nextApps.push({
      ...sanitizedEntry,
      createdAt: sanitizedEntry.createdAt ?? now,
      updatedAt: now
    });
  }
  const nextState = await writeSettingsState({ schema: SETTINGS_SCHEMA, installedApps: nextApps });
  return nextState.installedApps.find((app) => app.id === sanitizedEntry.id) || sanitizedEntry;
};

const removeInstalledApp = async ({ id, desktopFilePath }) => {
  const current = await readSettingsState();
  const apps = [...current.installedApps];
  const targetIndex = apps.findIndex((app) => (id && app.id === id) || (desktopFilePath && app.desktopFilePath === desktopFilePath));
  if (targetIndex === -1) {
    return { ok: false, error: 'Installed app not found.' };
  }
  const [entry] = apps.splice(targetIndex, 1);
  try {
    if (entry.desktopFilePath) {
      await fsp.unlink(entry.desktopFilePath);
    }
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      apps.splice(targetIndex, 0, entry);
      await writeSettingsState({ schema: SETTINGS_SCHEMA, installedApps: apps });
      return { ok: false, error: 'Failed to remove shortcut file: ' + String(err) };
    }
  }
  if (entry.iconPath && entry.iconPath !== BUNDLED_ICON_PATH) {
    try {
      await fsp.unlink(entry.iconPath);
    } catch (err) {
      if (err && err.code !== 'ENOENT') {
        console.warn('[merezhyvo] removeInstalledApp: icon unlink failed', err);
      }
    }
  }
  const nextState = await writeSettingsState({ schema: SETTINGS_SCHEMA, installedApps: apps });
  return { ok: true, removed: entry, installedApps: nextState.installedApps };
};

function downloadBinary(url, { timeoutMs = 6000 } = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadBinary(new URL(res.headers.location, url).toString(), { timeoutMs }));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const ct = (res.headers['content-type'] || '').toLowerCase();
        resolve({ buffer: buf, contentType: ct });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { try { req.destroy(); } catch {} reject(new Error('timeout')); });
  });
}

async function tryFetchFaviconFor(hostname) {
  if (!hostname) return null;

  // 1) Google S2
  const s2 = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
  try {
    const { buffer, contentType } = await downloadBinary(s2);
    if ((contentType || '').toLowerCase().startsWith('image/')) {
      return {
        buffer,
        ext: contentType.includes('png') ? 'png'
          : contentType.includes('jpeg') ? 'jpg'
          : contentType.includes('svg') ? 'svg'
          : contentType.includes('ico') ? 'ico' : 'img'
      };
    }
  } catch {}

  // 2) /favicon.ico
  try {
    const icoUrl = `https://${hostname}/favicon.ico`;
    const { buffer, contentType } = await downloadBinary(icoUrl);
    if ((contentType || '').toLowerCase().startsWith('image/')) {
      return {
        buffer,
        ext: contentType.includes('png') ? 'png'
          : contentType.includes('jpeg') ? 'jpg'
          : contentType.includes('svg') ? 'svg' : 'ico'
      };
    }
  } catch {}

  // 3) /favicon.png
  try {
    const pngUrl = `https://${hostname}/favicon.png`;
    const { buffer, contentType } = await downloadBinary(pngUrl);
    if ((contentType || '').toLowerCase().startsWith('image/')) {
      return {
        buffer,
        ext: contentType.includes('png') ? 'png'
          : contentType.includes('jpeg') ? 'jpg' : 'img'
      };
    }
  } catch {}

  return null;
}

const normalizeAddress = (value) => {
  if (!value || !value.trim()) return DEFAULT_URL;
  const trimmed = value.trim();

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed; // already includes a scheme

  if (trimmed.includes(' ')) {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
  if (!trimmed.includes('.') && trimmed.toLowerCase() !== 'localhost') {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
  try {
    const candidate = new URL(`https://${trimmed}`);
    return candidate.href;
  } catch {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
};

function sendTorState(win) {
  const w = win || mainWindow;
  if (w && !w.isDestroyed()) {
    w.webContents.send('tor:state', { enabled: torState.enabled, reason: torState.reason || null });
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
  // застосуємо до defaultSession (усі вікна/вебвʼю за замовченням його використовують)
  await session.defaultSession.setProxy({ proxyRules: rules, proxyBypassRules: 'localhost,127.0.0.1' });
}

async function startTorAndProxy(winForFeedback) {
  if (torState.enabled || torState.starting) return;
  torState = { enabled: false, starting: true, reason: null };
  sendTorState(winForFeedback);

  // якщо порт вже відкритий — хтось інший запустив tor → просто підʼєднуємось
  const quick = new Promise((resolve) => {
    const s = net.connect({ host: TOR_HOST, port: TOR_PORT }, () => { s.destroy(); resolve(true); });
    s.on('error', () => { try { s.destroy(); } catch {} resolve(false); });
  });
  const alreadyUp = await quick;

  if (!alreadyUp) {
    // запускаємо tor в Libertine
    try {
      torChild = spawn('libertine-launch', ['-i', TOR_CONTAINER, 'tor'], {
        stdio: 'ignore',
        detached: true
      });
      // не чекаємо завершення, просто трекаємо pid
    } catch (e) {
      torState = { enabled: false, starting: false, reason: `Failed to spawn tor: ${e.message}` };
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

    // відкриємо перевірочну сторінку в новій вкладці
    const target = mainWindow && !mainWindow.isDestroyed()
      ? mainWindow
      : getOrCreateMainWindow ? getOrCreateMainWindow() : mainWindow;

    if (target && !target.isDestroyed()) {
      target.webContents.send('mzr:open-url', { url: 'https://check.torproject.org', activate: true });
      target.focus();
    }
  } catch (e) {
    torState = { enabled: false, starting: false, reason: `Proxy error: ${e.message}` };
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

const parseLaunchConfig = () => {
  const offset = process.defaultApp ? 2 : 1;
  const args = process.argv.slice(offset);
  let url = DEFAULT_URL;
  const envFullscreen = (process.env.MEREZHYVO_FULLSCREEN || '').toLowerCase();
  let fullscreen = ['1', 'true', 'yes'].includes(envFullscreen);
  let devtools = process.env.MZV_DEVTOOLS === '1';
  let modeOverride = (process.env.MZV_MODE || '').toLowerCase(); // optional
  const envForceDark = (process.env.MZV_FORCE_DARK || '').toLowerCase();
  let forceDark = ['1', 'true', 'yes'].includes(envForceDark);
  let singleWindow = false;

  for (const rawArg of args) {
    if (!rawArg) continue;
    if (rawArg === '--force-dark') { forceDark = true; continue; }
    if (rawArg === '--no-force-dark') { forceDark = false; continue; }
    if (rawArg === '--fullscreen') { fullscreen = true; continue; }
    if (rawArg === '--no-fullscreen') { fullscreen = false; continue; }
    if (rawArg === '--devtools') { devtools = true; continue; }
    if (rawArg === '--single') { singleWindow = true; continue; }

    const m = rawArg.match(/^--mode=(desktop|mobile)$/i);
    if (m) { modeOverride = m[1].toLowerCase(); continue; }

    if (/^-/.test(rawArg)) continue; // ignore unrelated flags

    if (url === DEFAULT_URL) url = normalizeAddress(rawArg);
  }

  return { url, fullscreen, devtools, modeOverride, forceDark, single: singleWindow };
};

const launchConfig = parseLaunchConfig();

// ---------- Chromium/Electron flags ----------
const featureFlags = ['VaapiVideoDecoder'];
if (launchConfig.forceDark) {
  featureFlags.push('WebContentsForceDark');
}
app.commandLine.appendSwitch('enable-features', featureFlags.join(','));
app.commandLine.appendSwitch('use-gl', 'egl');
app.commandLine.appendSwitch('enable-pinch'); // enable pinch gestures in the webview
app.commandLine.appendSwitch('autoplay-policy', 'document-user-activation-required');
// Optional: force device scale if hit testing drifts
// if (process.env.MZV_FORCE_SCALE === '1') {
//   app.commandLine.appendSwitch('force-device-scale-factor', '1');
// }

// ---------- window lifecycle ----------
const createMainWindow = (opts = {}) => {
  const { url: startUrl, fullscreen, devtools, modeOverride } = launchConfig;
  const distIndex = path.resolve(__dirname, '..', 'dist', 'index.html');
  const initialMode = modeOverride || resolveMode();
  currentMode = initialMode;

  if (!existsSync(distIndex)) {
    console.error('[Merezhyvo] Missing renderer bundle at', distIndex);
  }

  const resolvedMode = initialMode === 'desktop' ? 'desktop' : 'mobile';
  currentUserAgentMode = resolvedMode;
  installUserAgentOverride(session.defaultSession);
  const win = new BrowserWindow({
    width: 600,
    height: 800,
    minWidth: 320,
    minHeight: 480,
    fullscreen: false,
    fullscreenable: true,
    show: false,
    backgroundColor: '#101218',
    title: 'Merezhyvo',
    icon: path.resolve(__dirname, '..', 'merezhyvo_256.png'),
    autoHideMenuBar: true,
    resizable: true,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      spellcheck: false,
      nativeWindowOpen: false,
      defaultFontSize: initialMode === 'mobile' ? 28 : 16,
      preload: path.resolve(__dirname, 'preload.js')
    }
  });
  try {
    applyUserAgentForUrl(win.webContents, startUrl);
  } catch {}
  win.webContents.on('did-attach-webview', (_event, contents) => {
    try {
      applyUserAgentForUrl(contents, contents.getURL ? contents.getURL() : '');
    } catch {}
    contents.on('did-start-navigation', (_evt, url, isInPlace, isMainFrame) => {
      if (isMainFrame) applyUserAgentForUrl(contents, url);
    });
  });

  // Helper for pseudo-fullscreen on mobile taking safe insets into account
  const applyMobileBounds = (w) => {
    try {
      const display = screen.getPrimaryDisplay();
      const base = display.size || display.workArea || { width: 0, height: 0 };
      const targetW = Math.max(w.getMinimumSize()[0], base.width  - SAFE_RIGHT  - 1);
      const targetH = Math.max(w.getMinimumSize()[1], base.height - SAFE_BOTTOM - 1);
      w.setFullScreen(false);
      w.setBounds({ x: 0, y: 0, width: targetW, height: targetH }, false);
    } catch {}
  };

  win.once('ready-to-show', () => {
    // On mobile avoid true fullscreen and instead resize using SAFE_* offsets
    if (initialMode === 'mobile') {
      applyMobileBounds(win);
    } else if (fullscreen) {
      win.setFullScreen(true);
    }

    if (devtools) win.webContents.openDevTools({ mode: 'detach' });
    win.show();
    win.focus();
  });

  // Re-apply bounds whenever display metrics change
  const rebalanceBounds = () => {
    if (initialMode === 'mobile') applyMobileBounds(win);
  };
  screen.on('display-metrics-changed', rebalanceBounds);
  screen.on('display-added', rebalanceBounds);
  screen.on('display-removed', rebalanceBounds);

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  let role = 'main';
  if (opts.role) {
    role = opts.role;
  }
  else if (launchConfig.single) {
    role = 'single';
  }
  win.__mzrRole = role;

  const query = { start: startUrl, mode: initialMode };
  if (role === 'single') {
    query.single = '1';
  }
  win.loadFile(distIndex, { query });

  // Block zooming on the host webContents (only allow it inside the <webview>)
  win.webContents.setVisualZoomLevelLimits(1, 3).catch(() => {});
  const resetHostZoom = () => {
    if (win.isDestroyed()) return;
    const current = win.webContents.getZoomFactor();
    if (typeof current === 'number' && Math.abs(current - 1) > 1e-3) {
      win.webContents.setZoomFactor(1);
    }
  };
   win.webContents.once('did-finish-load', () => {
    flushPendingUrls(win);
  });
  win.webContents.on('zoom-changed', resetHostZoom);
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'mouseWheel' && (input.control || input.meta)) e.preventDefault();
  });
  win.webContents.on('did-start-navigation', (_event, url, isInPlace, isMainFrame) => {
    if (isMainFrame) applyUserAgentForUrl(win.webContents, url);
  });

  if (role === 'main') {
    mainWindow = win;
  }
  return win;
};

// When displays change send a refreshed mode to the renderer
const rebalance = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const m = resolveMode();
  currentMode = m;
  try {
    mainWindow.webContents.send('merezhyvo:mode', m);
  } catch {}
};

app.whenReady().then(() => {
  currentUserAgentMode = resolveMode();
  const initialUA = currentUserAgentMode === 'mobile' ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT;
  try { session.defaultSession?.setUserAgent(initialUA); } catch {}
  installUserAgentOverride(session.defaultSession);
  createMainWindow();

  screen.on('display-added', rebalance);
  screen.on('display-removed', rebalance);
  screen.on('display-metrics-changed', rebalance);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// Apply the same zoom policy to any newly created window
app.on('browser-window-created', (_event, win) => {
  win.webContents.setVisualZoomLevelLimits(1, 3).catch(() => {});
  win.webContents.on('zoom-changed', () => {
    if (win.isDestroyed()) return;
    const current = win.webContents.getZoomFactor();
    if (typeof current === 'number' && Math.abs(current - 1) > 1e-3) {
      win.webContents.setZoomFactor(1);
    }
  });
  const mode = resolveMode();
  currentUserAgentMode = mode;
  try {
    applyUserAgentForUrl(win.webContents, win.webContents.getURL());
  } catch {}
});

app.on('web-contents-created', (_ev, contents) => {
  if (contents.getType() !== 'webview') return;

  try { contents.setVisualZoomLevelLimits(1, 3); } catch {}
  const base = baseZoomFor(currentMode);
  try { contents.setZoomFactor(base); } catch {}


  function openTargetFromContents(contents, url) {
  const embedder = contents.hostWebContents || contents;
  let isSingle = false;
  try {
    const u = new URL(embedder.getURL());
    isSingle = u.searchParams.get('single') === '1';
  } catch {}

  if (isSingle) {
    openInMain(url, { activate: true });
  } else {
    try {
      const win = BrowserWindow.fromWebContents(embedder);
      if (win && !win.isDestroyed()) {
        if (!tabsReady || win.webContents.isLoading()) {
          pendingOpenUrls.push(url);
          focusMainWindow(win);
        } else {
          sendOpenUrl(win, url, /* activate */ true);
          focusMainWindow(win);
        }
      } else {
        openInMain(url, { activate: true });
      }
    } catch {
      openInMain(url, { activate: true });
    }
  }
}

  contents.setWindowOpenHandler(({ url }) => {
    openTargetFromContents(contents, url);
    return { action: 'deny' };
  });

  contents.on('new-window', (e, url) => {
    e.preventDefault();
    openTargetFromContents(contents, url);
  });

  const applyBase = () => { try { contents.setZoomFactor(baseZoomFor(currentMode)); } catch {} };
  contents.on('dom-ready', applyBase);
  contents.on('did-navigate', applyBase);
  contents.on('did-navigate-in-page', applyBase);
});

// Standard quit behaviour
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('context-menu', (_e, params) => {
    const hasLink = !!params.linkURL;
    const linkUrl = params.linkURL || '';
    const hasSelection = !!(params.selectionText && params.selectionText.trim());
    const canBack = contents.canGoBack?.() || false;
    const canForward = contents.canGoForward?.() || false;

    const template = [];

    if (hasLink) {
      template.push({
        label: 'Open link in new tab',
        click: () => {
          try {
            const embedder = contents.hostWebContents || contents;
            let isSingle = false;
            try {
              const u = new URL(embedder.getURL());
              isSingle = u.searchParams.get('single') === '1';
            } catch {}

            if (isSingle) {
              const win = getOrCreateMainWindow(); 
              if (win && !win.isDestroyed()) {
                win.show(); win.focus();
                sendOpenUrl(win, linkUrl);
              }
            } else {
              const ownerWin = BrowserWindow.fromWebContents(embedder) || mainWindow;
              if (ownerWin && !ownerWin.isDestroyed()) {
                sendOpenUrl(ownerWin, linkUrl);
              }
            }
          } catch {}
        }
      });

      template.push({
        label: 'Copy link address',
        click: () => {
          try { clipboard.writeText(linkUrl); } catch {}
        }
      });

      template.push({ type: 'separator' });
    }

    template.push({
      label: 'Back',
      enabled: canBack,
      click: () => { try { contents.goBack(); } catch {} }
    });
    template.push({
      label: 'Forward',
      enabled: canForward,
      click: () => { try { contents.goForward(); } catch {} }
    });
    template.push({
      label: 'Reload',
      click: () => { try { contents.reload(); } catch {} }
    });

    if (hasSelection) {
      template.push({ type: 'separator' });
      template.push({
        label: 'Copy selection',
        click: () => {
          try { clipboard.writeText(params.selectionText); } catch {}
        }
      });
    }

    if (params.isEditable) {
      template.push(
        { type: 'separator' },
        {
          label: 'Paste',
          enabled: !!clipboard.readText().length,
          click: () => {
            try {
              contents.paste();
            } catch {
              const menu = Menu.buildFromTemplate([{ role: 'paste' }]);
              menu.popup({ window: BrowserWindow.fromWebContents(contents) });
            }
          }
        }
      );
    }

    template.push(
      { type: 'separator' },
      {
        label: 'Inspect',
        click: () => {
          try {
            contents.openDevTools({ mode: 'detach' });
            contents.inspectElement(params.x, params.y);
          } catch {}
        }
      }
    )

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: BrowserWindow.fromWebContents(contents) || mainWindow });
  });
});

ipcMain.on('mzr:open-context', (e, payload) => {
  try {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win || win.isDestroyed()) return;

    const { x = 0, y = 0, dpr = 1 } = payload || {};
    const b = win.getBounds();

    const screenX = Math.round(b.x + x * dpr);
    const screenY = Math.round(b.y + y * dpr);

    const menu = Menu.buildFromTemplate([
      { label: 'Back',    enabled: win.webContents.canGoBack(),    click: () => win.webContents.goBack() },
      { label: 'Forward', enabled: win.webContents.canGoForward(), click: () => win.webContents.goForward() },
      { type: 'separator' },
      { label: 'Reload',  click: () => win.webContents.reload() },
      { type: 'separator' },
      { label: 'Copy selection', role: 'copy' },
      { label: 'Paste', role: 'paste' }
    ]);

    menu.popup({ window: win, x: screenX, y: screenY });
  } catch {}
});

// ---------- Session persistence ----------
ipcMain.handle('merezhyvo:session:load', async () => {
  try {
    const sessionFile = getSessionFilePath();
    let parsed = null;
    try {
      const raw = await fsp.readFile(sessionFile, 'utf8');
      parsed = JSON.parse(raw);
    } catch (err) {
      if (err && err.code !== 'ENOENT') {
        console.warn('[merezhyvo] session load: falling back after read failure', err);
      }
    }

    const sanitized = sanitizeSessionPayload(parsed);
    try {
      await fsp.writeFile(sessionFile, JSON.stringify(sanitized, null, 2), 'utf8');
    } catch (err) {
      console.error('[merezhyvo] session load: failed to write sanitized session', err);
    }
    return sanitized;
  } catch (err) {
    console.error('[merezhyvo] session load failed', err);
    const fallback = createDefaultSessionState();
    try {
      await fsp.writeFile(getSessionFilePath(), JSON.stringify(fallback, null, 2), 'utf8');
    } catch (writeErr) {
      console.error('[merezhyvo] unable to write fallback session', writeErr);
    }
    return fallback;
  }
});

ipcMain.handle('merezhyvo:session:save', async (_event, payload) => {
  try {
    const sanitized = sanitizeSessionPayload(payload);
    const sessionFile = getSessionFilePath();
    await fsp.writeFile(sessionFile, JSON.stringify(sanitized, null, 2), 'utf8');
    return { ok: true };
  } catch (err) {
    console.error('[merezhyvo] session save failed', err);
    return { ok: false, error: String(err) };
  }
});

// ---------- Settings persistence ----------
ipcMain.handle('merezhyvo:settings:load', async () => {
  try {
    return await readSettingsState();
  } catch (err) {
    console.error('[merezhyvo] settings load failed', err);
    return createDefaultSettingsState();
  }
});

ipcMain.handle('merezhyvo:settings:installedApps:list', async () => {
  try {
    const settings = await readSettingsState();
    return { ok: true, installedApps: settings.installedApps };
  } catch (err) {
    console.error('[merezhyvo] installed apps list failed', err);
    return { ok: false, error: String(err), installedApps: [] };
  }
});

ipcMain.handle('merezhyvo:settings:installedApps:remove', async (_event, payload) => {
  const id = typeof payload === 'string'
    ? payload
    : (payload && typeof payload.id === 'string' ? payload.id : null);
  const desktopFilePath = payload && typeof payload.desktopFilePath === 'string'
    ? payload.desktopFilePath
    : null;
  if (!id && !desktopFilePath) {
    return { ok: false, error: 'App identifier is required.' };
  }
  try {
    return await removeInstalledApp({ id, desktopFilePath });
  } catch (err) {
    console.error('[merezhyvo] installed app remove failed', err);
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('merezhyvo:power:start', () => {
  try {
    if (typeof playbackBlockerId === 'number') {
      if (powerSaveBlocker.isStarted(playbackBlockerId)) {
        return playbackBlockerId;
      }
      stopPlaybackBlocker(playbackBlockerId);
    }
    playbackBlockerId = powerSaveBlocker.start('prevent-app-suspension');
    return playbackBlockerId;
  } catch (err) {
    console.error('[merezhyvo] power blocker start failed:', err);
    playbackBlockerId = null;
    return null;
  }
});

ipcMain.handle('merezhyvo:power:stop', (_event, explicitId) => {
  stopPlaybackBlocker(explicitId);
  return true;
});

ipcMain.handle('merezhyvo:power:isStarted', (_event, explicitId) => {
  const id = typeof explicitId === 'number' ? explicitId : playbackBlockerId;
  return typeof id === 'number' && powerSaveBlocker.isStarted(id);
});

// ---------- IPC: shortcut creation ----------
ipcMain.handle('merezhyvo:createShortcut', async (_e, payload) => {
  const rawTitle = typeof payload?.title === 'string' ? payload.title.trim() : '';
  const normalizedUrl = normalizeInstalledAppUrl(payload?.url);
  const single = !!payload?.single;
  if (!rawTitle || !normalizedUrl) {
    return { ok: false, error: 'Title and URL are required.' };
  }

  const home = app.getPath('home');
  const appsDir = path.join(home, '.local/share/applications');
  const iconsDir = path.join(home, '.local/share/icons');
  ensureDir(appsDir);
  ensureDir(iconsDir);

  let hostname = '';
  try { hostname = new URL(normalizedUrl).hostname.replace(/^www\./, ''); } catch {}

  let iconPath = BUNDLED_ICON_PATH;

  // Attempt to fetch a favicon for the site
  try {
    const fav = await tryFetchFaviconFor(hostname);
    if (fav && fav.buffer?.length) {
      const fileName = `${slugify(rawTitle)}.${fav.ext}`;
      iconPath = path.join(iconsDir, fileName);
      fs.writeFileSync(iconPath, fav.buffer);
    }
  } catch {
    iconPath = BUNDLED_ICON_PATH;
  }

  const clickBinary = '/opt/click.ubuntu.com/merezhyvo.naz.r/current/app/merezhyvo';
  const localFallback = path.resolve(__dirname, '..', 'app', 'merezhyvo');
  const execPath = existsSync(clickBinary) ? clickBinary : localFallback;

  const singleFlag = single ? ' --single' : '';
  const appIdSlug = slugify(rawTitle);
  const desktopFilePath = path.join(appsDir, `merezhyvo-${appIdSlug}.desktop`);

  const desktopContent = `
[Desktop Entry]
Name=${rawTitle}
Comment=Site shortcut (${rawTitle}) via Merezhyvo
Exec=env OZONE_PLATFORM=wayland XCURSOR_SIZE=14 ${execPath} --fullscreen${singleFlag} "${normalizedUrl}"
Icon=${iconPath}
Terminal=false
Type=Application
Categories=Network;WebBrowser;
X-Ubuntu-Touch=true
StartupWMClass=Merezhyvo
`.trim() + '\n';

  try {
    fs.writeFileSync(desktopFilePath, desktopContent, { mode: 0o644 });
  } catch (err) {
    return { ok: false, error: 'Failed to write .desktop: ' + String(err) };
  }

  try {
    const installedApp = await upsertInstalledApp({
      id: appIdSlug,
      title: rawTitle,
      url: normalizedUrl,
      desktopFilePath,
      iconPath,
      single,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    return { ok: true, desktopFilePath, iconPath, installedApp };
  } catch (err) {
    console.error('[merezhyvo] installed app persistence failed', err);
    try { await fsp.unlink(desktopFilePath); } catch {}
    if (iconPath && iconPath !== BUNDLED_ICON_PATH) {
      try { await fsp.unlink(iconPath); } catch {}
    }
    return { ok: false, error: 'Shortcut created, but saving settings failed: ' + String(err) };
  }
});

ipcMain.on('tabs:ready', () => {
  tabsReady = true;
  flushPendingUrls(mainWindow);
});

ipcMain.handle('tor:toggle', async (e) => {
  const w = BrowserWindow.fromWebContents(e.sender) || mainWindow;
  if (torState.enabled || torState.starting) {
    await stopTorAndProxy(w);
  } else {
    await startTorAndProxy(w);
  }
  return { ...torState };
});

ipcMain.handle('tor:get-state', async (e) => {
  const w = BrowserWindow.fromWebContents(e.sender) || mainWindow;
  sendTorState(w);
  return { ...torState };
});
