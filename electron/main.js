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

// --- Chromium/Electron flags ---
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('use-gl', 'egl');
app.commandLine.appendSwitch('enable-pinch'); // жест pinch у webview

// ID для системи
app.setAppUserModelId('dev.naz.r.merezhyvo');

// без глобального меню
Menu.setApplicationMenu(null);

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

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed; // схема є

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

    if (/^-/.test(rawArg)) continue; // інші прапорці пропускаємо

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
      defaultFontSize: initialMode === 'mobile' ? 22 : 16,
      preload: path.resolve(__dirname, 'preload.js')
    }
  });

  // блокуємо всі window.open
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // хоткеї для оболонки (не для webview)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    // DevTools оболонки
    if (input.key === 'F12' || (input.control && input.shift && (input.key === 'I' || input.key === 'i'))) {
      event.preventDefault();
      if (!win.isDestroyed()) {
        if (win.webContents.isDevToolsOpened()) win.webContents.closeDevTools();
        else win.webContents.openDevTools({ mode: 'detach' });
      }
      return;
    }

    // Fullscreen toggle
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      event.preventDefault();
      if (!win.isDestroyed()) win.setFullScreen(!win.isFullScreen());
      return;
    }

    // Esc: вийти з фулскріну або закрити
    if (input.key === 'Escape') {
      event.preventDefault();
      if (!win.isDestroyed()) {
        if (win.isFullScreen()) win.setFullScreen(false);
        else win.close();
      }
      return;
    }

    // Ctrl+M: toggle maximize
    if (input.control && (input.key.toLowerCase && input.key.toLowerCase() === 'm')) {
      event.preventDefault();
      if (!win.isDestroyed()) {
        if (win.isMaximized()) win.unmaximize();
        else win.maximize();
      }
      return;
    }

    // блокуємо модифікаторні комбінації для хоста (щоб вони не масштабували оболонку)
    if (input.control || input.meta || input.alt) {
      event.preventDefault();
    }
  });

  win.once('ready-to-show', () => {
    win.show();
    if (fullscreen) win.setFullScreen(true);
    if (devtools) win.webContents.openDevTools({ mode: 'detach' });
    win.focus();
  });

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.loadFile(distIndex, {
    query: { start: startUrl, mode: initialMode }
  });

  // блок зуму оболонки (тільки для host webContents)
  win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {});
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'mouseWheel' && (input.control || input.meta)) e.preventDefault();
  });

  mainWindow = win;
};

// при зміні екранів — просто шлемо новий режим у рендерер
const rebalance = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const m = resolveMode();
  try {
    mainWindow.webContents.send('merezhyvo:mode', m);
    // НЕ чіпаємо mainWindow.webContents.setZoomFactor — зум робимо у <webview>
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

// продублюємо блок хоста (для всіх вікон, якщо зʼявляться)
app.on('browser-window-created', (_event, win) => {
  win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {});
});

// звичайний вихід
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- IPC: створення ярлика ----------
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

  const bundledIcon = path.resolve(__dirname, '..', 'merezhyvo_256.png'); // перевір назву у проєкті
  let iconPath = bundledIcon;

  // спробуємо витягти favicon
  try {
    const fav = await tryFetchFaviconFor(hostname);
    if (fav && fav.buffer?.length) {
      const fileName = `${slugify(title)}.${fav.ext}`;
      iconPath = path.join(iconsDir, fileName);
      fs.writeFileSync(iconPath, fav.buffer);
    }
  } catch {
    // ігноруємо — лишимо bundledIcon
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
