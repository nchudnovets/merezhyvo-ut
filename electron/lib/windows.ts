'use strict';

import path from 'path';
import fs from 'fs';
import {
  app,
  BrowserWindow,
  screen,
  session,
  webContents,
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
import { getTorState } from './tor-state';
import {
  linkGuestWebContentsToHost,
  promptForPaths,
  unlinkGuestWebContents
} from './file-dialog-ipc';
import { getKnownNetworkTimezone } from './network-geo';
import '../js-dialog-handler';
import { DOCUMENTS_FOLDER } from './internal-paths';
import * as downloads from './downloads';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
// temporary commented out
// import { installPermissionHandlers, connectPermissionPromptTarget } from './permissions';

export const DEFAULT_URL = 'https://start.duckduckgo.com';
const resolveChromeVersion = (): { full: string; major: number } => {
  const raw = typeof process.versions?.chrome === 'string' ? process.versions.chrome.trim() : '';
  const major = raw ? Number.parseInt(raw.split('.')[0] ?? '0', 10) : 0;
  const full = raw || (Number.isFinite(major) && major > 0 ? `${major}.0.0.0` : '0.0.0.0');
  return { full, major: Number.isFinite(major) ? major : 0 };
};

const resolveArchToken = (): string => {
  const arch = process.arch;
  if (arch === 'arm64') return 'aarch64';
  if (arch === 'x64') return 'x86_64';
  return arch || 'x86_64';
};

const chromeVersion = resolveChromeVersion();
const uaArchToken = resolveArchToken();
const uaPlatformToken = `X11; Linux ${uaArchToken}`;

export const MOBILE_USER_AGENT =
  `Mozilla/5.0 (${uaPlatformToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion.full} Mobile Safari/537.36`;
export const DESKTOP_USER_AGENT =
  `Mozilla/5.0 (${uaPlatformToken}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion.full} Safari/537.36`;
export const GOOGLE_MOBILE_USER_AGENT =
  `Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion.full} Mobile Safari/537.36`;

const UA_DEBUG_ENABLED = process.env.MZR_UA_DEBUG === '1';
const UA_DEBUG_FILE_NAME = 'ua-debug.log';
const ANTI_BOT_DEBUG_TOKENS = [
  'datadome',
  'captcha',
  'challenge',
  'cloudflare',
  'turnstile',
  'akamai',
  'perimeterx',
  'px-captcha',
  'captcha-delivery'
];
const antiBotFrameDebugKeys = new Set<string>();
let uaDebugLogInitialized = false;

const uaDebuggerAttachedContents = new WeakSet<WebContents>();
const uaDebuggerHookedContents = new WeakSet<WebContents>();
const uaDebuggerSessionIdsByContents = new WeakMap<WebContents, Set<string>>();

const OSK_FOCUS_ACTIVE_MARKER = '__MZR_OSK_FOCUS_ON__';
const OSK_FOCUS_INACTIVE_MARKER = '__MZR_OSK_FOCUS_OFF__';
const OSK_CDP_BINDING_NAME = '__mzrOskFocusBinding';
const OSK_CDP_FOCUS_BRIDGE_SCRIPT = `
(() => {
  try {
    if (window.__mzrCdpOskFocusBridgeInstalled) return;
    window.__mzrCdpOskFocusBridgeInstalled = true;

    const ACTIVE_MARKER = '${OSK_FOCUS_ACTIVE_MARKER}';
    const INACTIVE_MARKER = '${OSK_FOCUS_INACTIVE_MARKER}';
    const BINDING_NAME = '${OSK_CDP_BINDING_NAME}';
    const NON_TEXT_TYPES = new Set([
      'button', 'submit', 'reset', 'checkbox', 'radio',
      'range', 'color', 'file', 'image', 'hidden'
    ]);

    const asElement = (target) => {
      if (!target) return null;
      if (target.nodeType === Node.ELEMENT_NODE) return target;
      return target.parentElement || null;
    };

    const isEditable = (target) => {
      const el = asElement(target);
      if (!el) return false;
      if (el.isContentEditable) return true;
      const editableHost = el.closest
        ? el.closest('[contenteditable="true"],[contenteditable=""],[contenteditable="plaintext-only"]')
        : null;
      if (editableHost) return true;
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'textarea') return !el.disabled && !el.readOnly;
      if (tag !== 'input') return false;
      const type = String(el.getAttribute('type') || el.type || '').toLowerCase();
      if (NON_TEXT_TYPES.has(type)) return false;
      return !el.disabled && !el.readOnly;
    };

    const editableElement = (target) => {
      const el = asElement(target);
      if (!el) return null;
      if (isEditable(el)) return el;
      return el.closest
        ? el.closest('input,textarea,[contenteditable="true"],[contenteditable=""],[contenteditable="plaintext-only"]')
        : null;
    };

    const likelyTextIframe = (target) => {
      const el = asElement(target);
      if (!el || String(el.tagName || '').toUpperCase() !== 'IFRAME') return null;
      try {
        const haystack = [
          el.getAttribute('src'),
          el.getAttribute('title'),
          el.getAttribute('name'),
          el.getAttribute('aria-label'),
          el.getAttribute('id'),
          el.getAttribute('class')
        ].map((value) => String(value || '').toLowerCase()).join(' ');
        if (!haystack) return null;
        return /login|log-in|signin|sign-in|auth|connexion|connect|identifiant|identifier|password|account|client|espace/.test(haystack)
          ? el
          : null;
      } catch {
        return null;
      }
    };

    const deepActive = () => {
      let current = document.activeElement;
      let depth = 0;
      while (current && depth < 5) {
        const shadow = current.shadowRoot;
        if (shadow && shadow.activeElement) {
          current = shadow.activeElement;
          depth += 1;
          continue;
        }
        break;
      }
      return current;
    };

    const emitToHost = (message, payload) => {
      try {
        const binding = window[BINDING_NAME];
        if (typeof binding === 'function') {
          binding(JSON.stringify({
            message,
            href: String(location.href || ''),
            topFrame: window.top === window,
            now: Math.round(performance.now()),
            payload: payload || null
          }));
        }
      } catch {}
      try {
        console.info(message);
      } catch {}
    };

    const debug = () => {};

    const notify = (flag, reason, el) => {
      emitToHost(flag ? ACTIVE_MARKER : INACTIVE_MARKER, {
        event: flag ? 'cdp.focus.active.marker' : 'cdp.focus.inactive.marker',
        reason,
        href: String(location.href || ''),
        topFrame: window.top === window,
        now: Math.round(performance.now())
      });
      debug(flag ? 'cdp.focus.active' : 'cdp.focus.inactive', reason, el || null);
    };

    const handleCandidate = (reason, target) => {
      const direct = editableElement(target);
      const active = editableElement(deepActive());
      const textFrame = likelyTextIframe(target) || likelyTextIframe(deepActive());
      const el = direct && isEditable(direct) ? direct : active && isEditable(active) ? active : textFrame;
      if (!el) return;
      if (isEditable(el)) {
        try { window.__mzrLastEditable = el; } catch {}
      }
      notify(true, reason, el);
    };

    const handlePointerCandidate = (target) => {
      const direct = editableElement(target);
      const textFrame = likelyTextIframe(target);
      if (direct && isEditable(direct)) {
        try { window.__mzrLastEditable = direct; } catch {}
        notify(true, 'pointerdown', direct);
        return;
      }
      if (textFrame) {
        notify(true, 'pointerdown-iframe-candidate', textFrame);
        return;
      }
      notify(false, 'pointerdown-noneditable', asElement(target));
    };

    const checkActive = (reason) => {
      handleCandidate(reason, deepActive());
    };

    document.addEventListener('pointerdown', (event) => {
      handlePointerCandidate(event.target);
    }, true);

    document.addEventListener('focusin', (event) => {
      handleCandidate('focusin', event.target);
    }, true);

    document.addEventListener('focusout', () => {
      setTimeout(() => {
        const active = editableElement(deepActive());
        const textFrame = likelyTextIframe(deepActive());
        if (active && isEditable(active)) {
          try { window.__mzrLastEditable = active; } catch {}
          notify(true, 'focusout-still-editable', active);
        } else if (textFrame) {
          notify(true, 'focusout-still-editable-frame', textFrame);
        } else {
          notify(false, 'focusout', active || null);
        }
      }, 0);
    }, true);

    debug('cdp.bridge.installed', 'install', null);
    checkActive('install-active');
    setTimeout(() => checkActive('install-active-delay-50'), 50);
    setTimeout(() => checkActive('install-active-delay-250'), 250);
    setTimeout(() => checkActive('install-active-delay-750'), 750);
  } catch {}
})();
`;

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
const topLevelHostsByWc = new Map<number, string>();

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

type PreloadSource = {
  sourcePath: string;
  source: string;
  isTs: boolean;
};

const resolveWebviewPreloadSource = (): PreloadSource | null => {
  const appPath = (() => {
    try {
      return app.getAppPath();
    } catch {
      return '';
    }
  })();
  const candidates = [
    path.join(__dirname, '..', 'webview-preload.ts'),
    path.join(__dirname, '..', 'webview-preload.js'),
    appPath ? path.join(appPath, 'electron', 'webview-preload.ts') : '',
    appPath ? path.join(appPath, 'electron', 'webview-preload.js') : '',
    appPath ? path.join(appPath, 'dist-electron', 'webview-preload.js') : '',
    path.join(process.cwd(), 'electron', 'webview-preload.ts'),
    path.join(process.cwd(), 'electron', 'webview-preload.js')
  ].filter((candidate) => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const source = fs.readFileSync(candidate, 'utf8');
      if (!source.trim()) continue;
      return {
        sourcePath: candidate,
        source,
        isTs: candidate.endsWith('.ts')
      };
    } catch {
      // try next candidate
    }
  }
  return null;
};

function ensureWebviewPreloadOnDisk(): string {
  const dir = app.getPath('userData');
  const file = path.join(dir, 'webview-preload.js');
  const resolved = resolveWebviewPreloadSource();
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
  const payload = resolved
    ? (resolved.isTs ? transpile(resolved.source) : resolved.source)
    : '';
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
    geoIpcLog(
      `ensurePreload wrote ${file} (${sz} bytes) source=${resolved?.sourcePath || 'fallback'} isTs=${resolved?.isTs ? '1' : '0'}`
    );
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

function isGoogleServiceUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    if (!hostname) return false;
    if (hostname === 'google.com' || hostname.endsWith('.google.com')) return true;
    if (hostname.endsWith('.googleusercontent.com')) return true;
    if (hostname.endsWith('.googleapis.com')) return true;
    if (hostname.endsWith('.gstatic.com')) return true;
    if (hostname.endsWith('.ggpht.com')) return true;
    if (hostname.endsWith('.googlevideo.com')) return true;
    return false;
  } catch {
    return false;
  }
}

function isMailServiceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '').toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    if (hostname === 'mailo.com' || hostname.endsWith('.mailo.com')) return true;
    return pathname.includes('mail');
  } catch {
    return false;
  }
}

function shouldUseAndroidMobileUa(url: string): boolean {
  return isGoogleServiceUrl(url) || isMailServiceUrl(url);
}

type MutableRequestHeaders = Record<string, string | string[] | undefined>;
type RequestHeaders = Record<string, string | string[]>;

const findHeaderKey = (headers: MutableRequestHeaders, name: string): string | null =>
  Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase()) ?? null;

const setHeaderIfPresent = (headers: MutableRequestHeaders, name: string, value: string): void => {
  const key = findHeaderKey(headers, name);
  if (key) {
    headers[key] = value;
  }
};

const setHeader = (headers: MutableRequestHeaders, name: string, value: string): void => {
  headers[findHeaderKey(headers, name) ?? name] = value;
};

const normalizeRequestHeaders = (headers: MutableRequestHeaders): RequestHeaders => {
  const normalized: RequestHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value !== 'undefined') {
      normalized[key] = value;
    }
  }
  return normalized;
};

const clientHintsForProfile = (
  profile: 'desktop' | 'google-mobile' | 'mobile'
): {
  platform: string;
  mobile: string;
  arch: string;
  bitness: string;
} => {
  if (profile === 'google-mobile') {
    return {
      platform: '"Android"',
      mobile: '?1',
      arch: '"arm"',
      bitness: '"64"'
    };
  }
  const arch = uaArchToken === 'x86_64' ? '"x86"' : uaArchToken === 'aarch64' ? '"arm"' : `"${uaArchToken}"`;
  return {
    platform: '"Linux"',
    mobile: profile === 'mobile' ? '?1' : '?0',
    arch,
    bitness: uaArchToken === 'x86_64' || uaArchToken === 'aarch64' ? '"64"' : '""'
  };
};

const unwrapClientHintToken = (value: string): string => value.replace(/^"|"$/g, '');

const navigatorPlatformForProfile = (profile: 'desktop' | 'google-mobile' | 'mobile'): string => {
  if (profile === 'google-mobile') return 'Linux armv8l';
  return `Linux ${uaArchToken}`;
};

const resolveUserAgentTimezone = async (): Promise<string | null> => {
  const explicitTimezone = process.env.MZR_TIMEZONE || process.env.TZ;
  if (explicitTimezone) return explicitTimezone;
  const networkTimezone = await getKnownNetworkTimezone();
  if (networkTimezone) return networkTimezone;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

const TOUCH_FEATURE_OVERRIDE_SCRIPT = `
(() => {
  try {
    const nav = navigator;
    const target = Object.getPrototypeOf(nav) || nav;
    const current = Number(nav.maxTouchPoints || 0);
    const desc = Object.getOwnPropertyDescriptor(target, 'maxTouchPoints');
    if (current < 5 && (!desc || desc.configurable)) {
      Object.defineProperty(target, 'maxTouchPoints', {
        configurable: true,
        enumerable: true,
        get: () => 5
      });
    }
  } catch {}
  try {
    const defineTouchSlot = (target) => {
      if (!target) return;
      const desc = Object.getOwnPropertyDescriptor(target, 'ontouchstart');
      if (!desc) {
        Object.defineProperty(target, 'ontouchstart', {
          configurable: true,
          enumerable: false,
          get: () => null,
          set: () => {}
        });
      }
    };
    defineTouchSlot(window);
    defineTouchSlot(window.Window && Window.prototype);
    defineTouchSlot(window.Document && Document.prototype);
    defineTouchSlot(window.HTMLElement && HTMLElement.prototype);
    defineTouchSlot(window.SVGElement && SVGElement.prototype);
    if (document && document.documentElement) defineTouchSlot(document.documentElement);
  } catch {}
})();
`;

const userAgentMetadataForProfile = (profile: 'desktop' | 'google-mobile' | 'mobile') => {
  const hints = clientHintsForProfile(profile);
  const chromiumMajor = String(chromeVersion.major || 0);
  const chromiumFull = chromeVersion.full || `${chromiumMajor}.0.0.0`;
  return {
    brands: [
      { brand: 'Not/A)Brand', version: '99' },
      { brand: 'Chromium', version: chromiumMajor }
    ],
    fullVersionList: [
      { brand: 'Not/A)Brand', version: '99.0.0.0' },
      { brand: 'Chromium', version: chromiumFull }
    ],
    fullVersion: chromiumFull,
    platform: unwrapClientHintToken(hints.platform),
    platformVersion: profile === 'google-mobile' ? '13' : '',
    architecture: unwrapClientHintToken(hints.arch),
    model: profile === 'google-mobile' ? 'Pixel 7' : '',
    mobile: hints.mobile === '?1',
    bitness: unwrapClientHintToken(hints.bitness),
    wow64: false
  };
};

const getDebuggerSessionIds = (contents: WebContents): Set<string> => {
  let sessionIds = uaDebuggerSessionIdsByContents.get(contents);
  if (!sessionIds) {
    sessionIds = new Set<string>();
    uaDebuggerSessionIdsByContents.set(contents, sessionIds);
  }
  return sessionIds;
};

const getUserAgentDebugLogPath = (): string => path.join(app.getPath('userData'), UA_DEBUG_FILE_NAME);

const compactDebugValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.length > 4096 ? `${value.slice(0, 4096)}...<truncated ${value.length - 4096} chars>` : value;
  }
  if (Array.isArray(value)) {
    return value.map(compactDebugValue);
  }
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      next[key] = compactDebugValue(nested);
    }
    return next;
  }
  return value;
};

const shouldLogUserAgentDebug = (details: {
  resourceType?: string;
  url?: string;
  targetUrl?: string;
  firstPartyURL?: string;
  topHost?: string | null;
}): boolean => {
  if (!UA_DEBUG_ENABLED) return false;
  if (details.resourceType === 'mainFrame') return true;
  const haystack = [
    details.url,
    details.targetUrl,
    details.firstPartyURL,
    details.topHost
  ].filter(Boolean).join(' ').toLowerCase();
  return ANTI_BOT_DEBUG_TOKENS.some((token) => haystack.includes(token));
};

const appendUserAgentDebugBlock = (source: string, payload: Record<string, unknown>): void => {
  if (!UA_DEBUG_ENABLED) return;
  try {
    const file = getUserAgentDebugLogPath();
    ensureDir(path.dirname(file));
    if (!uaDebugLogInitialized) {
      uaDebugLogInitialized = true;
      fs.writeFileSync(file, JSON.stringify({
        ts: new Date().toISOString(),
        source: 'mzr-ua-debug.start',
        logFile: file,
        pid: process.pid
      }, null, 2) + '\n', 'utf8');
    }
    fs.appendFileSync(file, JSON.stringify(compactDebugValue({
      ts: new Date().toISOString(),
      source,
      ...payload
    }), null, 2) + '\n', 'utf8');
  } catch {
    // noop
  }
};

const userAgentProfileForUrl = (url: string | null | undefined): 'desktop' | 'google-mobile' | 'mobile' => {
  if (url && isDesktopOnlyUrl(url)) return 'desktop';
  if (url && currentUserAgentMode === 'mobile' && shouldUseAndroidMobileUa(url)) return 'google-mobile';
  return currentUserAgentMode === 'mobile' ? 'mobile' : 'desktop';
};

const getUserAgentProfileInfo = (url: string | null | undefined) => {
  const profile = userAgentProfileForUrl(url);
  const ua = getUserAgentForUrl(url);
  return {
    mode: currentUserAgentMode,
    profile,
    url: url ?? '',
    ua
  };
};

export const applyUserAgentRequestHeaders = (
  inputHeaders: MutableRequestHeaders,
  url: string | null | undefined
): RequestHeaders => {
  const headers = { ...inputHeaders };
  const profileInfo = getUserAgentProfileInfo(url);
  const hints = clientHintsForProfile(profileInfo.profile);
  setHeader(headers, 'User-Agent', profileInfo.ua);
  setHeaderIfPresent(headers, 'sec-ch-ua-platform', hints.platform);
  setHeaderIfPresent(headers, 'sec-ch-ua-mobile', hints.mobile);
  setHeaderIfPresent(headers, 'sec-ch-ua-arch', hints.arch);
  setHeaderIfPresent(headers, 'sec-ch-ua-bitness', hints.bitness);
  return normalizeRequestHeaders(headers);
};

export const logUserAgentDebug = (
  source: string,
  details: {
    url?: string;
    targetUrl?: string;
    firstPartyURL?: string;
    topHost?: string | null;
    resourceType?: string;
    webContentsId?: number;
    requestHeaders?: Record<string, string | string[] | undefined>;
    cookiePolicy?: string;
    thirdParty?: boolean;
    cookieHeaderCount?: number;
    setCookieHeaderCount?: number;
    strippedCookieHeaderCount?: number;
    strippedSetCookieHeaderCount?: number;
    statusCode?: number;
    statusLine?: string;
    fromCache?: boolean;
    method?: string;
    error?: string;
    sessionId?: string;
    targetType?: string;
    payload?: unknown;
  }
): void => {
  if (!shouldLogUserAgentDebug(details) && !source.includes('cdp')) return;
  const profileInfo = getUserAgentProfileInfo(details.targetUrl ?? details.url ?? null);
  const headers = details.requestHeaders ?? {};
  const findHeader = (name: string): string | string[] | undefined => {
    const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
    return key ? headers[key] : undefined;
  };
  appendUserAgentDebugBlock(source, {
    mode: profileInfo.mode,
    profile: profileInfo.profile,
    resourceType: details.resourceType,
    webContentsId: details.webContentsId,
    url: details.url,
    targetUrl: details.targetUrl,
    firstPartyURL: details.firstPartyURL,
    topHost: details.topHost,
    secChUa: findHeader('sec-ch-ua'),
    secChUaMobile: findHeader('sec-ch-ua-mobile'),
    secChUaPlatform: findHeader('sec-ch-ua-platform'),
    secChUaArch: findHeader('sec-ch-ua-arch'),
    secChUaBitness: findHeader('sec-ch-ua-bitness'),
    cookiePolicy: details.cookiePolicy,
    thirdParty: details.thirdParty,
    cookieHeaderCount: details.cookieHeaderCount,
    setCookieHeaderCount: details.setCookieHeaderCount,
    strippedCookieHeaderCount: details.strippedCookieHeaderCount,
    strippedSetCookieHeaderCount: details.strippedSetCookieHeaderCount,
    statusCode: details.statusCode,
    statusLine: details.statusLine,
    fromCache: details.fromCache,
    method: details.method,
    sessionId: details.sessionId,
    targetType: details.targetType,
    error: details.error,
    payload: details.payload,
    ua: profileInfo.ua
  });
};

const isAntiBotFrameUrl = (url: string | null | undefined): boolean => {
  const value = String(url || '').toLowerCase();
  return ANTI_BOT_DEBUG_TOKENS.some((token) => value.includes(token));
};

const logAntiBotFrameFingerprint = async (contents: WebContents | null | undefined): Promise<void> => {
  if (!UA_DEBUG_ENABLED || !contents || contents.isDestroyed()) return;
  try {
    const frames = contents.mainFrame?.framesInSubtree ?? [];
    for (const frame of frames) {
      try {
        if (!frame || frame.isDestroyed() || frame.detached) continue;
        const frameUrl = String(frame.url || '');
        if (!isAntiBotFrameUrl(frameUrl)) continue;
        const key = `${contents.id}:${frame.frameTreeNodeId}:${frameUrl}`;
        if (antiBotFrameDebugKeys.has(key)) continue;
        antiBotFrameDebugKeys.add(key);
        const result = await frame.executeJavaScript(
          `(async function(){
            try {
              var nav = navigator || {};
              var payload = {
                href: String(location && location.href || ''),
                userAgent: nav.userAgent,
                platform: nav.platform,
                vendor: nav.vendor,
                language: nav.language,
                languages: nav.languages ? Array.prototype.slice.call(nav.languages) : undefined,
                cookieEnabled: nav.cookieEnabled,
                webdriver: nav.webdriver,
                maxTouchPoints: nav.maxTouchPoints,
                hasTouchEvent: typeof window.TouchEvent === 'function',
                hasOntouchstartWindow: ('ontouchstart' in window),
                hasOntouchstartDocument: !!document.documentElement && ('ontouchstart' in document.documentElement),
                media: {
                  pointerCoarse: typeof matchMedia === 'function' ? matchMedia('(pointer: coarse)').matches : undefined,
                  pointerFine: typeof matchMedia === 'function' ? matchMedia('(pointer: fine)').matches : undefined,
                  hoverNone: typeof matchMedia === 'function' ? matchMedia('(hover: none)').matches : undefined,
                  anyPointerCoarse: typeof matchMedia === 'function' ? matchMedia('(any-pointer: coarse)').matches : undefined,
                  anyHoverNone: typeof matchMedia === 'function' ? matchMedia('(any-hover: none)').matches : undefined
                },
                hardwareConcurrency: nav.hardwareConcurrency,
                deviceMemory: nav.deviceMemory,
                pluginsLength: nav.plugins ? nav.plugins.length : undefined,
                mimeTypesLength: nav.mimeTypes ? nav.mimeTypes.length : undefined,
                userAgentData: nav.userAgentData ? {
                  brands: nav.userAgentData.brands,
                  mobile: nav.userAgentData.mobile,
                  platform: nav.userAgentData.platform
                } : null,
                highEntropy: null,
                screen: window.screen ? {
                  width: window.screen.width,
                  height: window.screen.height,
                  availWidth: window.screen.availWidth,
                  availHeight: window.screen.availHeight,
                  colorDepth: window.screen.colorDepth,
                  pixelDepth: window.screen.pixelDepth
                } : null,
                devicePixelRatio: window.devicePixelRatio,
                timezone: (function () {
                  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) { return undefined; }
                })()
              };
              if (nav.userAgentData && typeof nav.userAgentData.getHighEntropyValues === 'function') {
                try {
                  payload.highEntropy = await nav.userAgentData.getHighEntropyValues([
                    'architecture',
                    'bitness',
                    'model',
                    'platform',
                    'platformVersion',
                    'uaFullVersion',
                    'fullVersionList',
                    'wow64',
                    'mobile'
                  ]);
                } catch (err) {
                  payload.highEntropy = { error: String(err && err.message || err) };
                }
              }
              return payload;
            } catch (err) {
              return { error: String(err && err.message || err) };
            }
          })();`,
          true
        );
        appendUserAgentDebugBlock('mzr-antibot-fp', {
          webContentsId: contents.id,
          frameTreeNodeId: frame.frameTreeNodeId,
          frameUrl,
          payload: result
        });
      } catch (error) {
        appendUserAgentDebugBlock('mzr-antibot-fp.frame.failed', {
          webContentsId: contents.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  } catch {
    // noop
  }
};

export function installUserAgentOverride(targetSession: Session | null = session.defaultSession): void {
  if (!targetSession) return;
  const sessionWithFlag = targetSession as SessionWithOverride;
  const alreadyInstalled = sessionWithFlag.__mzrUAOverrideInstalled;
  sessionWithFlag.__mzrUAOverrideInstalled = true;
  try {
    const baseUA = currentUserAgentMode === 'mobile' ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT;
    targetSession.setUserAgent(baseUA);
  } catch {
    // noop
  }
  if (alreadyInstalled) return;
  try {
    targetSession.webRequest.onBeforeSendHeaders((details, callback) => {
      try {
        if (details.resourceType === 'mainFrame') {
          rememberTopLevelHost(details.webContentsId, details.url);
        }
        const topHost = getTopLevelHostForRequest(details);
        const firstPartyURL = (details as { firstPartyURL?: string }).firstPartyURL;
        const targetUrl = details.resourceType === 'mainFrame'
          ? details.url
          : (firstPartyURL || (topHost ? `https://${topHost}` : details.url));
        const headers = applyUserAgentRequestHeaders(details.requestHeaders, targetUrl);
        logUserAgentDebug('windows.onBeforeSendHeaders', {
          url: details.url,
          targetUrl,
          firstPartyURL,
          topHost,
          resourceType: details.resourceType,
          webContentsId: details.webContentsId,
          requestHeaders: headers
        });
        callback({ cancel: false, requestHeaders: headers });
      } catch {
        callback({ cancel: false, requestHeaders: details.requestHeaders });
      }
    });
  } catch {
    // noop
  }
  try {
    targetSession.webRequest.onCompleted((details) => {
      try {
        if (details.resourceType === 'mainFrame') {
          rememberTopLevelHost(details.webContentsId, details.url);
        }
        const firstPartyURL = (details as { firstPartyURL?: string }).firstPartyURL;
        const topHost = getTopLevelHostForRequest(details);
        const targetUrl = details.resourceType === 'mainFrame'
          ? details.url
          : (firstPartyURL || (topHost ? `https://${topHost}` : details.url));
        logUserAgentDebug('windows.onCompleted', {
          url: details.url,
          targetUrl,
          firstPartyURL,
          topHost,
          resourceType: details.resourceType,
          webContentsId: details.webContentsId,
          method: details.method,
          statusCode: details.statusCode,
          statusLine: details.statusLine,
          fromCache: details.fromCache
        });
      } catch {
        // noop
      }
    });
  } catch {
    // noop
  }
  try {
    targetSession.webRequest.onErrorOccurred((details) => {
      try {
        if (details.resourceType === 'mainFrame') {
          rememberTopLevelHost(details.webContentsId, details.url);
        }
        const firstPartyURL = (details as { firstPartyURL?: string }).firstPartyURL;
        const topHost = getTopLevelHostForRequest(details);
        const targetUrl = details.resourceType === 'mainFrame'
          ? details.url
          : (firstPartyURL || (topHost ? `https://${topHost}` : details.url));
        logUserAgentDebug('windows.onErrorOccurred', {
          url: details.url,
          targetUrl,
          firstPartyURL,
          topHost,
          resourceType: details.resourceType,
          webContentsId: details.webContentsId,
          method: details.method,
          fromCache: details.fromCache,
          error: details.error
        });
      } catch {
        // noop
      }
    });
  } catch {
    // noop
  }
}

export const getUserAgentForUrl = (url: string | null | undefined): string => {
  const baseUA = currentUserAgentMode === 'mobile' ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT;
  if (!url) return baseUA;
  if (isDesktopOnlyUrl(url)) return DESKTOP_USER_AGENT;
  if (currentUserAgentMode === 'mobile' && shouldUseAndroidMobileUa(url)) {
    return GOOGLE_MOBILE_USER_AGENT;
  }
  return baseUA;
};

export function applyUserAgentToWebContents(contents: WebContents | null | undefined, url?: string): void {
  if (!contents) return;
  const resolvedUrl = url ?? (typeof contents.getURL === 'function' ? contents.getURL() : '');
  const ua = getUserAgentForUrl(resolvedUrl);
  try {
    installUserAgentOverride(contents.session);
  } catch {
    // noop
  }
  try {
    contents.setUserAgent(ua);
  } catch {
    // noop
  }
}

export function applyUserAgentForUrl(contents: WebContents | null | undefined, url: string): void {
  applyUserAgentToWebContents(contents, url);
}

const sendRendererUserAgentOverride = async (
  contents: WebContents | null | undefined,
  url: string | null | undefined,
  sessionId?: string
): Promise<void> => {
  if (!contents || contents.isDestroyed?.()) return;
  const resolvedUrl = url ?? (typeof contents.getURL === 'function' ? contents.getURL() : '');
  if (resolvedUrl.startsWith('devtools://')) return;
  const profileInfo = getUserAgentProfileInfo(resolvedUrl);
  await contents.debugger.sendCommand('Emulation.setUserAgentOverride', {
    userAgent: profileInfo.ua,
    platform: navigatorPlatformForProfile(profileInfo.profile),
    userAgentMetadata: userAgentMetadataForProfile(profileInfo.profile)
  }, sessionId);
  if (profileInfo.profile !== 'desktop') {
    try {
      await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 5
      }, sessionId);
    } catch {
      // Workers do not expose page touch state; UA override still applies there.
    }
    try {
      const timezoneId = await resolveUserAgentTimezone();
      if (timezoneId) {
        await contents.debugger.sendCommand('Emulation.setTimezoneOverride', {
          timezoneId
        }, sessionId);
        logUserAgentDebug('windows.cdp.setTimezoneOverride', {
          webContentsId: contents.id,
          sessionId,
          url: resolvedUrl,
          targetUrl: resolvedUrl,
          resourceType: sessionId ? 'target' : 'webContents',
          payload: { timezoneId }
        });
      } else {
        logUserAgentDebug('windows.cdp.setTimezoneOverride.skipped', {
          webContentsId: contents.id,
          sessionId,
          url: resolvedUrl,
          targetUrl: resolvedUrl,
          resourceType: sessionId ? 'target' : 'webContents',
          payload: { reason: 'no-timezone' }
        });
      }
    } catch (error) {
      logUserAgentDebug('windows.cdp.setTimezoneOverride.failed', {
        webContentsId: contents.id,
        sessionId,
        url: resolvedUrl,
        targetUrl: resolvedUrl,
        resourceType: sessionId ? 'target' : 'webContents',
        error: error instanceof Error ? error.message : String(error)
      });
      // Some targets, such as workers, can reject timezone emulation.
    }
    try {
      await contents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
        source: TOUCH_FEATURE_OVERRIDE_SCRIPT
      }, sessionId);
    } catch {
      // Not all target types expose Page.
    }
    try {
      await contents.debugger.sendCommand('Runtime.evaluate', {
        expression: TOUCH_FEATURE_OVERRIDE_SCRIPT,
        includeCommandLineAPI: false,
        returnByValue: false
      }, sessionId);
    } catch {
      // Not all target types expose Runtime.
    }
    try {
      await contents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
        source: OSK_CDP_FOCUS_BRIDGE_SCRIPT
      }, sessionId);
    } catch {
      // Not all target types expose Page.
    }
    try {
      await contents.debugger.sendCommand('Runtime.enable', {}, sessionId);
    } catch {
      // Not all target types expose Runtime.
    }
    try {
      await contents.debugger.sendCommand('Runtime.addBinding', {
        name: OSK_CDP_BINDING_NAME
      }, sessionId);
    } catch {
      // Not all target types expose Runtime bindings.
    }
    try {
      await contents.debugger.sendCommand('Runtime.evaluate', {
        expression: OSK_CDP_FOCUS_BRIDGE_SCRIPT,
        includeCommandLineAPI: false,
        returnByValue: false
      }, sessionId);
    } catch {
      // Not all target types expose Runtime.
    }
  }
};

const extractCdpConsoleMessage = (params: unknown): string | null => {
  const args = (params as { args?: Array<{ value?: unknown; description?: string }> } | null | undefined)?.args;
  if (!Array.isArray(args) || args.length === 0) return null;
  const first = args[0];
  const value = typeof first?.value === 'string' ? first.value : '';
  if (value) return value;
  return typeof first?.description === 'string' ? first.description : null;
};

const forwardOskCdpConsoleMessage = (
  contents: WebContents,
  message: string | null,
  sessionId?: string
): void => {
  if (!message) return;
  if (
    message !== OSK_FOCUS_ACTIVE_MARKER &&
    message !== OSK_FOCUS_INACTIVE_MARKER
  ) {
    return;
  }
  const hostContents = findMainWindow()?.webContents;
  if (!hostContents || hostContents.isDestroyed?.()) return;
  try {
    hostContents.send('mzr:osk:focus-event', {
      webContentsId: contents.id,
      message,
      sessionId
    });
  } catch {
    // noop
  }
};

const extractOskCdpBindingMessage = (params: unknown): string | null => {
  const details = params as { name?: string; payload?: string } | null | undefined;
  if (details?.name !== OSK_CDP_BINDING_NAME || typeof details.payload !== 'string') return null;
  try {
    const parsed = JSON.parse(details.payload) as { message?: unknown };
    return typeof parsed.message === 'string' ? parsed.message : null;
  } catch {
    return null;
  }
};

const applyRendererUserAgentOverride = async (
  contents: WebContents | null | undefined,
  url: string | null | undefined
): Promise<void> => {
  if (!contents || contents.isDestroyed?.()) return;
  const resolvedUrl = url ?? (typeof contents.getURL === 'function' ? contents.getURL() : '');
  if (resolvedUrl.startsWith('devtools://')) return;
  const debuggerApi = contents.debugger;
  try {
    if (!debuggerApi.isAttached()) {
      debuggerApi.attach('1.3');
      uaDebuggerAttachedContents.add(contents);
    }
    if (!uaDebuggerHookedContents.has(contents)) {
      uaDebuggerHookedContents.add(contents);
      debuggerApi.on('message', (_event, method: string, params: unknown, sessionId?: string) => {
        if (method === 'Runtime.bindingCalled') {
          forwardOskCdpConsoleMessage(contents, extractOskCdpBindingMessage(params), sessionId);
          return;
        }
        if (method === 'Runtime.consoleAPICalled') {
          forwardOskCdpConsoleMessage(contents, extractCdpConsoleMessage(params), sessionId);
          return;
        }
        if (method === 'Target.detachedFromTarget') {
          const detached = params as { sessionId?: string };
          if (detached.sessionId) {
            getDebuggerSessionIds(contents).delete(detached.sessionId);
          }
          return;
        }
        if (method !== 'Target.attachedToTarget') return;
        const details = params as { sessionId?: string; targetInfo?: { url?: string; type?: string } };
        const childSessionId = details.sessionId;
        if (!childSessionId) return;
        const currentUrl = typeof contents.getURL === 'function' ? contents.getURL() : '';
        const targetUrl = details.targetInfo?.url || currentUrl || resolvedUrl;
        getDebuggerSessionIds(contents).add(childSessionId);
        void debuggerApi.sendCommand('Target.setAutoAttach', {
          autoAttach: true,
          waitForDebuggerOnStart: false,
          flatten: true
        }, childSessionId).catch(() => undefined);
        void sendRendererUserAgentOverride(contents, targetUrl, childSessionId)
          .then(() => {
            logUserAgentDebug('windows.cdp.target.setUserAgentOverride', {
              webContentsId: contents.id,
              sessionId: childSessionId,
              targetType: details.targetInfo?.type,
              url: targetUrl,
              targetUrl,
              resourceType: 'target'
            });
          })
          .catch((error) => {
            logUserAgentDebug('windows.cdp.target.setUserAgentOverride.failed', {
              webContentsId: contents.id,
              sessionId: childSessionId,
              targetType: details.targetInfo?.type,
              url: targetUrl,
              targetUrl,
              resourceType: 'target',
              error: error instanceof Error ? error.message : String(error)
            });
          });
      });
    }
    await debuggerApi.sendCommand('Target.setAutoAttach', {
      autoAttach: true,
      waitForDebuggerOnStart: false,
      flatten: true
    });
    await sendRendererUserAgentOverride(contents, resolvedUrl);
    for (const sessionId of getDebuggerSessionIds(contents)) {
      try {
        await sendRendererUserAgentOverride(contents, resolvedUrl, sessionId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('Session with given id not found')) {
          getDebuggerSessionIds(contents).delete(sessionId);
        } else {
          throw error;
        }
      }
    }
    logUserAgentDebug('windows.cdp.setUserAgentOverride', {
      url: resolvedUrl,
      targetUrl: resolvedUrl,
      resourceType: 'webContents',
      webContentsId: contents.id
    });
  } catch (error) {
    logUserAgentDebug('windows.cdp.setUserAgentOverride.failed', {
      url: resolvedUrl,
      targetUrl: resolvedUrl,
      resourceType: 'webContents',
      webContentsId: contents.id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

const detachRendererUserAgentOverride = (contents: WebContents | null | undefined): void => {
  if (!contents || contents.isDestroyed?.()) return;
  if (!uaDebuggerAttachedContents.has(contents)) return;
  try {
    if (contents.debugger.isAttached()) {
      contents.debugger.detach();
    }
  } catch {
    // noop
  }
};

const pickHost = (raw: string | undefined): string | null => {
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
};

export const rememberTopLevelHost = (wcId: number | undefined | null, host: string | null | undefined): void => {
  if (!wcId || !Number.isFinite(wcId)) return;
  const normalized = pickHost(host ?? undefined);
  if (normalized) {
    topLevelHostsByWc.set(wcId, normalized);
  }
};

export const forgetTopLevelHost = (wcId: number | undefined | null): void => {
  if (!wcId || !Number.isFinite(wcId)) return;
  topLevelHostsByWc.delete(wcId);
};

export const getTopLevelHostForRequest = (
  details: { firstPartyURL?: string; resourceType?: string; url: string; webContentsId?: number; referrer?: string }
): string | null => {
  const wcId = details.webContentsId;
  if (typeof wcId === 'number' && Number.isFinite(wcId)) {
    const cached = topLevelHostsByWc.get(wcId);
    if (cached) return cached;
  }
  const fromFirstParty = pickHost(details.firstPartyURL);
  if (fromFirstParty) return fromFirstParty;
  const fromReferrer = pickHost(details.referrer);
  if (fromReferrer) return fromReferrer;
  if (details.resourceType === 'mainFrame') {
    return pickHost(details.url);
  }
  return null;
};

const refreshUserAgentMode = (): void => {
  const nextMode = userAgentOverride ?? currentMode ?? 'desktop';
  if (currentUserAgentMode !== nextMode) {
    currentUserAgentMode = nextMode;
    const baseUA = nextMode === 'mobile' ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT;
    try {
      app.userAgentFallback = baseUA;
    } catch {
      // noop
    }
    try {
      session.defaultSession?.setUserAgent(baseUA);
    } catch {
      // noop
    }
  }
  try {
    for (const wc of webContents.getAllWebContents()) {
      if (wc.isDestroyed?.()) continue;
      const webContentsType = typeof wc.getType === 'function' ? (wc.getType() as string) : '';
      if (webContentsType === 'devtools') continue;
      applyUserAgentToWebContents(wc, typeof wc.getURL === 'function' ? wc.getURL() : '');
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
  hostContents.send('merezhyvo:download-status', { id: entry.id, status, file });
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

  const normalizeUrl = (value: string): string => value.trim().replace(/\/+$/, '').toLowerCase();
  const isBlankLikeUrl = (value: string): boolean => {
    const current = normalizeUrl(value);
    return (
      !current ||
      current === 'about:blank' ||
      current.startsWith('about:blank?') ||
      current === 'chrome://newtab' ||
      current === 'chrome://newtab/'
    );
  };
  const shouldAutoCloseDownloadContents = (
    contents: WebContents | null,
    downloadUrl: string
  ): boolean => {
    if (!contents || typeof contents.isDestroyed !== 'function' || contents.isDestroyed()) return false;
    if (contents === typedWin.webContents) return false;
    if (contents.id === typedWin.webContents.id) return false;
    try {
      const canGoBack = typeof contents.canGoBack === 'function' ? contents.canGoBack() : false;
      if (canGoBack) return false;
      const currentUrl = typeof contents.getURL === 'function' ? contents.getURL() || '' : '';
      if (isBlankLikeUrl(currentUrl)) return true;
      if (!downloadUrl) return false;
      return normalizeUrl(currentUrl) === normalizeUrl(downloadUrl);
    } catch {
      return false;
    }
  };
  const closeBlankDownloadTab = (contents: WebContents | null, downloadUrl: string): void => {
    const tryClose = (): boolean => {
      try {
        if (!shouldAutoCloseDownloadContents(contents, downloadUrl)) return false;
        if (!contents || contents.isDestroyed()) return true;
        const owner = BrowserWindow.fromWebContents(contents);
        if (owner && !owner.isDestroyed() && owner !== typedWin && owner.webContents === contents) {
          owner.close();
          return true;
        }
        typedWin.webContents.send('mzr-close-tab', {
          webContentsId: contents.id,
          url: downloadUrl
        });
        return true;
      } catch {
        return false;
      }
    };
    if (tryClose()) return;
    setTimeout(() => {
      void tryClose();
    }, 450);
  };

    const closeDownloadContentsIfNeeded = (
    downloadContents: WebContents | null,
    downloadUrl: string
  ): void => {
    if (!downloadContents) return;
    if (downloadContents === typedWin.webContents) return;
    const shouldAutoClose = shouldAutoCloseDownloadContents(downloadContents, downloadUrl);
    if (autoCloseSkipIds.has(downloadContents.id)) {
      autoCloseSkipIds.delete(downloadContents.id);
      if (!shouldAutoClose) return;
    }
    if (!shouldAutoClose) return;
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
  const handleWillDownload = (
    _event: Event,
    item: DownloadItem,
    downloadContents: WebContents | null
  ) => {
    const url = typeof item.getURL === 'function' ? item.getURL() || '' : '';
    closeBlankDownloadTab(downloadContents, url);
    const downloadHost = (downloadContents as WebContentsWithHost | null)?.hostWebContents;
    if (downloadContents && downloadHost) {
      skipAutoCloseForDownload(downloadContents.id);
    }
    if (downloadContents && downloadContents === typedWin.webContents) {
      skipAutoCloseForDownload(downloadContents.id);
    }
    handleNativeItemDownload(item, url);
    closeDownloadContentsIfNeeded(downloadContents, url);
  };
  const downloadSessions = new Set<Session>();
  const ensureWillDownloadHook = (targetSession: Session | null | undefined): void => {
    if (!targetSession) return;
    if (downloadSessions.has(targetSession)) return;
    downloadSessions.add(targetSession);
    targetSession.on('will-download', handleWillDownload);
  };
  ensureWillDownloadHook(typedWin.webContents.session);
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
    (_event, webPreferences: WebPreferences & { preload?: string }, params: { src?: string; useragent?: string }) => {
      const before = String(webPreferences?.preload || '');
      const preloadPath = ensureWebviewPreloadOnDisk();

      // Force our preload if empty or different (always OK to override)
      webPreferences.preload = preloadPath;
      params.useragent = getUserAgentForUrl(params?.src || startUrl);

      geoIpcLog(
        `will-attach-webview set preload=${preloadPath} (was='${before}') src=${String(params?.src || '')}`
      );
    }
  );

  typedWin.webContents.on('did-attach-webview', (_event, contents) => {
    ensureWillDownloadHook(contents.session);
    try {
      const current = typeof contents.getURL === 'function' ? contents.getURL() : '';
      applyUserAgentForUrl(contents, current);
      void applyRendererUserAgentOverride(contents, current);
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
      try {
        forgetTopLevelHost(contents.id);
      } catch {
        // ignore
      }
      detachRendererUserAgentOverride(contents);
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
      if (isMainFrame) {
        applyUserAgentForUrl(contents, navUrl);
        void applyRendererUserAgentOverride(contents, navUrl);
        rememberTopLevelHost(contents.id, navUrl);
      }
    });
    register('did-frame-finish-load', () => {
      void logAntiBotFrameFingerprint(contents);
    });
    register('did-navigate-in-page', () => {
      void logAntiBotFrameFingerprint(contents);
    });
    register('did-navigate', (_evt, navUrl: string, _httpResponseCode: number, _httpStatusText: string) => {
      if (navUrl) {
        rememberTopLevelHost(contents.id, navUrl);
        void applyRendererUserAgentOverride(contents, navUrl);
      }
      void logAntiBotFrameFingerprint(contents);
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

    const isTorEnabled = (): boolean => getTorState().enabled;

    const safeAddVisit = async (navUrl: string | undefined, transition: string): Promise<void> => {
      if (isTorEnabled()) return;
      const target = navUrl?.trim();
      if (!target) return;
      try {
        const parsed = new URL(target);
        const protocol = parsed.protocol.toLowerCase();
        if (protocol !== 'http:' && protocol !== 'https:') return;
      } catch {
        return;
      }
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
      if (isTorEnabled()) return;
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
      if (isTorEnabled()) return;
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

    typedWin.show();
    typedWin.focus();

    // Opening devtools too early intermittently crashes Electron on some hosts.
    // Defer until after the window is visible to keep startup stable.
    if (devtools) {
      setTimeout(() => {
        if (typedWin.isDestroyed()) return;
        typedWin.webContents.openDevTools({ mode: 'detach' });
      }, 300);
    }
  });

  const ensureWindowVisible = () => {
    if (typedWin.isDestroyed() || typedWin.isVisible()) return;
    try {
      if (initialMode === 'mobile') {
        applyMobileBounds(typedWin);
      } else if (fullscreen) {
        typedWin.setFullScreen(true);
      }
    } catch {
      // noop
    }
    try { typedWin.show(); } catch {}
    try { typedWin.focus(); } catch {}
  };

  typedWin.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      ensureWindowVisible();
    }, 50);
  });
  setTimeout(() => {
    ensureWindowVisible();
  }, 1500);

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
    for (const targetSession of downloadSessions) {
      try {
        targetSession.off('will-download', handleWillDownload);
      } catch {
        // noop
      }
    }
    downloadSessions.clear();
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
    if (isMainFrame) {
      applyUserAgentForUrl(typedWin.webContents, navUrl);
      rememberTopLevelHost(typedWin.webContents.id, navUrl);
    }
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
  contents.on('select-file' as Parameters<WebContents['on']>[0], handler as never);
};
