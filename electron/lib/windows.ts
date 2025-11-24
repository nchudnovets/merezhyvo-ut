'use strict';

import path from 'path';
import fs from 'fs';
import {
  app,
  BrowserWindow,
  screen,
  session,
  type App,
  type DownloadItem,
  type Event,
  type Input,
  type Session,
  type WebContents,
  type WebPreferences
} from 'electron';
import type { FileDialogOptions } from '../../src/types/models';
import { resolveMode } from '../mode';
import { addVisit, updateTitle, updateFavicon } from './history';
import { saveFromBuffer } from './favicons';
import {
  linkGuestWebContentsToHost,
  promptForPaths,
  unlinkGuestWebContents
} from './file-dialog-ipc';
import { DOCUMENTS_FOLDER } from './internal-paths';
import * as downloads from './downloads';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
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
const fsp = fs.promises;
type FileDialogDetails = {
  properties?: string[];
  title?: string;
};

const autoCloseSkipIds = new Set<number>();

const DEFAULT_DOWNLOAD_BASENAME = 'download';

const ensureUniqueFilenameSync = (dir: string, base: string): string => {
  const normalized = downloads.sanitizeFilename(base || DEFAULT_DOWNLOAD_BASENAME);
  const ext = path.extname(normalized);
  const name = path.basename(normalized, ext) || DEFAULT_DOWNLOAD_BASENAME;
  let candidate = normalized;
  let idx = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    idx += 1;
    candidate = `${name} (${idx})${ext}`;
  }
  return candidate;
};

const deriveDownloadFilename = (item: DownloadItem, url: string): string => {
  try {
    const suggested = item.getFilename?.();
    if (suggested) {
      return downloads.sanitizeFilename(suggested);
    }
  } catch {
    // noop
  }
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.pathname) {
        const candidate = path.basename(parsed.pathname);
        if (candidate) {
          return downloads.sanitizeFilename(candidate);
        }
      }
    } catch {
      // noop
    }
  }
  return downloads.sanitizeFilename(DEFAULT_DOWNLOAD_BASENAME);
};

const normalizeDownloadBytes = (value?: number): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return value;
};

export function skipAutoCloseForDownload(webContentsId: number): void {
  if (!Number.isFinite(webContentsId)) return;
  autoCloseSkipIds.add(webContentsId);
}

type WebContentsWithFileDialogHandler = WebContents & {
  setFileDialogHandler?: (
    handler: (details: FileDialogDetails) => Promise<{ canceled: boolean; filePaths: string[] }>
  ) => void;
};
const fileDialogHandlerRegistry = new WeakSet<WebContents>();
const selectFileInterceptorRegistry = new WeakSet<WebContents>();

function geoIpcLog(_msg: string): void {
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

const TS_WEBVIEW_PRELOAD = path.join(__dirname, '..', 'electron', 'webview-preload.ts');

function ensureWebviewPreloadOnDisk(): string {
  const dir = app.getPath('userData');
  const file = path.join(dir, 'webview-preload.js');
  let source = '';
  try {
    source = fs.readFileSync(TS_WEBVIEW_PRELOAD, 'utf8');
  } catch {
    source = '';
  }
  const transpile = (src: string): string => {
    try {
      const transpiled = transpileModule(src, {
        compilerOptions: {
          module: ModuleKind.CommonJS,
          target: ScriptTarget.ES2020,
          removeComments: true
        }
      });
      return transpiled.outputText;
    } catch {
      return '';
    }
  };
  const payload = source ? transpile(source) : '';
  const content = payload || `
    console.log('[webview] fallback preload loaded');
  `;
  try {
    ensureDir(dir);
    fs.writeFileSync(file, content, 'utf8');
  } catch {
    try { ensureDir(dir); fs.writeFileSync(file, content, 'utf8'); } catch {}
  }
  try {
    const sz = fs.statSync(file).size;
    geoIpcLog(`ensurePreload wrote ${file} (${sz} bytes)`);
  } catch {}
  return file;
}

export const installFileDialogHandler = (contents: WebContentsWithFileDialogHandler | null): void => {
  if (!contents || typeof contents.isDestroyed !== 'function' || contents.isDestroyed()) return;
  if (fileDialogHandlerRegistry.has(contents)) return;
  const setter = contents.setFileDialogHandler;
  if (typeof setter !== 'function') return;
  fileDialogHandlerRegistry.add(contents);
  setter(async (details: FileDialogDetails) => {
    const dialogDetails = details as FileDialogDetails;
    const properties = Array.isArray(dialogDetails.properties) ? dialogDetails.properties : [];
    const allowDirectory = properties.includes('openDirectory');
    const allowMultiple = properties.includes('multiSelections');
    const options: FileDialogOptions = {
      kind: allowDirectory ? 'folder' : 'file',
      allowMultiple,
      title: details.title,
      initialPath: DOCUMENTS_FOLDER
    };
    const paths = await promptForPaths(contents, options);
    if (!paths || !paths.length) {
      return { canceled: true, filePaths: [] };
    }
    return { canceled: false, filePaths: paths };
  });
};


export type Mode = 'mobile' | 'desktop';

type LaunchConfig = {
  url?: string;
  fullscreen?: boolean;
  devtools?: boolean;
  modeOverride?: Mode;
  startProvided?: boolean;
};

type WindowRole = 'main' | string;
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
  if (cached) {
    return cached;
  }
  for (const candidate of BrowserWindow.getAllWindows()) {
    const typed = candidate as MerezhyvoWindow;
    if (!typed.isDestroyed?.()) return typed;
  }
  return null;
}

downloads.onState((entry) => {
  const hostContents = findMainWindow()?.webContents;
  if (!hostContents) return;
  const status =
    entry.state === 'downloading'
      ? 'started'
      : entry.state === 'completed'
      ? 'completed'
      : 'failed';
  const file = entry.filename || '';
  hostContents.send('merezhyvo:download-status', { status, file });
  hostContents.send('merezhyvo:downloads:state', { id: entry.id, state: entry.state });
});

downloads.onProgress((entry) => {
  const hostContents = findMainWindow()?.webContents;
  if (!hostContents) return;
  hostContents.send('merezhyvo:downloads:progress', {
    id: entry.id,
    received: entry.received,
    total: entry.total
  });
});

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

const closeBlankDownloadTab = (contents: WebContents | null, downloadUrl: string): void => {
    if (!contents || typeof contents.isDestroyed !== 'function' || contents.isDestroyed()) return;
    const host = (contents as WebContentsWithHost).hostWebContents;
    if (host) return;
    if (contents.id === typedWin.webContents.id) return;
    try {
      const canGoBack = typeof contents.canGoBack === 'function' ? contents.canGoBack() : false;
      const currentUrl = typeof contents.getURL === 'function' ? contents.getURL() || '' : '';
      if (canGoBack) return;
      if (!currentUrl || currentUrl === downloadUrl) {
        const owner = BrowserWindow.fromWebContents(contents);
        if (owner && !owner.isDestroyed()) {
          owner.close();
        }
      }
    } catch {
      // noop
    }
  };

  const closeDownloadContentsIfNeeded = (
    downloadContents: WebContents | null,
    downloadUrl: string
  ): void => {
    if (!downloadContents) return;
    if (autoCloseSkipIds.has(downloadContents.id)) {
      autoCloseSkipIds.delete(downloadContents.id);
      return;
    }
    typedWin.webContents.send('mzr-close-tab', {
      webContentsId: downloadContents.id,
      url: downloadUrl
    });
  };

  const handleNativeItemDownload = (item: DownloadItem, downloadUrl: string): void => {
    try {
      const targetDir = downloads.getDefaultDir();
      if (!targetDir) return;
      ensureDir(targetDir);
      const suggested = deriveDownloadFilename(item, downloadUrl);
      const filename = ensureUniqueFilenameSync(targetDir, suggested);
      const finalPath = path.join(targetDir, filename);
      item.setSavePath(finalPath);
      const manualHandle = downloads.beginManualDownload({
        url: downloadUrl,
        filename,
        total: normalizeDownloadBytes(item.getTotalBytes())
      });
      const updateProgress = () => {
        manualHandle.updateProgress(
          item.getReceivedBytes(),
          normalizeDownloadBytes(item.getTotalBytes())
        );
      };
      updateProgress();
      const cleanup = () => {
        try {
          item.off('updated', updateProgress);
        } catch {
          // noop
        }
      };
      item.on('updated', updateProgress);
      item.once('done', (_event, state) => {
        cleanup();
        const success = state === 'completed';
        const errorMessage = success
          ? undefined
          : state === 'cancelled'
          ? 'download cancelled'
          : state === 'interrupted'
          ? 'download interrupted'
          : `download ${state}`;
        manualHandle.finalize(success, errorMessage);
      });
    } catch (err) {
      console.error('[downloads] native download handling failed', err);
    }
  };
  const handleWillDownload = (event: Event, item: DownloadItem, downloadContents: WebContents | null) => {
    const url = typeof item.getURL === 'function' ? item.getURL() || '' : '';
    const isHttpDownload = /^https?:\/\//.test(url);
    closeBlankDownloadTab(downloadContents, url);
    if (!isHttpDownload) {
      handleNativeItemDownload(item, url);
      closeDownloadContentsIfNeeded(downloadContents, url);
      return;
    }
    event.preventDefault();
    const refGetter = (item as { getReferrerURL?: () => unknown }).getReferrerURL;
    let referer =
      typeof refGetter === 'function' ? (refGetter() as string | undefined) : undefined;
    if (!referer) {
      try {
        const fallback = downloadContents?.getURL();
        if (fallback) referer = fallback;
      } catch {
        // noop
      }
    }
    downloads.enqueue(url, referer, downloadContents?.session ?? session.defaultSession);
    closeDownloadContentsIfNeeded(downloadContents, url);
  };
  typedWin.webContents.session.on('will-download', handleWillDownload);
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
    linkGuestWebContentsToHost(contents, typedWin.webContents);
    contents.once('destroyed', () => {
      unlinkGuestWebContents(contents);
    });
    installFileDialogHandler(contents);
    setupSelectFileInterceptor(contents);
    if (typeof contents.setMaxListeners === 'function') {
      contents.setMaxListeners(0);
    }
    const listeners: Array<{ event: string; handler: (...args: unknown[]) => void }> = [];
    const register = <T extends unknown[]>(event: string, handler: (...args: T) => void) => {
      listeners.push({ event, handler: handler as (...args: unknown[]) => void });
      contents.on(event as never, handler as never);
    };

    const cleanup = () => {
      for (const { event, handler } of listeners) {
        try {
          contents.removeListener(event as never, handler as never);
        } catch {
          // ignore
        }
      }
    };
    const survived = { destroyed: false };
    const onDestroyed = () => {
      if (survived.destroyed) return;
      survived.destroyed = true;
      cleanup();
    };

    register('did-start-navigation', (_evt, navUrl: string, _isInPlace: boolean, isMainFrame: boolean) => {
      if (isMainFrame) applyUserAgentForUrl(contents, navUrl);
    });

    const deriveOrigin = (value: string): string | null => {
      try {
        const parsed = new URL(value);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          return parsed.origin;
        }
      } catch {
        // noop
      }
      return null;
    };

    const getCurrentUrl = (): string => {
      try {
        return typeof contents.getURL === 'function' ? contents.getURL() || '' : '';
      } catch {
        return '';
      }
    };

    const safeAddVisit = async (navUrl: string | undefined, transition: string): Promise<void> => {
      const target = navUrl?.trim();
      if (!target) return;
      try {
        await addVisit({
          url: target,
          origin: deriveOrigin(target),
          transition,
          ts: Date.now(),
          wcId: contents.id
        });
      } catch {
        // ignore history errors
      }
    };

    const safeUpdateTitle = async (title: string | undefined): Promise<void> => {
      const value = typeof title === 'string' ? title.trim() : '';
      const url = getCurrentUrl();
      if (!url || !value) return;
      try {
        await updateTitle(url, value);
      } catch {
        // swallow
      }
    };

    const parseDataUri = (value: string): { buffer: Buffer; contentType?: string } | null => {
      if (!value.startsWith('data:')) return null;
      const comma = value.indexOf(',');
      if (comma === -1) return null;
      const meta = value.substring(5, comma);
      const data = value.substring(comma + 1);
      const isBase64 = meta.includes('base64');
      const buffer = isBase64 ? Buffer.from(data, 'base64') : Buffer.from(decodeURIComponent(data), 'utf8');
      const firstSegment = meta.split(';')[0];
      return { buffer, contentType: firstSegment || undefined };
    };

    const fetchFaviconBuffer = async (href: string): Promise<{ buffer: Buffer; contentType?: string } | null> => {
      if (!href) return null;
      const fromData = parseDataUri(href);
      if (fromData) return fromData;
      try {
        const parsed = new URL(href);
        if (parsed.protocol === 'file:') {
          const filePath = decodeURI(parsed.pathname);
          const buffer = await fsp.readFile(filePath);
          return { buffer };
        }
      } catch {
        // ignore
      }
      const universalFetch = typeof globalThis.fetch === 'function' ? globalThis.fetch : null;
      if (!universalFetch) return null;
      try {
        const response = await universalFetch(href, { method: 'GET' });
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = response.headers.get('content-type') ?? undefined;
        return { buffer, contentType };
      } catch {
        return null;
      }
    };

    const safeUpdateFavicon = async (icons: unknown): Promise<void> => {
      const url = getCurrentUrl();
      if (!url) return;
      const list = Array.isArray(icons) ? icons : [];
      for (const raw of list) {
        const href = typeof raw === 'string' ? raw.trim() : '';
        if (!href) continue;
        try {
          const data = await fetchFaviconBuffer(href);
          if (!data) continue;
          const faviconId = await saveFromBuffer(data.buffer, data.contentType ?? null, href);
          await updateFavicon(url, faviconId);
          return;
        } catch {
          continue;
        }
      }
    };

    register('did-navigate', (_evt, navUrl: string) => {
      void safeAddVisit(navUrl, 'link');
    });
    register('did-navigate-in-page', (_evt, navUrl: string, isMainFrame: boolean) => {
      if (!isMainFrame) return;
      void safeAddVisit(navUrl, 'in-page');
    });
    register('page-title-updated', (_evt, title: string) => {
      void safeUpdateTitle(title);
    });
    register('page-favicon-updated', (_evt, icons: unknown) => {
      void safeUpdateFavicon(icons);
    });
    register('destroyed', onDestroyed);
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
    try {
      typedWin.webContents.session.off('will-download', handleWillDownload);
    } catch {
      // noop
    }
  });

  const role: WindowRole = opts.role ?? 'main';
  typedWin.__mzrRole = role;

  const query: Record<string, string> = {
    start: startUrl,
    mode: initialMode,
    startProvided: startProvided ? '1' : '0'
  };
  typedWin.loadFile(distIndex, { query });

  typedWin.webContents.setVisualZoomLevelLimits(1, 3).catch(() => {});
  setupSelectFileInterceptor(typedWin.webContents);
  installFileDialogHandler(typedWin.webContents);
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
  setupSelectFileInterceptor(win.webContents);
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
export const setupSelectFileInterceptor = (contents: WebContents | null): void => {
  if (!contents || typeof contents.isDestroyed !== 'function' || contents.isDestroyed()) return;
  if (selectFileInterceptorRegistry.has(contents)) return;
  selectFileInterceptorRegistry.add(contents);
  const handler = async (event: Event, ...args: unknown[]) => {
    try {
      event.preventDefault?.();
    } catch {}
    const propertiesArg = args.find(
      (value) => typeof value === 'object' && value !== null && 'properties' in value
    ) as { properties?: string[] } | undefined;
    const properties = Array.isArray(propertiesArg?.properties) ? propertiesArg?.properties : [];
    const allowDirectory = properties.includes('openDirectory');
    const allowMultiple = properties.includes('multiSelections');
    const options: FileDialogOptions = {
      kind: allowDirectory ? 'folder' : 'file',
      allowMultiple,
      title: '',
      initialPath: DOCUMENTS_FOLDER
    };
    const paths = await promptForPaths(contents, options);
    const callback = args.find((value) => typeof value === 'function') as
      | ((paths: string[]) => void)
      | undefined;
    if (typeof callback !== 'function') return;
    if (!paths || !paths.length) {
      callback([]);
      return;
    }
    callback(paths);
  };
  contents.on('select-file', handler);
};
