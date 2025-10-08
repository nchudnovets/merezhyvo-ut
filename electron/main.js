'use strict';

const { app, BrowserWindow, Menu, screen, ipcMain } = require('electron');
const path = require('path');
const { existsSync } = require('fs');
const { resolveMode } = require('./mode');
const fs = require('fs');
const https = require('https');
const http = require('http');

const DEFAULT_URL = 'https://duckduckgo.com';
let mainWindow;

app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('use-gl', 'egl');

app.setAppUserModelId('dev.naz.r.merezhyvo');

Menu.setApplicationMenu(null);

const slugify = (s) =>
  (s || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'merezhyvo';

const ensureDir = (dir) => {
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
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

  const s2 = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
  try {
    const { buffer, contentType } = await downloadBinary(s2);
    if (contentType.startsWith('image/')) {
      return { buffer, ext: contentType.includes('png') ? 'png' :
                         contentType.includes('jpeg') ? 'jpg' :
                         contentType.includes('svg') ? 'svg' :
                         contentType.includes('ico') ? 'ico' : 'img' };
    }
  } catch {}

  try {
    const icoUrl = `https://${hostname}/favicon.ico`;
    const { buffer, contentType } = await downloadBinary(icoUrl);
    if (contentType.startsWith('image/')) {
      return { buffer, ext: contentType.includes('png') ? 'png' :
                         contentType.includes('jpeg') ? 'jpg' :
                         contentType.includes('svg') ? 'svg' :
                         'ico' };
    }
  } catch {}

  try {
    const pngUrl = `https://${hostname}/favicon.png`;
    const { buffer, contentType } = await downloadBinary(pngUrl);
    if (contentType.startsWith('image/')) {
      return { buffer, ext: contentType.includes('png') ? 'png' :
                         contentType.includes('jpeg') ? 'jpg' : 'img' };
    }
  } catch {}

  return null;
}

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

    if (/^-/.test(rawArg)) continue;

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

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    if (input.key === 'F12' || (input.control && input.shift && (input.key === 'I' || input.key === 'i'))) {
      event.preventDefault();
      if (!window.isDestroyed()) {
        if (window.webContents.isDevToolsOpened()) window.webContents.closeDevTools();
        else window.webContents.openDevTools({ mode: 'detach' });
      }
      return;
    }

    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      event.preventDefault();
      if (!window.isDestroyed()) window.setFullScreen(!window.isFullScreen());
      return;
    }

    if (input.key === 'Escape') {
      event.preventDefault();
      if (!window.isDestroyed()) {
        if (window.isFullScreen()) window.setFullScreen(false);
        else window.close();
      }
      return;
    }

    if (input.control && (input.key.toLowerCase && input.key.toLowerCase() === 'm')) {
      event.preventDefault();
      if (!window.isDestroyed()) {
        if (window.isMaximized()) window.unmaximize();
        else window.maximize();
      }
      return;
    }

    if (input.control || input.meta || input.alt) {
      event.preventDefault();
    }
  });

  window.once('ready-to-show', () => {
    window.show();
    if (fullscreen) window.setFullScreen(true);
    if (devtools) window.webContents.openDevTools({ mode: 'detach' });
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

const rebalance = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const m = resolveMode();
  try {
    mainWindow.webContents.send('merezhyvo:mode', m);
    mainWindow.webContents.setZoomFactor(m === 'mobile' ? 1.5 : 1.0);
  } catch { /* no-op */ }
};

app.whenReady().then(() => {
  createMainWindow();

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


ipcMain.handle('merezhyvo:createShortcut', async (_e, payload) => {
  const { title, url, single } = payload || {};
  if (!title || !url) {
    return { ok: false, error: 'Title and URL are required.' };
  }

 
  const home = app.getPath('home');
  const appsDir = path.join(home, '.local/share/applications');
  const iconsDir = path.join(home, '.local/share/icons');
  ensureDir(appsDir);
  ensureDir(iconsDir);

  let hostname = '';
  try { hostname = new URL(url).hostname.replace(/^www\./, ''); } catch {}

  const bundledIcon = path.resolve(__dirname, '..', 'merezhyvo_256.png');
  let iconPath = bundledIcon;

  
  try {
    const fav = await tryFetchFaviconFor(hostname);
    if (fav && fav.buffer?.length) {
      const fileName = `${slugify(title)}.${fav.ext}`;
      iconPath = path.join(iconsDir, fileName);
      fs.writeFileSync(iconPath, fav.buffer);
    }
  } catch {
    
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