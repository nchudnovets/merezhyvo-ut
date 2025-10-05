const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { existsSync } = require('fs');

const DEFAULT_URL = 'https://duckduckgo.com';
let mainWindow;

app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder');
app.commandLine.appendSwitch('use-gl', 'egl');
app.setAppUserModelId('dev.naz.r.merezhyvo');

Menu.setApplicationMenu(null);

const normalizeAddress = (value) => {
  if (!value) {
    return DEFAULT_URL;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return DEFAULT_URL;
  }

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.includes(' ')) {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }

  try {
    const candidate = new URL(trimmed);
    return candidate.href;
  } catch {
    return `https://${trimmed}`;
  }
};

const parseLaunchConfig = () => {
  const offset = process.defaultApp ? 2 : 1;
  const args = process.argv.slice(offset);
  let url = DEFAULT_URL;
  const envFullscreen = (process.env.MEREZHYVO_FULLSCREEN || '').toLowerCase();
  let fullscreen = ['1', 'true', 'yes'].includes(envFullscreen);

  for (const rawArg of args) {
    if (!rawArg) {
      continue;
    }

    if (rawArg === '--fullscreen') {
      fullscreen = true;
      continue;
    }

    if (rawArg === '--no-fullscreen') {
      fullscreen = false;
      continue;
    }

    if (/^-/.test(rawArg)) {
      continue;
    }

    if (url === DEFAULT_URL) {
      url = normalizeAddress(rawArg);
    }
  }

  return { url, fullscreen };
};

const createMainWindow = () => {
  const { url: startUrl, fullscreen } = parseLaunchConfig();
  const distIndex = path.resolve(__dirname, '..', 'dist', 'index.html');

  if (!existsSync(distIndex)) {
    console.error('[merezhyvo] Missing renderer bundle at', distIndex);
  }

  const window = new BrowserWindow({
    width: 420,
    height: 780,
    minWidth: 320,
    minHeight: 480,
    fullscreen: false,
    fullscreenable: true,
    show: false,
    backgroundColor: '#101218',
    title: 'merezhyvo',
    autoHideMenuBar: true,
    resizable: true,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      spellcheck: false,
      defaultFontSize: 16
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') {
      return;
    }

    if (input.key === 'Escape') {
      event.preventDefault();
      if (!window.isDestroyed()) {
        window.close();
      }
      return;
    }

    if (input.control || input.meta || input.alt) {
      event.preventDefault();
    }
  });

  window.once('ready-to-show', () => {
    window.show();
    if (fullscreen) {
      window.setFullScreen(true);
    }
    window.focus();
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  window.loadFile(distIndex, {
    query: {
      start: startUrl
    }
  });

  mainWindow = window;
};

app.whenReady().then(() => {
  createMainWindow();

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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
