'use strict';

if (!require.extensions['.ts']) {
  require.extensions['.ts'] = require.extensions['.js'];
}

const {
  app,
  BrowserWindow,
  Menu,
  screen,
  ipcMain,
  session,
  nativeTheme,
  powerSaveBlocker,
  clipboard,
  webContents
} = require('electron');
const fs = require('fs');
const path = require('path');
const fsp = fs.promises;
const { resolveMode } = require('./mode');

const windows = require('./lib/windows.ts');
const links = require('./lib/links.ts');
const shortcuts = require('./lib/shortcuts.ts');
const tor = require('./lib/tor.ts');
const torSettings = require('./lib/tor-settings.ts');

try { nativeTheme.themeSource = 'dark'; } catch {}

const {
  getSessionFilePath,
  createDefaultSettingsState,
  readSettingsState,
  removeInstalledApp,
  registerShortcutHandler
} = shortcuts;

const {
  readTorConfig,
  updateTorConfig,
  sanitizeTorConfig
} = torSettings;

const {
  DEFAULT_URL,
  MOBILE_USER_AGENT,
  DESKTOP_USER_AGENT
} = windows;

const SESSION_SCHEMA = 1;

let playbackBlockerId = null;

let ctxWin = null;
let lastCtx = { wcId: null, params: null, x: 0, y: 0, linkUrl: '' };
let ctxOpening = false;
let ctxOverlay = null;
let ctxMenuMode = 'desktop';

app.setName('Merezhyvo');
app.setAppUserModelId('dev.naz.r.merezhyvo');

windows.installDesktopName();

Menu.setApplicationMenu(null);

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

const normalizeAddress = (value) => {
  if (!value || !value.trim()) return DEFAULT_URL;
  const trimmed = value.trim();

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed;

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

function clampToWorkArea(x, y, w, h) {
  const disp = screen.getDisplayNearestPoint({ x, y });
  const wa = disp?.workArea || { x: 0, y: 0, width: 1920, height: 1080 };
  let nx = Math.max(wa.x, Math.min(x, wa.x + wa.width - w));
  let ny = Math.max(wa.y, Math.min(y, wa.y + h > wa.y + wa.height ? (wa.y + wa.height - h) : y));
  return { x: nx, y: ny };
}

function isTouchSource(params) {
  const src = String(params?.menuSourceType || params?.sourceType || '').toLowerCase();
  return ['touch','longpress','longtap','touchmenu','touchhandle','stylus','adjustselection','adjustselectionreset'].includes(src);
}

function resolveOwnerWindow(wc) {
  let owner = wc;
  try { if (wc.hostWebContents && !wc.hostWebContents.isDestroyed()) owner = wc.hostWebContents; } catch {}
  return BrowserWindow.fromWebContents(owner) || BrowserWindow.getFocusedWindow() || null;
}

function getTargetWebContents(contents) {
  return contents || (BrowserWindow.getFocusedWindow()?.webContents || null);
}

// time/position/owner dedupe
let lastOpenSig = { ts: 0, x: 0, y: 0, ownerId: 0 };
function shouldOpenCtxNow(x, y, ownerId) {
  const now = Date.now();
  const dt = now - lastOpenSig.ts;
  const dx = Math.abs((x || 0) - (lastOpenSig.x || 0));
  const dy = Math.abs((y || 0) - (lastOpenSig.y || 0));
  const sameOwner = ownerId && ownerId === lastOpenSig.ownerId;
  if (dt < 300 && sameOwner && dx < 8 && dy < 8) return false;
  lastOpenSig = { ts: now, x: x || 0, y: y || 0, ownerId: ownerId || 0 };
  return true;
}

function destroyCtxWindows() {
  try { if (ctxWin && !ctxWin.isDestroyed()) ctxWin.close(); } catch {}
  try { if (ctxOverlay && !ctxOverlay.isDestroyed()) ctxOverlay.close(); } catch {}
  ctxWin = null;
  ctxOverlay = null;
}

async function openCtxWindowFor(contents, params) {
  const rawMode = windows.getCurrentMode ? windows.getCurrentMode() : null;
  const normalizedMode = rawMode === 'mobile' ? 'mobile' : 'desktop';

  if (isTouchSource(params) && normalizedMode !== 'mobile') return; // ignore touch in desktop mode

  ctxMenuMode = normalizedMode;

  if (ctxOpening) return;
  ctxOpening = true;
  setTimeout(() => { ctxOpening = false; }, 280);

  const targetWc = getTargetWebContents(contents);
  if (!targetWc || targetWc.isDestroyed()) return;

  const ownerWin = resolveOwnerWindow(targetWc);
  if (!ownerWin || ownerWin.isDestroyed()) return;

  const cursor = screen.getCursorScreenPoint();
  const ownerId = ownerWin.webContents.id;
  if (!shouldOpenCtxNow(cursor.x, cursor.y, ownerId)) return;

  // remember context for actions
  global.lastCtx = {
    wcId: targetWc.id,
    params: params || null,
    x: cursor.x,
    y: cursor.y,
    linkUrl: (params && params.linkURL) || ''
  };

  // Always start fresh: close any previous overlay/popup.
  destroyCtxWindows();

  // 1) Create a full-screen overlay that catches any click outside the menu.
  const disp = screen.getDisplayNearestPoint({ x: cursor.x, y: cursor.y });
  const wa = disp?.workArea || { x: 0, y: 0, width: 1920, height: 1080 };

  ctxOverlay = new BrowserWindow({
    x: wa.x, y: wa.y, width: wa.width, height: wa.height,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: true,                 // must receive clicks
    backgroundColor: '#01000000',    // nearly transparent (avoid fully 00..00 on some compositors)
    transparent: true,
    hasShadow: false,
    type: 'popup',
    parent: ownerWin || undefined,   // keep above owner
    modal: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,         // <-- allow ipcRenderer in overlay page
      sandbox: false,
      devTools: !!process.env.MZV_CTXMENU_DEVTOOLS
    }
  });

  // Keep overlay below the popup but above owner
  try { ctxOverlay.setAlwaysOnTop(true, 'floating'); } catch {}
  ctxOverlay.setMenuBarVisibility(false);

  // Load inline HTML that closes on any pointer down (outside the popup area)
  const overlayHtml = [
    '<!doctype html><meta charset="utf-8"/>',
    '<style>',
    'html,body{margin:0;padding:0;width:100%;height:100%;background:transparent;cursor:default;}',
    // prevent native context menu on overlay
    'body{user-select:none;-webkit-user-select:none;}',
    '</style>',
    '<script>',
    // close on any pointer press in overlay
    'document.addEventListener("pointerdown", function(){',
    '  try{ require("electron").ipcRenderer.send("mzr:ctxmenu:close"); }catch(e){}',
    '});',
    // block default context menus
    'window.addEventListener("contextmenu", function(e){ e.preventDefault(); }, {passive:false});',
    // optional: ESC closes too
    'window.addEventListener("keydown", function(e){ if(e.key==="Escape"){ try{ require("electron").ipcRenderer.send("mzr:ctxmenu:close"); }catch(_){} } });',
    '</script>',
    '<body></body>'
  ].join('');

  await Promise.resolve(ctxOverlay.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayHtml)}`)).catch(()=>{});

  ctxOverlay.on('closed', () => { if (ctxOverlay) ctxOverlay = null; });

  // 2) Create the actual popup *as a child of the overlay*, so it's above overlay
  const htmlPath = path.resolve(__dirname, 'context-menu.html');
  const baseWidth = ctxMenuMode === 'mobile' ? 360 : 260;
  const baseHeight = ctxMenuMode === 'mobile' ? 320 : 220;
  const desired = clampToWorkArea(cursor.x + 8, cursor.y + 10, baseWidth, baseHeight);

  ctxWin = new BrowserWindow({
    width: baseWidth,
    height: baseHeight,            // visible immediately; renderer will autosize
    x: desired.x,
    y: desired.y,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: true,
    backgroundColor: '#1c1c1cee', // opaque for UT stability (can switch to transparent later)
    transparent: false,
    hasShadow: true,
    roundedCorners: true,
    type: 'popup',
    parent: ctxOverlay,            // key point: popup sits above overlay
    modal: false,
    useContentSize: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      devTools: !!process.env.MZV_CTXMENU_DEVTOOLS
    }
  });

  // Ensure popup is above overlay on all compositors
  try { ctxWin.setAlwaysOnTop(true, 'modal-panel'); } catch {}

  ctxWin.on('closed', () => {
    try { if (ctxOverlay && !ctxOverlay.isDestroyed()) ctxOverlay.close(); } catch {}
    ctxWin = null; ctxOverlay = null;
  });

  if (process.env.MZV_CTXMENU_LOGS === '1') {
    ctxWin.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      const lvl = ['log','warn','error','debug','info'][level] || level;
      logCtx(`popup:${lvl}`, message, `(${sourceId}:${line})`);
    });
  }

  // Load the menu UI
  const ctxUrl = `file://${htmlPath}?mode=${ctxMenuMode}`;
  ctxWin.loadURL(ctxUrl).catch((e) => logCtx('loadURL error', String(e)));

  // Render & show robustly
  const askRender = () => {
    if (!ctxWin || ctxWin.isDestroyed()) return;
    logCtx('render+show');
    try { ctxWin.webContents.send('mzr:ctxmenu:render'); } catch {}
    ctxWin.webContents.executeJavaScript('window.__mzr_render && window.__mzr_render()').catch(() => {});
    try {
      if (!ctxOverlay.isVisible()) ctxOverlay.show();      // show overlay first
      if (!ctxWin.isVisible())    ctxWin.show();           // then popup
      ctxWin.focus();                                       // focus popup (overlay still catches outside clicks)
    } catch {}
    // fallback autosize if renderer didn't report
    setTimeout(() => {
      try {
        const b = ctxWin.getBounds();
        if (b.height <= 14) {
          const fallbackHeight = ctxMenuMode === 'mobile' ? baseHeight : 220;
          const fallbackWidth = ctxMenuMode === 'mobile' ? baseWidth : b.width;
          logCtx('autosize fallback →', `${fallbackWidth}x${fallbackHeight}`);
          ctxWin.setBounds({ x: b.x, y: b.y, width: fallbackWidth, height: fallbackHeight }, false);
          if (!ctxWin.isVisible()) ctxWin.show();
        }
      } catch {}
    }, 160);
  };

  ctxWin.webContents.once('did-finish-load', askRender);
  setTimeout(askRender, 260);
}


const LOG_FILE = path.join(app.getPath('userData'), 'ctxmenu.log');
function logCtx(...args) {
  const line = `[${new Date().toISOString()}] ` + args.map(String).join(' ') + '\n';
  try { fs.appendFileSync(LOG_FILE, line); } catch {}
  try { console.log('[ctxmenu]', ...args); } catch {}
}

const parseLaunchConfig = () => {
  const offset = process.defaultApp ? 2 : 1;
  const args = process.argv.slice(offset);
  let url = DEFAULT_URL;
  const envFullscreen = (process.env.MEREZHYVO_FULLSCREEN || '').toLowerCase();
  let fullscreen = ['1', 'true', 'yes'].includes(envFullscreen);
  let devtools = process.env.MZV_DEVTOOLS === '1';
  let modeOverride = (process.env.MZV_MODE || '').toLowerCase();
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

    if (/^-/.test(rawArg)) continue;

    if (url === DEFAULT_URL) url = normalizeAddress(rawArg);
  }

  return { url, fullscreen, devtools, modeOverride, forceDark, single: singleWindow };
};

const launchConfig = parseLaunchConfig();
windows.setLaunchConfig(launchConfig);

const featureFlags = ['VaapiVideoDecoder'];
if (launchConfig.forceDark) {
  featureFlags.push('WebContentsForceDark');
}
app.commandLine.appendSwitch('enable-features', featureFlags.join(','));
app.commandLine.appendSwitch('use-gl', 'egl');
app.commandLine.appendSwitch('enable-pinch');
app.commandLine.appendSwitch('autoplay-policy', 'document-user-activation-required');

registerShortcutHandler(ipcMain);
tor.registerTorHandlers(ipcMain);

app.whenReady().then(() => {
  const initialMode = resolveMode();
  windows.setCurrentMode(initialMode);
  const initialUA = initialMode === 'mobile' ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT;
  try { session.defaultSession?.setUserAgent(initialUA); } catch {}
  windows.installUserAgentOverride(session.defaultSession);
  windows.createMainWindow();

  screen.on('display-added', windows.rebalanceMainWindow);
  screen.on('display-removed', windows.rebalanceMainWindow);
  screen.on('display-metrics-changed', windows.rebalanceMainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windows.createMainWindow();
    }
  });
});

app.on('browser-window-created', (_event, win) => {
  windows.applyBrowserWindowPolicies(win);
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'mouseDown' && input.button === 'right') {
      const cursor = screen.getCursorScreenPoint();
      const ownerId = win.webContents.id;
      logCtx('before-input-event right-click', cursor.x, cursor.y, 'owner=', ownerId);
      if (!shouldOpenCtxNow(cursor.x, cursor.y, ownerId)) return;
      openCtxWindowFor(win.webContents, null);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType && contents.getType() === 'webview') {
    links.attachLinkPolicy(contents);
  }
  contents.on('context-menu', (event, params) => {
    try { event.preventDefault(); } catch {}
    logCtx('context-menu', params?.menuSourceType || params?.sourceType, params?.x, params?.y);
    openCtxWindowFor(contents, params);
  });
});


ipcMain.handle('mzr:ctxmenu:get-state', async () => {
  try {
    const wc = webContents.fromId(global.lastCtx?.wcId);
    const canBack = wc?.canGoBack?.() || false;
    const canForward = wc?.canGoForward?.() || false;

    const p = (global.lastCtx && global.lastCtx.params) || {};
    const hasSelection = !!(p.selectionText && String(p.selectionText).trim().length);
    const isEditable = !!p.isEditable;

    // Paste показуємо лише коли фокус у редагованому елементі і в буфері є текст
    let canPaste = false;
    try {
      const txt = clipboard.readText() || '';
      canPaste = !!(isEditable && txt.length > 0);
    } catch {}

    const linkUrl = global.lastCtx?.linkUrl || '';
    return { canBack, canForward, hasSelection, isEditable, canPaste, linkUrl };
  } catch {
    return { canBack: false, canForward: false, hasSelection: false, isEditable: false, canPaste: false, linkUrl: '' };
  }
});

ipcMain.on('mzr:ctxmenu:click', (_e, { id }) => {
  logCtx('action', id);
  try {
    const wc = webContents.fromId(global.lastCtx?.wcId);
    if (!wc || wc.isDestroyed()) return;

    if (id === 'back') return void wc.goBack?.();
    if (id === 'forward') return void wc.goForward?.();
    if (id === 'reload') return void wc.reload?.();
    if (id === 'copy-selection') {
      const text = global.lastCtx?.params?.selectionText || '';
      if (text) clipboard.writeText(text);
      return;
    }
    if (id === 'open-link') {
      const url = global.lastCtx?.linkUrl;
      if (url) {
        const embedder = wc.hostWebContents || wc;
        const ownerWin = BrowserWindow.fromWebContents(embedder) || BrowserWindow.getFocusedWindow();
        if (ownerWin && !ownerWin.isDestroyed()) {
          const { sendOpenUrl } = require('./lib/windows');
          sendOpenUrl(ownerWin, url);
        }
      }
      return;
    }
    if (id === 'copy-link') {
      const url = global.lastCtx?.linkUrl;
      if (url) clipboard.writeText(url);
      return;
    }
    if (id === 'paste') {
      try {
        wc.paste();
      } catch {
        try {
          const embedder = wc.hostWebContents || wc;
          const ownerWin = BrowserWindow.fromWebContents(embedder) || BrowserWindow.getFocusedWindow();
          if (ownerWin && !ownerWin.isDestroyed()) {
            const m = Menu.buildFromTemplate([{ role: 'paste' }]);
            m.popup({ window: ownerWin });
          }
        } catch {}
      }
      return;
    }
    if (id === 'inspect') {
      try { wc.openDevTools({ mode: 'detach' }); } catch {}
      return;
    }
  } catch (e) {
    logCtx('click handler error', String(e));
  } finally {
    try { if (ctxWin && !ctxWin.isDestroyed()) ctxWin.close(); } catch {}
  }
});

ipcMain.on('mzr:ctxmenu:close', () => {
  logCtx('close requested');
  try { if (ctxWin && !ctxWin.isDestroyed()) ctxWin.close(); } catch {}
});

ipcMain.on('mzr:ctxmenu:autosize', (_e, { height, width }) => {
  try {
    if (!ctxWin || ctxWin.isDestroyed()) return;
    const bounds = ctxWin.getBounds();
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
    const wa = display?.workArea;

    const minHeight = 44;
    const rawHeight = Number(height);
    const measuredHeight = Math.max(minHeight, Math.floor(Number.isFinite(rawHeight) ? rawHeight : 120));
    const maxHeight = ctxMenuMode === 'mobile'
      ? Math.max(minHeight, wa ? wa.height - 16 : measuredHeight)
      : 480;
    const targetHeight = Math.min(measuredHeight, maxHeight);

    let targetWidth = bounds.width;
    if (ctxMenuMode === 'mobile') {
      const minWidth = 220;
      const rawWidth = Number(width);
      const measuredWidth = Math.max(minWidth, Math.floor(Number.isFinite(rawWidth) ? rawWidth : bounds.width));
      const maxWidth = wa ? Math.max(minWidth, wa.width - 16) : measuredWidth;
      targetWidth = Math.min(measuredWidth, maxWidth);
    }

    const pos = clampToWorkArea(bounds.x, bounds.y, targetWidth, targetHeight);
    ctxWin.setBounds({ x: pos.x, y: pos.y, width: targetWidth, height: targetHeight }, false);
    if (!ctxWin.isVisible()) ctxWin.show();
    logCtx('autosized →', `${targetWidth}x${targetHeight}`, ctxMenuMode);
  } catch (e) {
    logCtx('autosize error', String(e));
  }
});



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

ipcMain.handle('merezhyvo:settings:load', async () => {
  try {
    const settings = await readSettingsState();
    const torConfig = await readTorConfig();
    return { ...settings, tor: torConfig };
  } catch (err) {
    console.error('[merezhyvo] settings load failed', err);
    const fallback = createDefaultSettingsState();
    let torConfig = sanitizeTorConfig(null);
    try {
      torConfig = await readTorConfig();
    } catch {}
    return { ...fallback, tor: torConfig };
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

ipcMain.handle('merezhyvo:settings:tor:update', async (_event, payload) => {
  const containerId = typeof payload === 'object' && payload && typeof payload.containerId === 'string'
    ? payload.containerId.trim()
    : '';
  try {
    const torConfig = await updateTorConfig({ containerId });
    return { ok: true, containerId: torConfig.containerId };
  } catch (err) {
    console.error('[merezhyvo] settings tor update failed', err);
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

ipcMain.on('tabs:ready', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || windows.getMainWindow();
  windows.markTabsReady(win);
});
