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
  clipboard
} = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { resolveMode } = require('./mode');

const windows = require('./lib/windows.ts');
const links = require('./lib/links.ts');
const shortcuts = require('./lib/shortcuts.ts');
const tor = require('./lib/tor.ts');

try { nativeTheme.themeSource = 'dark'; } catch {}

const {
  getSessionFilePath,
  createDefaultSettingsState,
  readSettingsState,
  removeInstalledApp,
  registerShortcutHandler
} = shortcuts;

const {
  DEFAULT_URL,
  MOBILE_USER_AGENT,
  DESKTOP_USER_AGENT
} = windows;

const SESSION_SCHEMA = 1;

let playbackBlockerId = null;

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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType && contents.getType() === 'webview') {
    links.attachLinkPolicy(contents);
  }

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
        click: () => windows.handleWindowOpenFromContents(contents, linkUrl)
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
    );

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window: BrowserWindow.fromWebContents(contents) || windows.getMainWindow() });
  });
});

ipcMain.on('mzr:open-context', (event, payload) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;

    const { x = 0, y = 0, dpr = 1 } = payload || {};
    const bounds = win.getBounds();

    const screenX = Math.round(bounds.x + x * dpr);
    const screenY = Math.round(bounds.y + y * dpr);

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

ipcMain.on('tabs:ready', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || windows.getMainWindow();
  windows.markTabsReady(win);
});
