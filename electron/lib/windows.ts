'use strict';

import path from 'path';
import fs from 'fs';
import {
  app,
  BrowserWindow,
  screen,
  session,
  type App,
  type Input,
  type Session,
  type WebContents,
  type WebPreferences
} from 'electron';
import { resolveMode } from '../mode';
import { installPermissionHandlers, connectPermissionPromptTarget } from './permissions';

export const DEFAULT_URL = 'https://duckduckgo.com';
export const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';
export const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const DESKTOP_ONLY_HOSTS = new Set<string>([
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

export type Mode = 'mobile' | 'desktop';

type LaunchConfig = {
  url?: string;
  fullscreen?: boolean;
  devtools?: boolean;
  modeOverride?: Mode;
  single?: boolean;
};

type WindowRole = 'main' | 'single' | string;
type MerezhyvoWindow = BrowserWindow & { __mzrRole?: WindowRole };
type AppWithDesktopName = App & { setDesktopName?: (name: string) => void };
type SessionWithOverride = Session & { __mzrUAOverrideInstalled?: boolean };
type WebContentsWithHost = WebContents & { hostWebContents?: WebContents | null };

let launchConfig: LaunchConfig | null = null;
let currentMode: Mode | null = null;
let currentUserAgentMode: Mode = 'desktop';
let userAgentOverride: Mode | null = null;
let mainWindow: MerezhyvoWindow | null = null;
const pendingOpenUrls: string[] = [];
let tabsReady = false;

const normalizeMode = (mode: Mode | string | null | undefined): Mode =>
  mode === 'mobile' ? 'mobile' : 'desktop';

export function installDesktopName(): void {
  const desktopAwareApp = app as AppWithDesktopName;
  if (process.platform !== 'linux' || typeof desktopAwareApp.setDesktopName !== 'function') return;

  const base = 'merezhyvo.naz.r_merezhyvo';
  const ver = typeof app.getVersion === 'function' ? app.getVersion() : null;

  let desktopName: string | null = ver ? `${base}_${ver}.desktop` : null;

  if (!desktopName) {
    try {
      const appsDir = path.join(app.getPath('home'), '.local', 'share', 'applications');
      const candidates = fs
        .readdirSync(appsDir)
        .filter((file) => file.startsWith(`${base}_`) && file.endsWith('.desktop'))
        .sort()
        .reverse();
      if (candidates.length) desktopName = candidates[0] ?? null;
    } catch {
      // ignore read failures
    }
  }

  if (desktopName) {
    try {
      desktopAwareApp.setDesktopName?.(desktopName);
    } catch {
      // noop
    }
  }
}

export function setLaunchConfig(config: LaunchConfig | null | undefined): void {
  launchConfig = config ? { ...config } : null;
}

export function getLaunchConfig(): LaunchConfig | null {
  return launchConfig;
}

function isDesktopOnlyUrl(url: string): boolean {
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

export function installUserAgentOverride(targetSession: Session | null = session.defaultSession): void {
  if (!targetSession) return;
  const sessionWithFlag = targetSession as SessionWithOverride;
  if (sessionWithFlag.__mzrUAOverrideInstalled) return;
  sessionWithFlag.__mzrUAOverrideInstalled = true;
  sessionWithFlag.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    const ua = isDesktopOnlyUrl(details.url)
      ? DESKTOP_USER_AGENT
      : currentUserAgentMode === 'mobile'
      ? MOBILE_USER_AGENT
      : DESKTOP_USER_AGENT;
    headers['User-Agent'] = ua;
    callback({ cancel: false, requestHeaders: headers });
  });
}

export function applyUserAgentForUrl(contents: WebContents | null | undefined, url: string): void {
  if (!contents) return;
  const baseUA = currentUserAgentMode === 'mobile' ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT;
  const ua = isDesktopOnlyUrl(url) ? DESKTOP_USER_AGENT : baseUA;
  try {
    contents.setUserAgent(ua);
  } catch {
    // noop
  }
}

const refreshUserAgentMode = (): void => {
  const nextMode = userAgentOverride ?? currentMode ?? 'desktop';
  if (currentUserAgentMode !== nextMode) {
    currentUserAgentMode = nextMode;
    try {
      session.defaultSession?.setUserAgent(
        nextMode === 'mobile' ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT
      );
    } catch {
      // noop
    }
  }
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      applyUserAgentForUrl(win.webContents, win.webContents.getURL());
    }
  } catch {
    // noop
  }
};

export function setCurrentMode(mode: Mode | string | null | undefined): void {
  currentMode = normalizeMode(mode);
  refreshUserAgentMode();
}

export function setUserAgentOverride(mode: Mode | 'auto' | null | undefined): void {
  if (mode === 'desktop' || mode === 'mobile') {
    userAgentOverride = mode;
  } else {
    userAgentOverride = null;
  }
  refreshUserAgentMode();
}

export function getCurrentMode(): Mode | null {
  return currentMode;
}

export function getMainWindow(): MerezhyvoWindow | null {
  return mainWindow && !mainWindow.isDestroyed?.() ? mainWindow : null;
}

function findMainWindow(): MerezhyvoWindow | null {
  const cached = getMainWindow();
  if (cached && cached.__mzrRole !== 'single') {
    return cached;
  }
  for (const candidate of BrowserWindow.getAllWindows()) {
    const typed = candidate as MerezhyvoWindow;
    if (!typed.isDestroyed?.() && typed.__mzrRole !== 'single') return typed;
  }
  return null;
}

export function focusMainWindow(winInput?: MerezhyvoWindow | null): void {
  const win = winInput ?? getMainWindow();
  if (!win || win.isDestroyed?.()) return;
  try {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    (win as { moveTop?: () => void }).moveTop?.();
    win.flashFrame(true);
    setTimeout(() => {
      try {
        win.flashFrame(false);
      } catch {
        // noop
      }
    }, 1200);
  } catch {
    // noop
  }
}

export function sendOpenUrl(win: MerezhyvoWindow | null | undefined, url: string, activate = true): void {
  try {
    if (win && !win.isDestroyed?.()) {
      win.webContents?.send('mzr:open-url', { url, activate });
    }
  } catch {
    // noop
  }
}

export function flushPendingUrls(win: MerezhyvoWindow | null | undefined): void {
  if (!win || win.isDestroyed?.() || !tabsReady) return;
  try {
    while (pendingOpenUrls.length) {
      const nextUrl = pendingOpenUrls.shift();
      if (!nextUrl) continue;
      sendOpenUrl(win, nextUrl, true);
    }
  } catch {
    // noop
  }
}

export function markTabsReady(targetWindow?: MerezhyvoWindow | null): void {
  tabsReady = true;
  const win = targetWindow ?? getMainWindow();
  if (win) flushPendingUrls(win);
}

export function areTabsReady(): boolean {
  return tabsReady;
}

export async function openInMain(
  url: string,
  { activate = true }: { activate?: boolean } = {}
): Promise<void> {
  const win = await getOrCreateMainWindow({ activate });
  if (!win) return;
  if (!tabsReady || win.webContents.isLoading()) {
    pendingOpenUrls.push(url);
    return;
  }
  sendOpenUrl(win, url, true);
}

export function getCurrentUserAgentMode(): Mode {
  return currentUserAgentMode;
}

export async function getOrCreateMainWindow(
  { activate = true }: { activate?: boolean } = {}
): Promise<MerezhyvoWindow | null> {
  let win = findMainWindow();
  if (win) {
    if (activate) focusMainWindow(win);
    return win;
  }

  win = createMainWindow({ role: 'main' });
  await new Promise<void>((resolve) => {
    const onReady = () => {
      win?.off('ready-to-show', onReady);
      if (activate) focusMainWindow(win);
      resolve();
    };
    const maybeReady = win as MerezhyvoWindow & { isReadyToShow?: () => boolean };
    if (typeof maybeReady.isReadyToShow === 'function' && maybeReady.isReadyToShow()) onReady();
    else win.once('ready-to-show', onReady);
  });
  return win;
}

export function queuePendingUrl(url: string): void {
  pendingOpenUrls.push(url);
}

export async function handleWindowOpenFromContents(contents: WebContents, url: string): Promise<void> {
  const embedder = (contents as WebContentsWithHost).hostWebContents ?? contents;
  let isSingle = false;
  try {
    const currentUrl = embedder.getURL();
    const parsed = new URL(currentUrl);
    isSingle = parsed.searchParams.get('single') === '1';
  } catch {
    // noop
  }

  if (isSingle) {
    await openInMain(url, { activate: true });
    return;
  }

  try {
    const win = BrowserWindow.fromWebContents(embedder) as MerezhyvoWindow | null;
    if (win && !win.isDestroyed?.()) {
      if (!tabsReady || win.webContents.isLoading()) {
        pendingOpenUrls.push(url);
        focusMainWindow(win);
      } else {
        sendOpenUrl(win, url, true);
        focusMainWindow(win);
      }
    } else {
      await openInMain(url, { activate: true });
    }
  } catch {
    await openInMain(url, { activate: true });
  }
}

function applyMobileBounds(win: MerezhyvoWindow): void {
  try {
    const display = screen.getPrimaryDisplay();
    const base = display.size ?? display.workArea ?? { width: 0, height: 0 };
    const [minWidth = 0, minHeight = 0] = win.getMinimumSize();
    const baseWidth = typeof base.width === 'number' ? base.width : 0;
    const baseHeight = typeof base.height === 'number' ? base.height : 0;
    const targetW = Math.max(minWidth, baseWidth - SAFE_RIGHT - 1);
    const targetH = Math.max(minHeight, baseHeight - SAFE_BOTTOM - 1);
    win.setFullScreen(false);
    win.setBounds({ x: 0, y: 0, width: targetW, height: targetH }, false);
  } catch {
    // noop
  }
}

type CreateMainWindowOptions = {
  role?: WindowRole;
};

export function createMainWindow(opts: CreateMainWindowOptions = {}): MerezhyvoWindow {
  const config = launchConfig ?? {};
  const { url: startUrl = DEFAULT_URL, fullscreen, devtools, modeOverride } = config;
  const distIndex = path.resolve(__dirname, '..', 'dist', 'index.html');
  const initialModeCandidate = (modeOverride ?? resolveMode()) as Mode;
  const initialMode = normalizeMode(initialModeCandidate);
  setCurrentMode(initialMode);

  if (!fs.existsSync(distIndex)) {
    console.error('[Merezhyvo] Missing renderer bundle at', distIndex);
  }

  installUserAgentOverride(session.defaultSession);
  const webPreferences: WebPreferences & { nativeWindowOpen?: boolean } = {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    webviewTag: true,
    spellcheck: false,
    nativeWindowOpen: false,
    defaultFontSize: initialMode === 'mobile' ? 28 : 16,
    preload: path.resolve(__dirname, 'preload.js')
  };
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
    icon: path.resolve(__dirname, '..', 'merezhyvo_256.png'),
    autoHideMenuBar: true,
    resizable: true,
    useContentSize: true,
    webPreferences
  });
  const typedWin = win as MerezhyvoWindow;
  try {
    applyUserAgentForUrl(typedWin.webContents, startUrl);
  } catch {
    // noop
  }
  installPermissionHandlers();
  connectPermissionPromptTarget(win.webContents);

  typedWin.webContents.on('did-attach-webview', (_event, contents) => {
    try {
      const current = typeof contents.getURL === 'function' ? contents.getURL() : '';
      applyUserAgentForUrl(contents, current);
    } catch {
      // noop
    }
    contents.on('did-start-navigation', (_evt, navUrl: string, _isInPlace: boolean, isMainFrame: boolean) => {
      if (isMainFrame) applyUserAgentForUrl(contents, navUrl);
    });
  });

  typedWin.once('ready-to-show', () => {
    if (initialMode === 'mobile') {
      applyMobileBounds(typedWin);
    } else if (fullscreen) {
      typedWin.setFullScreen(true);
    }

    if (devtools) typedWin.webContents.openDevTools({ mode: 'detach' });
    typedWin.show();
    typedWin.focus();
  });

  const rebalanceBounds = () => {
    if (initialMode === 'mobile') applyMobileBounds(typedWin);
  };
  screen.on('display-metrics-changed', rebalanceBounds);
  screen.on('display-added', rebalanceBounds);
  screen.on('display-removed', rebalanceBounds);

  typedWin.on('closed', () => {
    if (mainWindow === typedWin) mainWindow = null;
    screen.off('display-metrics-changed', rebalanceBounds);
    screen.off('display-added', rebalanceBounds);
    screen.off('display-removed', rebalanceBounds);
  });

  let role: WindowRole = opts.role ?? 'main';
  if (!opts.role && config.single) {
    role = 'single';
  }
  typedWin.__mzrRole = role;

  const query: Record<string, string> = { start: startUrl, mode: initialMode };
  if (role === 'single') {
    query.single = '1';
  }
  typedWin.loadFile(distIndex, { query });

  typedWin.webContents.setVisualZoomLevelLimits(1, 3).catch(() => {});
  const resetHostZoom = () => {
    if (typedWin.isDestroyed()) return;
    const current = typedWin.webContents.getZoomFactor();
    if (typeof current === 'number' && Math.abs(current - 1) > 1e-3) {
      typedWin.webContents.setZoomFactor(1);
    }
  };
  typedWin.webContents.once('did-finish-load', () => {
    flushPendingUrls(typedWin);
  });
  typedWin.webContents.on('zoom-changed', resetHostZoom);
  typedWin.webContents.on('before-input-event', (event, input: Input) => {
    if (input.type === 'mouseWheel' && (input.control || input.meta)) event.preventDefault();
  });
  typedWin.webContents.on('did-start-navigation', (_event, navUrl: string, _isInPlace: boolean, isMainFrame: boolean) => {
    if (isMainFrame) applyUserAgentForUrl(typedWin.webContents, navUrl);
  });

  if (role === 'main') {
    mainWindow = typedWin;
  }
  return typedWin;
}

export function rebalanceMainWindow(): void {
  const win = getMainWindow();
  if (!win) return;
  const mode = resolveMode() as Mode;
  setCurrentMode(mode);
  try {
    win.webContents.send('merezhyvo:mode', mode);
  } catch {
    // noop
  }
}

export function applyBrowserWindowPolicies(win: MerezhyvoWindow | null): void {
  if (!win) return;

  win.webContents.setVisualZoomLevelLimits(1, 3).catch(() => {});
  win.webContents.on('zoom-changed', () => {
    if (win.isDestroyed()) return;
    const current = win.webContents.getZoomFactor();
    if (typeof current === 'number' && Math.abs(current - 1) > 1e-3) {
      win.webContents.setZoomFactor(1);
    }
  });
  const mode = resolveMode() as Mode;
  setCurrentMode(mode);
  try {
    applyUserAgentForUrl(win.webContents, win.webContents.getURL());
  } catch {
    // noop
  }
}
