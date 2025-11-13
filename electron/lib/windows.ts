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
// temporary commented out
// import { installPermissionHandlers, connectPermissionPromptTarget } from './permissions';

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

function geoIpcLog(msg: string): void {
  try {
    // const file = path.join(app.getPath('userData'), 'geo.log');
    // fs.appendFileSync(file, `[${new Date().toISOString()}] ${msg}\n`, 'utf8');
  } catch {
    // ignore
  }
};

function ensureDir(p: string): void {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

// Мінімальна версія прелоада (CommonJS), самодостатня, без залежності від шляхів у пакеті

// commenting it out tmporary and replasing with a silent version below

// const WEBVIEW_PRELOAD_SRC = `
// // *** Merezhyvo webview preload (generated at runtime) ***
// (function(){
//   const { ipcRenderer, webFrame } = require('electron');
//   try { Promise.resolve(ipcRenderer.invoke('mzr:geo:log', 'preload init')); } catch {}

//   // Mirror Notification to host
//   const NativeNotification = window.Notification;
//   class MirrorNotification extends NativeNotification {
//     constructor(title, options) {
//       super(title, options);
//       try {
//         ipcRenderer.sendToHost('mzr:webview:notification', {
//           title,
//           options: {
//             body: (options && options.body) || '',
//             icon: (options && options.icon) || '',
//             data: (options && options.data) || null,
//             tag: (options && options.tag) || ''
//           }
//         });
//       } catch {}
//     }
//   }
//   try { Object.defineProperty(window, 'Notification', { value: MirrorNotification, configurable: true }); } catch {}

//   // Bridge page <-> preload
//   window.addEventListener('message', async (ev) => {
//     var d = ev && ev.data;
//     if (!d || d.channel !== 'MZR_GEO_REQ' || !d.id) return;
//     var origin = window.location.origin;

//     try { await ipcRenderer.invoke('mzr:geo:log', 'preload: req kind=' + (d.kind || 'get') + ' origin=' + origin); } catch {}

//     try {
//       const allowed = await ipcRenderer.invoke('mzr:perms:softRequest', { origin, types: ['geolocation'] });
//       if (!allowed) {
//         try { await ipcRenderer.invoke('mzr:geo:log', 'preload: denied by softRequest'); } catch {}
//         window.postMessage({ channel: 'MZR_GEO_RES', id: d.id, ok: false, errorCode: 1, errorMessage: 'Permission denied' }, '*');
//         return;
//       }

//       const timeoutMs = (d.options && typeof d.options.timeout === 'number') ? d.options.timeout : 8000;
//       const fix = await ipcRenderer.invoke('mzr:geo:getCurrentPosition', { timeoutMs });

//       if (fix) {
//         try { await ipcRenderer.invoke('mzr:geo:log', 'preload: ok lat=' + fix.latitude + ' lon=' + fix.longitude + ' ±' + fix.accuracy); } catch {}
//         window.postMessage({ channel: 'MZR_GEO_RES', id: d.id, ok: true, fix }, '*');
//       } else {
//         try { await ipcRenderer.invoke('mzr:geo:log', 'preload: no position (null)'); } catch {}
//         window.postMessage({ channel: 'MZR_GEO_RES', id: d.id, ok: false, errorCode: 2, errorMessage: 'Position unavailable' }, '*');
//       }
//     } catch (e) {
//       try { await ipcRenderer.invoke('mzr:geo:log', 'preload: error ' + String(e)); } catch {}
//       window.postMessage({ channel: 'MZR_GEO_RES', id: d.id, ok: false, errorCode: 2, errorMessage: String(e) }, '*');
//     }
//   });

//   // Inject MAIN-world shim now (bypasses CSP)
//   (function install(){
//     const code = \`
//       (function(){
//         if (!('geolocation' in navigator)) return;

//         function onceHandler(id, success, error) {
//           function onMsg(ev) {
//             var d = ev && ev.data;
//             if (!d || d.channel !== 'MZR_GEO_RES' || d.id !== id) return;
//             window.removeEventListener('message', onMsg);
//             if (d.ok && d.fix) {
//               var pos = {
//                 coords: {
//                   latitude: d.fix.latitude,
//                   longitude: d.fix.longitude,
//                   accuracy: d.fix.accuracy,
//                   altitude: null,
//                   altitudeAccuracy: null,
//                   heading: null,
//                   speed: null
//                 },
//                 timestamp: d.fix.timestamp
//               };
//               try { success(pos); } catch(_) {}
//             } else if (typeof error === 'function') {
//               error({ code: d.errorCode || 2, message: d.errorMessage || 'Position unavailable' });
//             }
//           }
//           return onMsg;
//         }

//         var geoShim = {
//           getCurrentPosition: function(success, error, options){
//             var id = Math.random().toString(36).slice(2);
//             var handler = onceHandler(id, success, error);
//             window.addEventListener('message', handler);
//             window.postMessage({ channel: 'MZR_GEO_REQ', id: id, kind: 'get', options: { timeout: options && options.timeout, enableHighAccuracy: options && options.enableHighAccuracy, maximumAge: options && options.maximumAge } }, '*');
//           },
//           watchPosition: function(success, error, options){
//             var poll = Math.max(1000, (options && options.maximumAge) || 3000);
//             var active = true;
//             var wid = (Date.now() ^ Math.floor(Math.random()*1e9));
//             function tick(){
//               if (!active) return;
//               var id = Math.random().toString(36).slice(2);
//               var handler = onceHandler(id, success, error);
//               window.addEventListener('message', handler);
//               window.postMessage({ channel: 'MZR_GEO_REQ', id: id, kind: 'get', options: { timeout: options && options.timeout, enableHighAccuracy: options && options.enableHighAccuracy, maximumAge: options && options.maximumAge } }, '*');
//               if (active) setTimeout(tick, poll);
//             }
//             setTimeout(tick, 0);
//             (window.__mzrGeoCancel || (window.__mzrGeoCancel = {}))[wid] = function(){ active = false; };
//             return wid;
//           },
//           clearWatch: function(wid){
//             if (window.__mzrGeoCancel && typeof window.__mzrGeoCancel[wid] === 'function') {
//               window.__mzrGeoCancel[wid]();
//               delete window.__mzrGeoCancel[wid];
//             }
//           }
//         };

//         try {
//           Object.defineProperty(navigator, 'geolocation', { value: geoShim, configurable: true });
//         } catch(_){
//           try {
//             navigator.geolocation.getCurrentPosition = geoShim.getCurrentPosition;
//             navigator.geolocation.watchPosition = geoShim.watchPosition;
//             navigator.geolocation.clearWatch = geoShim.clearWatch;
//           } catch(__){}
//         }
//       })();
//     \`;
//     try { webFrame.executeJavaScriptInIsolatedWorld(0, [{ code }]); } catch (e) {}
//   })();
// })();
// `;

// temporary silent one

const WEBVIEW_PRELOAD_SRC = `
  // *** Merezhyvo webview preload (GEO PAUSED) ***
  (() => {
    const { ipcRenderer } = require('electron');

    // Mirror Notification to host (залишаємо як було)
    const NativeNotification = window.Notification;
    class MirrorNotification extends NativeNotification {
      constructor(title, options) {
        super(title, options);
        try {
          ipcRenderer.sendToHost('mzr:webview:notification', {
            title,
            options: { body: (options && options.body) || '' }
          });
        } catch {}
      }
    }
    try { (window as any).Notification = MirrorNotification; } catch {}

    // TEMP: повністю відключаємо геолокацію в Web API (без IPC, без UI, без логів)
    try {
      const g = (navigator as any).geolocation;
      if (g) {
        const denied = (errCb?: (e: any) => void) => {
          if (typeof errCb === 'function') {
            const e: any = new Error('Geolocation disabled');
            e.code = 1; // PERMISSION_DENIED
            e.PERMISSION_DENIED = 1;
            e.POSITION_UNAVAILABLE = 2;
            e.TIMEOUT = 3;
            errCb(e);
          }
        };
        g.getCurrentPosition = (_ok: any, err?: any) => denied(err);
        g.watchPosition = (_ok: any, err?: any) => { denied(err); return -1 as any; };
        g.clearWatch = (_id: number) => {};
      }
    } catch {}
  })();
  `;

function ensureWebviewPreloadOnDisk(): string {
  const dir = app.getPath('userData'); // ~/.config/merezhyvo
  const file = path.join(dir, 'webview-preload.js');
  try {
    ensureDir(dir);
    fs.writeFileSync(file, WEBVIEW_PRELOAD_SRC, 'utf8');
  } catch (e) {
    // last attempt
    try { ensureDir(dir); fs.writeFileSync(file, WEBVIEW_PRELOAD_SRC, 'utf8'); } catch {}
  }
  try {
    const sz = fs.statSync(file).size;
    geoIpcLog(`ensurePreload wrote ${file} (${sz} bytes)`);
  } catch {}
  return file;
}


export type Mode = 'mobile' | 'desktop';

type LaunchConfig = {
  url?: string;
  fullscreen?: boolean;
  devtools?: boolean;
  modeOverride?: Mode;
  single?: boolean;
  startProvided?: boolean;
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
  const {
    url: startUrl = DEFAULT_URL,
    fullscreen,
    devtools,
    modeOverride,
    startProvided = false
  } = config;
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
  // temporary commented out
  // installPermissionHandlers();  // TO INVESTIGATE: this one breaks out fullscreen mode for videos
  // connectPermissionPromptTarget(win.webContents);

  typedWin.webContents.on(
    'will-attach-webview',
    (_event, webPreferences: WebPreferences & { preload?: string }, params: { src?: string }) => {
      const before = String(webPreferences?.preload || '');
      const preloadPath = ensureWebviewPreloadOnDisk();

      // Force our preload if empty or different (always OK to override)
      webPreferences.preload = preloadPath;

      geoIpcLog(
        `will-attach-webview set preload=${preloadPath} (was='${before}') src=${String(params?.src || '')}`
      );
    }
  );

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

  const query: Record<string, string> = {
    start: startUrl,
    mode: initialMode,
    startProvided: startProvided ? '1' : '0'
  };
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
