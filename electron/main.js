'use strict';

const {
  app,
  BrowserWindow,
  Menu,
  screen,
  ipcMain,
  session,
  nativeTheme,
  powerSaveBlocker
} = require('electron');
const path = require('path');
const fs = require('fs');
const { existsSync } = fs;
const fsp = fs.promises;
const https = require('https');
const http = require('http');
const { resolveMode } = require('./mode');

try { nativeTheme.themeSource = 'dark'; } catch {}

const DEFAULT_URL = 'https://duckduckgo.com';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';
const DESKTOP_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
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
let playbackBlockerId = null;

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
const createMainWindow = () => {
  const { url: startUrl, fullscreen, devtools, modeOverride } = launchConfig;
  const distIndex = path.resolve(__dirname, '..', 'dist', 'index.html');
  const initialMode = modeOverride || resolveMode();

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
    autoHideMenuBar: true,
    resizable: true,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      spellcheck: false,
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

  const query = { start: startUrl, mode: initialMode };
  if (launchConfig.single) {
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
  win.webContents.on('zoom-changed', resetHostZoom);
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'mouseWheel' && (input.control || input.meta)) e.preventDefault();
  });
  win.webContents.on('did-start-navigation', (_event, url, isInPlace, isMainFrame) => {
    if (isMainFrame) applyUserAgentForUrl(win.webContents, url);
  });

  if (!launchConfig.single) {
    mainWindow = win;
  }
};

// When displays change send a refreshed mode to the renderer
const rebalance = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const m = resolveMode();
  try {
    mainWindow.webContents.send('merezhyvo:mode', m);
    // Leave host zoom alone — zoom is managed inside the <webview>
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

// Standard quit behaviour
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
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
