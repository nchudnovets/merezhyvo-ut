'use strict';

const { app, BrowserWindow, Menu, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { existsSync } = fs;
const https = require('https');
const http = require('http');
const { resolveMode } = require('./mode');

const DEFAULT_URL = 'https://duckduckgo.com';
let mainWindow;

// ---------- Chromium/Electron flags ----------
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('use-gl', 'egl');
app.commandLine.appendSwitch('enable-pinch'); // enable pinch gestures in the webview
// Optional: force device scale if hit testing drifts
// if (process.env.MZV_FORCE_SCALE === '1') {
//   app.commandLine.appendSwitch('force-device-scale-factor', '1');
// }

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

  for (const rawArg of args) {
    if (!rawArg) continue;
    if (rawArg === '--fullscreen') { fullscreen = true; continue; }
    if (rawArg === '--no-fullscreen') { fullscreen = false; continue; }
    if (rawArg === '--devtools') { devtools = true; continue; }

    const m = rawArg.match(/^--mode=(desktop|mobile)$/i);
    if (m) { modeOverride = m[1].toLowerCase(); continue; }

    if (/^-/.test(rawArg)) continue; // ignore unrelated flags

    if (url === DEFAULT_URL) url = normalizeAddress(rawArg);
  }

  return { url, fullscreen, devtools, modeOverride };
};

// ---------- window lifecycle ----------
const createMainWindow = () => {
  const { url: startUrl, fullscreen, devtools, modeOverride } = parseLaunchConfig();
  const distIndex = path.resolve(__dirname, '..', 'dist', 'index.html');
  const initialMode = modeOverride || resolveMode();

  if (!existsSync(distIndex)) {
    console.error('[Merezhyvo] Missing renderer bundle at', distIndex);
  }

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

  win.loadFile(distIndex, {
    query: { start: startUrl, mode: initialMode }
  });

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

  mainWindow = win;
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
});

// Standard quit behaviour
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC: shortcut creation ----------
ipcMain.handle('merezhyvo:createShortcut', async (_e, payload) => {
  const { title, url, single } = payload || {};
  if (!title || !url) return { ok: false, error: 'Title and URL are required.' };

  const home = app.getPath('home');
  const appsDir = path.join(home, '.local/share/applications');
  const iconsDir = path.join(home, '.local/share/icons');
  ensureDir(appsDir);
  ensureDir(iconsDir);

  let hostname = '';
  try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch {}

  const bundledIcon = path.resolve(__dirname, '..', 'merezhyvo_256.png'); // ensure the asset name matches the project
  let iconPath = bundledIcon;

  // Attempt to fetch a favicon for the site
  try {
    const fav = await tryFetchFaviconFor(hostname);
    if (fav && fav.buffer?.length) {
      const fileName = `${slugify(title)}.${fav.ext}`;
      iconPath = path.join(iconsDir, fileName);
      fs.writeFileSync(iconPath, fav.buffer);
    }
  } catch {
    // If anything fails keep the bundled icon
  }

  const clickBinary = '/opt/click.ubuntu.com/merezhyvo.naz.r/current/app/merezhyvo';
  const localFallback = path.resolve(__dirname, '..', 'app', 'merezhyvo');
  const execPath = fs.existsSync(clickBinary) ? clickBinary : localFallback;

  const singleFlag = single ? ' --single' : '';
  const appIdSlug = slugify(title);
  const desktopFilePath = path.join(appsDir, `merezhyvo-${appIdSlug}.desktop`);

  const desktopContent = `
[Desktop Entry]
Name=${title}
Comment=Site shortcut (${title}) via Merezhyvo
Exec=${execPath} --fullscreen${singleFlag} "${url}"
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

  return { ok: true, desktopFilePath, iconPath };
});
