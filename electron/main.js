// electron/main.js
'use strict';

const { app, BrowserWindow, Menu, screen } = require('electron');
const path = require('path');
const { existsSync } = require('fs');
const { resolveMode } = require('./mode');

const DEFAULT_URL = 'https://duckduckgo.com';
let mainWindow;

// GPU flags (base profile that worked best for device)
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('use-gl', 'egl');

// App ID (for icon/notifications on some desktops)
app.setAppUserModelId('dev.naz.r.merezhyvo');

// No app menu
Menu.setApplicationMenu(null);

/**
 * Smart address normalization:
 * - already has scheme => return as-is
 * - contains spaces => search query
 * - single token w/o dot (and not 'localhost') => search query
 * - otherwise try https:// + token
 */
const normalizeAddress = (value) => {
  if (!value || !value.trim()) return DEFAULT_URL;

  const trimmed = value.trim();

  // has scheme
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed;

  // spaces -> search
  if (trimmed.includes(' ')) {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }

  // no dot and not localhost -> search
  if (!trimmed.includes('.') && trimmed.toLowerCase() !== 'localhost') {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }

  // try as hostname
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

  for (const rawArg of args) {
    if (!rawArg) continue;

    if (rawArg === '--fullscreen') { fullscreen = true; continue; }
    if (rawArg === '--no-fullscreen') { fullscreen = false; continue; }
    if (rawArg === '--devtools') { devtools = true; continue; }

    if (/^-/.test(rawArg)) continue; // ignore other flags

    if (url === DEFAULT_URL) {
      url = normalizeAddress(rawArg);
    }
  }

  return { url, fullscreen, devtools };
};

const createMainWindow = () => {
  const { url: startUrl, fullscreen, devtools } = parseLaunchConfig();
  const distIndex = path.resolve(__dirname, '..', 'dist', 'index.html');
  const initialMode = resolveMode();

  if (!existsSync(distIndex)) {
    console.error('[Merezhyvo] Missing renderer bundle at', distIndex);
  }

  const window = new BrowserWindow({
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
      defaultFontSize: initialMode === 'mobile' ? 22 : 16,
      preload: path.resolve(__dirname, 'preload.js')
    }
  });

  // forbid window.open popups
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Keyboard handling (single consolidated handler)
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    // DevTools toggles: F12 or Ctrl+Shift+I
    if (input.key === 'F12' || (input.control && input.shift && (input.key === 'I' || input.key === 'i'))) {
      event.preventDefault();
      if (!window.isDestroyed()) {
        if (window.webContents.isDevToolsOpened()) window.webContents.closeDevTools();
        else window.webContents.openDevTools({ mode: 'detach' });
      }
      return;
    }

    // Toggle fullscreen: F11 or Alt+Enter
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      event.preventDefault();
      if (!window.isDestroyed()) window.setFullScreen(!window.isFullScreen());
      return;
    }

    // Escape: leave fullscreen, otherwise close
    if (input.key === 'Escape') {
      event.preventDefault();
      if (!window.isDestroyed()) {
        if (window.isFullScreen()) window.setFullScreen(false);
        else window.close();
      }
      return;
    }

    // Maximize toggle: Ctrl+M
    if (input.control && (input.key.toLowerCase && input.key.toLowerCase() === 'm')) {
      event.preventDefault();
      if (!window.isDestroyed()) {
        if (window.isMaximized()) window.unmaximize();
        else window.maximize();
      }
      return;
    }

    // Block other Ctrl/Meta/Alt combos from reaching web content
    if (input.control || input.meta || input.alt) {
      event.preventDefault();
    }
  });

  window.once('ready-to-show', () => {
    window.show();
    if (fullscreen) window.setFullScreen(true);
    if (devtools) window.webContents.openDevTools({ mode: 'detach' }); // dev only
    window.focus();
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  window.loadFile(distIndex, {
    query: {
      start: startUrl,
      mode: initialMode
    }
  });

  mainWindow = window;
};

// Rebalance UI when displays change (convergence / dock)
const rebalance = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const m = resolveMode();
  try {
    mainWindow.webContents.send('merezhyvo:mode', m);
    // optional: UI zoom (not page zoom)
    mainWindow.webContents.setZoomFactor(m === 'mobile' ? 1.25 : 1.0);
  } catch { /* no-op */ }
};

app.whenReady().then(() => {
  createMainWindow();

  // react to display changes
  screen.on('display-added', rebalance);
  screen.on('display-removed', rebalance);
  screen.on('display-metrics-changed', rebalance);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('browser-window-created', (_event, window) => {
  window.webContents.setVisualZoomLevelLimits(1, 3).catch(() => {});
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
