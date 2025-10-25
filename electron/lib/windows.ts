'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, screen, session } = require('electron');
const { resolveMode } = require('../mode');

const DEFAULT_URL = 'https://duckduckgo.com';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';
const DESKTOP_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const DESKTOP_ONLY_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'studio.youtube.com',
  'gaming.youtube.com',
  'kids.youtube.com',
  'tv.youtube.com',
  'messenger.com'
]);

const SAFE_BOTTOM = Math.max(0, parseInt(process.env.MZV_SAFE_BOTTOM || '0', 10));
const SAFE_RIGHT = Math.max(0, parseInt(process.env.MZV_SAFE_RIGHT || '0', 10));

const baseZoomFor = (mode) => (mode === 'mobile' ? 2.0 : 1.0);

let launchConfig = null;
let currentMode = null; // 'mobile' | 'desktop'
let currentUserAgentMode = 'desktop';
let mainWindow = null;
const pendingOpenUrls = [];
let tabsReady = false;

function installDesktopName() {
  if (process.platform !== 'linux' || typeof app.setDesktopName !== 'function') return;

  const base = 'merezhyvo.naz.r_merezhyvo';
  const ver = (typeof app.getVersion === 'function') ? app.getVersion() : null;

  let desktopName = ver ? `${base}_${ver}.desktop` : null;

  if (!desktopName) {
    try {
      const appsDir = path.join(app.getPath('home'), '.local', 'share', 'applications');
      const candidates = fs.readdirSync(appsDir)
        .filter((file) => file.startsWith(`${base}_`) && file.endsWith('.desktop'))
        .sort()
        .reverse();
      if (candidates.length) desktopName = candidates[0];
    } catch {}
  }

  if (desktopName) {
    try { app.setDesktopName(desktopName); } catch {}
  }
}

function setLaunchConfig(config) {
  launchConfig = config ? { ...config } : null;
}

function getLaunchConfig() {
  return launchConfig;
}

function isDesktopOnlyUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (DESKTOP_ONLY_HOSTS.has(hostname)) return true;
    if (hostname.endsWith('.youtube.com')) return true;
    if (hostname.endsWith('.messenger.com')) return true;
    return false;
  } catch {
    return false;
  }
}

function installUserAgentOverride(targetSession = session.defaultSession) {
  if (!targetSession || targetSession.__mzrUAOverrideInstalled) return;
  targetSession.__mzrUAOverrideInstalled = true;
  targetSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    if (isDesktopOnlyUrl(details.url)) {
      headers['User-Agent'] = DESKTOP_USER_AGENT;
    } else {
      headers['User-Agent'] = currentUserAgentMode === 'mobile' ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT;
    }
    callback({ cancel: false, requestHeaders: headers });
  });
}

function applyUserAgentForUrl(contents, url) {
  if (!contents) return;
  const baseUA = currentUserAgentMode === 'mobile' ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT;
  const ua = isDesktopOnlyUrl(url) ? DESKTOP_USER_AGENT : baseUA;
  try { contents.setUserAgent(ua); } catch {}
}

function setCurrentMode(mode) {
  currentMode = mode === 'mobile' ? 'mobile' : 'desktop';
  currentUserAgentMode = currentMode;
}

function getCurrentMode() {
  return currentMode;
}

function getMainWindow() {
  return mainWindow && !mainWindow.isDestroyed?.() ? mainWindow : null;
}

function findMainWindow() {
  const cached = getMainWindow();
  if (cached && cached.__mzrRole !== 'single') {
    return cached;
  }
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed?.() && w.__mzrRole !== 'single') return w;
  }
  return null;
}

function focusMainWindow(winInput) {
  const win = winInput || getMainWindow();
  if (!win || win.isDestroyed?.()) return;
  try {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    if (typeof win.moveTop === 'function') win.moveTop();
    win.flashFrame(true);
    setTimeout(() => { try { win.flashFrame(false); } catch {} }, 1200);
  } catch {}
}

function sendOpenUrl(win, url, activate = true) {
  try {
    if (win && !win.isDestroyed() && win.webContents) {
      win.webContents.send('mzr:open-url', { url, activate });
    }
  } catch {}
}

function flushPendingUrls(win) {
  if (!win || win.isDestroyed?.()) return;
  if (!tabsReady) return;
  try {
    while (pendingOpenUrls.length) {
      const url = pendingOpenUrls.shift();
      sendOpenUrl(win, url, /* activate */ true);
    }
  } catch {}
}

function markTabsReady(targetWindow) {
  tabsReady = true;
  const win = targetWindow || getMainWindow();
  if (win) flushPendingUrls(win);
}

function areTabsReady() {
  return tabsReady;
}

async function openInMain(url, { activate = true } = {}) {
  const win = await getOrCreateMainWindow({ activate });
  if (!win) return;
  if (!tabsReady || win.webContents.isLoading()) {
    pendingOpenUrls.push(url);
    return;
  }
  sendOpenUrl(win, url, /* activate */ true);
}

function getCurrentUserAgentMode() {
  return currentUserAgentMode;
}

async function getOrCreateMainWindow({ activate = true } = {}) {
  let win = findMainWindow();
  if (win) {
    if (activate) focusMainWindow(win);
    return win;
  }

  win = createMainWindow({ role: 'main' });
  await new Promise((resolve) => {
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

function queuePendingUrl(url) {
  pendingOpenUrls.push(url);
}

async function handleWindowOpenFromContents(contents, url) {
  const embedder = contents.hostWebContents || contents;
  let isSingle = false;
  try {
    const u = new URL(embedder.getURL());
    isSingle = u.searchParams.get('single') === '1';
  } catch {}

  if (isSingle) {
    await openInMain(url, { activate: true });
    return;
  }

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
      await openInMain(url, { activate: true });
    }
  } catch {
    await openInMain(url, { activate: true });
  }
}

function applyMobileBounds(win) {
  try {
    const display = screen.getPrimaryDisplay();
    const base = display.size || display.workArea || { width: 0, height: 0 };
    const targetW = Math.max(win.getMinimumSize()[0], base.width - SAFE_RIGHT - 1);
    const targetH = Math.max(win.getMinimumSize()[1], base.height - SAFE_BOTTOM - 1);
    win.setFullScreen(false);
    win.setBounds({ x: 0, y: 0, width: targetW, height: targetH }, false);
  } catch {}
}

function createMainWindow(opts = {}) {
  const config = launchConfig || {};
  const { url: startUrl = DEFAULT_URL, fullscreen, devtools, modeOverride } = config;
  const distIndex = path.resolve(__dirname, '..', '..', 'dist', 'index.html');
  const initialMode = modeOverride || resolveMode();
  currentMode = initialMode;

  if (!fs.existsSync(distIndex)) {
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
    icon: path.resolve(__dirname, '..', '..', 'merezhyvo_256.png'),
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
      preload: path.resolve(__dirname, '..', 'preload.js')
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

  win.once('ready-to-show', () => {
    if (initialMode === 'mobile') {
      applyMobileBounds(win);
    } else if (fullscreen) {
      win.setFullScreen(true);
    }

    if (devtools) win.webContents.openDevTools({ mode: 'detach' });
    win.show();
    win.focus();
  });

  const rebalanceBounds = () => {
    if (initialMode === 'mobile') applyMobileBounds(win);
  };
  screen.on('display-metrics-changed', rebalanceBounds);
  screen.on('display-added', rebalanceBounds);
  screen.on('display-removed', rebalanceBounds);

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
    screen.off('display-metrics-changed', rebalanceBounds);
    screen.off('display-added', rebalanceBounds);
    screen.off('display-removed', rebalanceBounds);
  });

  let role = 'main';
  if (opts.role) {
    role = opts.role;
  } else if (config.single) {
    role = 'single';
  }
  win.__mzrRole = role;

  const query = { start: startUrl, mode: initialMode };
  if (role === 'single') {
    query.single = '1';
  }
  win.loadFile(distIndex, { query });

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
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'mouseWheel' && (input.control || input.meta)) event.preventDefault();
  });
  win.webContents.on('did-start-navigation', (_event, url, isInPlace, isMainFrame) => {
    if (isMainFrame) applyUserAgentForUrl(win.webContents, url);
  });

  if (role === 'main') {
    mainWindow = win;
  }
  return win;
}

function rebalanceMainWindow() {
  const win = getMainWindow();
  if (!win) return;
  const mode = resolveMode();
  setCurrentMode(mode);
  try {
    win.webContents.send('merezhyvo:mode', mode);
  } catch {}
}

function applyBrowserWindowPolicies(win) {
  if (!win) return;

  win.webContents.setVisualZoomLevelLimits(1, 3).catch(() => {});
  win.webContents.on('zoom-changed', () => {
    if (win.isDestroyed()) return;
    const current = win.webContents.getZoomFactor();
    if (typeof current === 'number' && Math.abs(current - 1) > 1e-3) {
      win.webContents.setZoomFactor(1);
    }
  });
  const mode = resolveMode();
  setCurrentMode(mode);
  try {
    applyUserAgentForUrl(win.webContents, win.webContents.getURL());
  } catch {}
}

module.exports = {
  DEFAULT_URL,
  MOBILE_USER_AGENT,
  DESKTOP_USER_AGENT,
  baseZoomFor,
  installDesktopName,
  setLaunchConfig,
  getLaunchConfig,
  installUserAgentOverride,
  applyUserAgentForUrl,
  setCurrentMode,
  getCurrentMode,
  getCurrentUserAgentMode,
  createMainWindow,
  getMainWindow,
  getOrCreateMainWindow,
  focusMainWindow,
  sendOpenUrl,
  flushPendingUrls,
  openInMain,
  markTabsReady,
  areTabsReady,
  queuePendingUrl,
  handleWindowOpenFromContents,
  rebalanceMainWindow,
  applyBrowserWindowPolicies,
  installUserAgentOverrideForSession: installUserAgentOverride
};
