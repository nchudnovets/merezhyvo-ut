'use strict';

import fs from 'fs';
import path from 'path';
import {
  app,
  BrowserWindow,
  Menu,
  clipboard,
  ipcMain,
  nativeTheme,
  powerSaveBlocker,
  screen,
  session,
  webContents,
  type BrowserWindowConstructorOptions,
  type ContextMenuParams,
  type Event,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type Point,
  type WebContents
} from 'electron';

import { resolveMode } from './mode';
import * as windows from './lib/windows';
import * as links from './lib/links';
import {
  createDefaultSettingsState,
  getSessionFilePath,
  readSettingsState,
  removeInstalledApp,
  registerShortcutHandler
} from './lib/shortcuts';
import * as tor from './lib/tor';
import { updateTorConfig } from './lib/tor-settings';
import { registerKeyboardSettingsIPC } from './lib/keyboard-settings-ipc';

const requireWithExtensions = require as NodeJS.Require & { extensions: NodeJS.RequireExtensions };
if (!requireWithExtensions.extensions['.ts']) {
  requireWithExtensions.extensions['.ts'] = requireWithExtensions.extensions['.js'];
}

try {
  nativeTheme.themeSource = 'dark';
} catch {
  // noop
}

const fsp = fs.promises;

const { DEFAULT_URL, MOBILE_USER_AGENT, DESKTOP_USER_AGENT } = windows;

const SESSION_SCHEMA = 1;

type ContextMenuMode = windows.Mode;

type ExtendedContextMenuParams = ContextMenuParams & {
  menuSourceType?: string;
  sourceType?: string;
};

type ContextMenuPayload = {
  id?: string;
};

type ContextMenuSizePayload = {
  width?: number;
  height?: number;
};

type LaunchConfig = {
  url: string;
  fullscreen: boolean;
  devtools: boolean;
  modeOverride: ContextMenuMode | null;
  forceDark: boolean;
  single: boolean;
};

type SessionTab = {
  id: string;
  url: string;
  title: string;
  favicon: string;
  pinned: boolean;
  muted: boolean;
  discarded: boolean;
  lastUsedAt: number;
};

type SessionState = {
  schema: typeof SESSION_SCHEMA;
  activeId: string;
  tabs: SessionTab[];
};

type SessionPayloadLike = {
  schema?: unknown;
  activeId?: unknown;
  tabs?: unknown;
};

type SessionTabLike = {
  id?: unknown;
  url?: unknown;
  title?: unknown;
  favicon?: unknown;
  pinned?: unknown;
  muted?: unknown;
  discarded?: unknown;
  lastUsedAt?: unknown;
};

type ContextState = {
  wcId: number | null;
  params: ContextMenuParams | null;
  x: number;
  y: number;
  linkUrl: string;
};

type LastOpenSignature = {
  ts: number;
  x: number;
  y: number;
  ownerId: number;
};

type BrowserWindowOptions = BrowserWindowConstructorOptions & { roundedCorners?: boolean };

type WebContentsWithHost = WebContents & { hostWebContents?: WebContents | null };

declare global {
  var lastCtx: ContextState | undefined;
}

let playbackBlockerId: number | null = null;

let ctxWin: BrowserWindow | null = null;
let ctxOpening = false;
let ctxOverlay: BrowserWindow | null = null;
let ctxMenuMode: ContextMenuMode = 'desktop';

global.lastCtx = global.lastCtx ?? {
  wcId: null,
  params: null,
  x: 0,
  y: 0,
  linkUrl: ''
};

app.setName('Merezhyvo');
app.setAppUserModelId('dev.naz.r.merezhyvo');

windows.installDesktopName();

Menu.setApplicationMenu(null);

const stopPlaybackBlocker = (id?: number | null): void => {
  const blockerId = typeof id === 'number' ? id : playbackBlockerId;
  if (typeof blockerId !== 'number') return;
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
};

const makeSessionTabId = (): string =>
  `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createDefaultSessionState = (): SessionState => {
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

const sanitizeSessionPayload = (payload: unknown): SessionState => {
  const now = Date.now();
  const source = payload as SessionPayloadLike | null | undefined;
  if (!source || typeof source !== 'object' || source.schema !== SESSION_SCHEMA) {
    return createDefaultSessionState();
  }

  const tabsSource = Array.isArray(source.tabs) ? (source.tabs as SessionTabLike[]) : [];
  const tabs: SessionTab[] = [];

  for (const raw of tabsSource) {
    if (!raw || typeof raw !== 'object') continue;
    const id =
      typeof raw.id === 'string' && raw.id.trim().length ? raw.id.trim() : makeSessionTabId();
    const url =
      typeof raw.url === 'string' && raw.url.trim().length ? raw.url.trim() : DEFAULT_URL;
    const title = typeof raw.title === 'string' ? raw.title : '';
    const favicon = typeof raw.favicon === 'string' ? raw.favicon : '';
    const pinned = Boolean(raw.pinned);
    const muted = Boolean(raw.muted);
    const discarded = Boolean(raw.discarded);
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

  const payloadActiveId = source.activeId;
  const activeId =
    typeof payloadActiveId === 'string' && tabs.some((tab) => tab.id === payloadActiveId)
      ? payloadActiveId
      : tabs[0]?.id ?? makeSessionTabId();

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

const normalizeAddress = (value: string | null | undefined): string => {
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

const clampToWorkArea = (x: number, y: number, w: number, h: number): Point => {
  const disp = screen.getDisplayNearestPoint({ x, y });
  const wa = disp?.workArea ?? { x: 0, y: 0, width: 1920, height: 1080 };
  const nx = Math.max(wa.x, Math.min(x, wa.x + wa.width - w));
  const ny = Math.max(wa.y, Math.min(y, wa.y + h > wa.y + wa.height ? wa.y + wa.height - h : y));
  return { x: nx, y: ny };
};

const isTouchSource = (params: ContextMenuParams | null | undefined): boolean => {
  const typed = params as ExtendedContextMenuParams | null | undefined;
  const src = String(typed?.menuSourceType ?? typed?.sourceType ?? '').toLowerCase();
  return [
    'touch',
    'longpress',
    'longtap',
    'touchmenu',
    'touchhandle',
    'stylus',
    'adjustselection',
    'adjustselectionreset'
  ].includes(src);
};

const resolveOwnerWindow = (wc: WebContents): BrowserWindow | null => {
  const withHost = wc as WebContentsWithHost;
  let owner: WebContents = wc;
  try {
    if (withHost.hostWebContents && !withHost.hostWebContents.isDestroyed()) {
      owner = withHost.hostWebContents;
    }
  } catch {
    // noop
  }
  return BrowserWindow.fromWebContents(owner) ?? BrowserWindow.getFocusedWindow() ?? null;
};

const getTargetWebContents = (contents?: WebContents | null): WebContents | null =>
  contents ?? BrowserWindow.getFocusedWindow()?.webContents ?? null;

let lastOpenSig: LastOpenSignature = { ts: 0, x: 0, y: 0, ownerId: 0 };
const shouldOpenCtxNow = (
  x: number | null | undefined,
  y: number | null | undefined,
  ownerId: number | null | undefined
): boolean => {
  const now = Date.now();
  const dt = now - lastOpenSig.ts;
  const dx = Math.abs((x ?? 0) - (lastOpenSig.x ?? 0));
  const dy = Math.abs((y ?? 0) - (lastOpenSig.y ?? 0));
  const sameOwner = ownerId && ownerId === lastOpenSig.ownerId;
  if (dt < 300 && sameOwner && dx < 8 && dy < 8) return false;
  lastOpenSig = { ts: now, x: x ?? 0, y: y ?? 0, ownerId: ownerId ?? 0 };
  return true;
};

const destroyCtxWindows = (): void => {
  try {
    if (ctxWin && !ctxWin.isDestroyed()) ctxWin.close();
  } catch {
    // noop
  }
  try {
    if (ctxOverlay && !ctxOverlay.isDestroyed()) ctxOverlay.close();
  } catch {
    // noop
  }
  ctxWin = null;
  ctxOverlay = null;
};

const openCtxWindowFor = async (
  contents: WebContents | null,
  params: ContextMenuParams | null | undefined
): Promise<void> => {
  const rawMode = windows.getCurrentMode ? windows.getCurrentMode() : null;
  const normalizedMode: ContextMenuMode = rawMode === 'mobile' ? 'mobile' : 'desktop';

  if (isTouchSource(params) && normalizedMode !== 'mobile') {
    return;
  }

  ctxMenuMode = normalizedMode;

  if (ctxOpening) return;
  ctxOpening = true;
  setTimeout(() => {
    ctxOpening = false;
  }, 280);

  const targetWc = getTargetWebContents(contents);
  if (!targetWc || targetWc.isDestroyed()) return;

  const ownerWin = resolveOwnerWindow(targetWc);
  if (!ownerWin || ownerWin.isDestroyed()) return;

  const cursor = screen.getCursorScreenPoint();
  const ownerId = ownerWin.webContents.id;
  if (!shouldOpenCtxNow(cursor.x, cursor.y, ownerId)) return;

  global.lastCtx = {
    wcId: targetWc.id,
    params: params ?? null,
    x: cursor.x,
    y: cursor.y,
    linkUrl: params?.linkURL ?? ''
  };

  destroyCtxWindows();

  const disp = screen.getDisplayNearestPoint({ x: cursor.x, y: cursor.y });
  const wa = disp?.workArea ?? { x: 0, y: 0, width: 1920, height: 1080 };

  const overlayOptions: BrowserWindowConstructorOptions = {
    x: wa.x,
    y: wa.y,
    width: wa.width,
    height: wa.height,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: true,
    backgroundColor: '#01000000',
    transparent: true,
    hasShadow: false,
    type: 'popup',
    parent: ownerWin ?? undefined,
    modal: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      devTools: process.env.MZV_CTXMENU_DEVTOOLS === '1'
    }
  };

  ctxOverlay = new BrowserWindow(overlayOptions);

  try {
    ctxOverlay.setAlwaysOnTop(true, 'floating');
  } catch {
    // noop
  }
  ctxOverlay.setMenuBarVisibility(false);

  const overlayHtml = [
    '<!doctype html><meta charset="utf-8"/>',
    '<style>',
    'html,body{margin:0;padding:0;width:100%;height:100%;background:transparent;cursor:default;}',
    'body{user-select:none;-webkit-user-select:none;}',
    '</style>',
    '<script>',
    'document.addEventListener("pointerdown", function(){',
    '  try{ require("electron").ipcRenderer.send("mzr:ctxmenu:close"); }catch(e){}',
    '});',
    'window.addEventListener("contextmenu", function(e){ e.preventDefault(); }, {passive:false});',
    'window.addEventListener("keydown", function(e){ if(e.key==="Escape"){ try{ require("electron").ipcRenderer.send("mzr:ctxmenu:close"); }catch(_){} } });',
    '</script>',
    '<body></body>'
  ].join('');

  try {
    await ctxOverlay.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayHtml)}`);
  } catch {
    // noop
  }

  ctxOverlay.on('closed', () => {
    if (ctxOverlay) ctxOverlay = null;
  });

  const htmlPath = path.resolve(__dirname, '..', 'electron', 'context-menu.html');
  const baseWidth = ctxMenuMode === 'mobile' ? 360 : 260;
  const baseHeight = ctxMenuMode === 'mobile' ? 320 : 220;
  const desired = clampToWorkArea(cursor.x + 8, cursor.y + 10, baseWidth, baseHeight);

  const popupOptions: BrowserWindowOptions = {
    width: baseWidth,
    height: baseHeight,
    x: desired.x,
    y: desired.y,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: true,
    backgroundColor: '#1c1c1cee',
    transparent: false,
    hasShadow: true,
    roundedCorners: true,
    type: 'popup',
    parent: ctxOverlay ?? undefined,
    modal: false,
    useContentSize: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      devTools: process.env.MZV_CTXMENU_DEVTOOLS === '1'
    }
  };

  ctxWin = new BrowserWindow(popupOptions);

  try {
    ctxWin.setAlwaysOnTop(true, 'modal-panel');
  } catch {
    // noop
  }

  ctxWin.on('closed', () => {
    try {
      if (ctxOverlay && !ctxOverlay.isDestroyed()) ctxOverlay.close();
    } catch {
      // noop
    }
    ctxWin = null;
    ctxOverlay = null;
  });

  const ctxUrl = `file://${htmlPath}?mode=${ctxMenuMode}`;
  void ctxWin.loadURL(ctxUrl).catch(() => {});

  const askRender = () => {
    if (!ctxWin || ctxWin.isDestroyed()) return;
    try {
      ctxWin.webContents.send('mzr:ctxmenu:render');
    } catch {
      // noop
    }
    void ctxWin.webContents
      .executeJavaScript('window.__mzr_render && window.__mzr_render()')
      .catch(() => {});
    try {
      if (ctxOverlay && !ctxOverlay.isDestroyed() && !ctxOverlay.isVisible()) ctxOverlay.show();
      if (!ctxWin.isVisible()) ctxWin.show();
      ctxWin.focus();
    } catch {
      // noop
    }
    setTimeout(() => {
      if (!ctxWin || ctxWin.isDestroyed()) return;
      try {
        const bounds = ctxWin.getBounds();
        if (bounds.height <= 14) {
          const fallbackHeight = ctxMenuMode === 'mobile' ? baseHeight : 220;
          const fallbackWidth = ctxMenuMode === 'mobile' ? baseWidth : bounds.width;
          ctxWin.setBounds(
            { x: bounds.x, y: bounds.y, width: fallbackWidth, height: fallbackHeight },
            false
          );
          if (!ctxWin.isVisible()) ctxWin.show();
        }
      } catch {
        // noop
      }
    }, 160);
  };

  ctxWin.webContents.once('did-finish-load', askRender);
  setTimeout(askRender, 260);
};

const parseMode = (raw: string | null | undefined): ContextMenuMode | null => {
  if (!raw) return null;
  const value = raw.toLowerCase();
  return value === 'desktop' || value === 'mobile' ? (value as ContextMenuMode) : null;
};

const parseLaunchConfig = (): LaunchConfig => {
  const offset = process.defaultApp ? 2 : 1;
  const args = process.argv.slice(offset);
  let url = DEFAULT_URL;
  const envFullscreen = (process.env.MEREZHYVO_FULLSCREEN ?? '').toLowerCase();
  let fullscreen = ['1', 'true', 'yes'].includes(envFullscreen);
  let devtools = process.env.MZV_DEVTOOLS === '1';
  let modeOverride = parseMode(process.env.MZV_MODE ?? '');
  const envForceDark = (process.env.MZV_FORCE_DARK ?? '').toLowerCase();
  let forceDark = ['1', 'true', 'yes'].includes(envForceDark);
  let singleWindow = false;

  for (const rawArg of args) {
    if (!rawArg) continue;
    if (rawArg === '--force-dark') {
      forceDark = true;
      continue;
    }
    if (rawArg === '--no-force-dark') {
      forceDark = false;
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
    if (rawArg === '--devtools') {
      devtools = true;
      continue;
    }
    if (rawArg === '--single') {
      singleWindow = true;
      continue;
    }

    const modeMatch = rawArg.match(/^--mode=(desktop|mobile)$/i);
    if (modeMatch) {
      const [, modeValue] = modeMatch;
      if (modeValue) {
        modeOverride = modeValue.toLowerCase() as ContextMenuMode;
      }
      continue;
    }

    if (/^-/.test(rawArg)) continue;

    if (url === DEFAULT_URL) url = normalizeAddress(rawArg);
  }

  return { url, fullscreen, devtools, modeOverride, forceDark, single: singleWindow };
};

const launchConfig = parseLaunchConfig();
windows.setLaunchConfig({
  url: launchConfig.url,
  fullscreen: launchConfig.fullscreen,
  devtools: launchConfig.devtools,
  modeOverride: launchConfig.modeOverride ?? undefined,
  single: launchConfig.single
});

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
registerKeyboardSettingsIPC();

app.whenReady().then(() => {
  const initialMode = resolveMode();
  windows.setCurrentMode(initialMode);
  const initialUA = initialMode === 'mobile' ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT;
  try {
    session.defaultSession?.setUserAgent(initialUA);
  } catch {
    // noop
  }
  windows.installUserAgentOverride(session.defaultSession);
  windows.createMainWindow();

  screen.on('display-added', () => windows.rebalanceMainWindow());
  screen.on('display-removed', () => windows.rebalanceMainWindow());
  screen.on('display-metrics-changed', () => windows.rebalanceMainWindow());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windows.createMainWindow();
    }
  });
});

app.on('browser-window-created', (_event: Event, win: BrowserWindow) => {
  windows.applyBrowserWindowPolicies(win);
  win.webContents.on('before-input-event', (_event, input) => {
    const button = (input as { button?: string }).button;
    if (input.type === 'mouseDown' && button === 'right') {
      const cursor = screen.getCursorScreenPoint();
      const ownerId = win.webContents.id;
      if (!shouldOpenCtxNow(cursor.x, cursor.y, ownerId)) return;
      void openCtxWindowFor(win.webContents, null);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (_event: Event, contents: WebContents) => {
  if (typeof contents.getType === 'function' && contents.getType() === 'webview') {
    links.attachLinkPolicy(contents);
  }
  contents.on('context-menu', (event, params) => {
    try {
      event.preventDefault();
    } catch {
      // noop
    }
    void openCtxWindowFor(contents, params);
  });
});

ipcMain.handle('mzr:ctxmenu:get-state', async () => {
  try {
    const ctx = global.lastCtx;
    const wc = ctx?.wcId != null ? webContents.fromId(ctx.wcId) : undefined;
    const canBack = wc?.canGoBack?.() ?? false;
    const canForward = wc?.canGoForward?.() ?? false;

    const params = ctx?.params ?? null;
    const selection = params?.selectionText ?? '';
    const hasSelection = Boolean(selection && selection.trim().length);
    const isEditable = Boolean(params?.isEditable);

    let canPaste = false;
    try {
      const text = clipboard.readText() ?? '';
      canPaste = Boolean(isEditable && text.length > 0);
    } catch {
      // noop
    }

    const linkUrl = ctx?.linkUrl ?? '';
    return { canBack, canForward, hasSelection, isEditable, canPaste, linkUrl };
  } catch {
    return {
      canBack: false,
      canForward: false,
      hasSelection: false,
      isEditable: false,
      canPaste: false,
      linkUrl: ''
    };
  }
});

ipcMain.on('mzr:ctxmenu:click', (_event, payload: ContextMenuPayload) => {
  const id = payload?.id;
  if (!id) return;
  try {
    const ctx = global.lastCtx;
    const wc = ctx?.wcId != null ? webContents.fromId(ctx.wcId) : undefined;
    if (!wc || wc.isDestroyed()) return;

    if (id === 'back') return void wc.goBack?.();
    if (id === 'forward') return void wc.goForward?.();
    if (id === 'reload') return void wc.reload?.();
    if (id === 'copy-selection') {
      const text = ctx?.params?.selectionText ?? '';
      if (text) clipboard.writeText(text);
      return;
    }
    if (id === 'open-link') {
      const url = ctx?.linkUrl;
      if (url) {
        const withHost = wc as WebContentsWithHost;
        const embedder = withHost.hostWebContents ?? wc;
        const ownerWin =
          BrowserWindow.fromWebContents(embedder) ?? BrowserWindow.getFocusedWindow();
        if (ownerWin && !ownerWin.isDestroyed()) {
          windows.sendOpenUrl(ownerWin, url, true);
        }
      }
      return;
    }
    if (id === 'copy-link') {
      const url = ctx?.linkUrl;
      if (url) clipboard.writeText(url);
      return;
    }
    if (id === 'paste') {
      try {
        wc.paste();
      } catch {
        try {
          const withHost = wc as WebContentsWithHost;
          const embedder = withHost.hostWebContents ?? wc;
          const ownerWin =
            BrowserWindow.fromWebContents(embedder) ?? BrowserWindow.getFocusedWindow();
          if (ownerWin && !ownerWin.isDestroyed()) {
            const menu = Menu.buildFromTemplate([{ role: 'paste' }]);
            menu.popup({ window: ownerWin });
          }
        } catch {
          // noop
        }
      }
      return;
    }
    if (id === 'inspect') {
      try {
        wc.openDevTools({ mode: 'detach' });
      } catch {
        // noop
      }
    }
  } catch {
    // ignore errors
  } finally {
    try {
      if (ctxWin && !ctxWin.isDestroyed()) ctxWin.close();
    } catch {
      // noop
    }
  }
});

ipcMain.on('mzr:ctxmenu:close', () => {
  try {
    if (ctxWin && !ctxWin.isDestroyed()) ctxWin.close();
  } catch {
    // noop
  }
});

ipcMain.on('mzr:ctxmenu:autosize', (_event, { height, width }: ContextMenuSizePayload) => {
  try {
    const win = ctxWin;
    if (!win || win.isDestroyed()) return;
    const bounds = win.getBounds();
    const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
    const wa = display?.workArea;

    const minHeight = 44;
    const rawHeight = typeof height === 'number' ? height : Number(height);
    const measuredHeight = Math.max(
      minHeight,
      Math.floor(Number.isFinite(rawHeight) ? rawHeight : 120)
    );
    const maxHeight =
      ctxMenuMode === 'mobile'
        ? Math.max(minHeight, wa ? wa.height - 16 : measuredHeight)
        : 480;
    const targetHeight = Math.min(measuredHeight, maxHeight);

    let targetWidth = bounds.width;
    if (ctxMenuMode === 'mobile') {
      const minWidth = 220;
      const rawWidth = typeof width === 'number' ? width : Number(width);
      const measuredWidth = Math.max(
        minWidth,
        Math.floor(Number.isFinite(rawWidth) ? rawWidth : bounds.width)
      );
      const maxWidth = wa ? Math.max(minWidth, wa.width - 16) : measuredWidth;
      targetWidth = Math.min(measuredWidth, maxWidth);
    }

    const pos = clampToWorkArea(bounds.x, bounds.y, targetWidth, targetHeight);
    win.setBounds({ x: pos.x, y: pos.y, width: targetWidth, height: targetHeight }, false);
    if (!win.isVisible()) win.show();
  } catch {
    // noop
  }
});

ipcMain.handle('merezhyvo:session:load', async () => {
  try {
    const sessionFile = getSessionFilePath();
    let parsed: unknown = null;
    try {
      const raw = await fsp.readFile(sessionFile, 'utf8');
      parsed = JSON.parse(raw) as unknown;
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
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

ipcMain.handle('merezhyvo:session:save', async (_event: IpcMainInvokeEvent, payload: unknown) => {
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

ipcMain.handle('merezhyvo:settings:installedApps:remove', async (_event, payload: unknown) => {
  const id =
    typeof payload === 'string'
      ? payload
      : typeof payload === 'object' && payload && typeof (payload as { id?: unknown }).id === 'string'
      ? ((payload as { id?: string }).id ?? null)
      : null;
  const desktopFilePath =
    typeof payload === 'object' && payload && typeof (payload as { desktopFilePath?: unknown }).desktopFilePath === 'string'
      ? ((payload as { desktopFilePath?: string }).desktopFilePath ?? null)
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

ipcMain.handle('merezhyvo:settings:tor:update', async (_event, payload: unknown) => {
  const containerId =
    typeof payload === 'object' && payload && typeof (payload as { containerId?: unknown }).containerId === 'string'
      ? ((payload as { containerId?: string }).containerId ?? '').trim()
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

ipcMain.handle('merezhyvo:power:stop', (_event, explicitId: number | null | undefined) => {
  stopPlaybackBlocker(explicitId ?? null);
  return true;
});

ipcMain.handle('merezhyvo:power:isStarted', (_event, explicitId: number | null | undefined) => {
  const id = typeof explicitId === 'number' ? explicitId : playbackBlockerId;
  return typeof id === 'number' && powerSaveBlocker.isStarted(id);
});

ipcMain.on('tabs:ready', (event: IpcMainEvent) => {
  const win =
    BrowserWindow.fromWebContents(event.sender) ??
    windows.getMainWindow() ??
    null;
  windows.markTabsReady(win);
});
