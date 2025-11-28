import { ipcRenderer, webFrame } from 'electron';

/** -------------------------------
 *  Mirror Notification to host
 *  ------------------------------- */
const NativeNotification = window.Notification;

class MirrorNotification extends NativeNotification {
  constructor(title: string, options?: NotificationOptions) {
    super(title, options);
    try {
      ipcRenderer.sendToHost('mzr:webview:notification', {
        title,
        options: {
          body: options?.body ?? '',
          icon: options?.icon ?? '',
          data: options?.data ?? null,
          tag: options?.tag ?? '',
        },
      });
    } catch {
      // ignore
    }
  }
}

try {
  Object.defineProperty(window, 'Notification', {
    value: MirrorNotification,
    configurable: true,
  });
} catch {}

/** -------------------------------
 *  Geolocation bridge (preload)
 *  ------------------------------- */

type GeoRequestKind = 'get';

interface GeoRequestMessage {
  channel: 'MZR_GEO_REQ';
  id: string;
  kind?: GeoRequestKind;
  options?: {
    timeout?: number;
    enableHighAccuracy?: boolean;
    maximumAge?: number;
  };
}

interface GeoFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
}

function isGeoReq(msg: unknown): msg is GeoRequestMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { channel?: unknown }).channel === 'MZR_GEO_REQ' &&
    typeof (msg as { id?: unknown }).id === 'string'
  );
}

window.addEventListener('message', async (ev: MessageEvent) => {
  if (!isGeoReq(ev.data)) return;

  const d = ev.data;
  // const origin = window.location.origin;

  // paused: disable geo logging and softRequest while geo perms feature is on hold
  // try {
  //   await ipcRenderer.invoke(
  //     'mzr:geo:log',
  //     `preload: req kind=${d.kind ?? 'get'} origin=${origin}`,
  //   );
  // } catch {}

  try {
    // const allowed: boolean = await ipcRenderer.invoke(
    //   'mzr:perms:softRequest',
    //   { origin, types: ['geolocation'] },
    // );
    const allowed = false;

    if (!allowed) {
      // try { await ipcRenderer.invoke('mzr:geo:log', 'preload: denied by softRequest'); } catch {}
      // window.postMessage(
      //   { channel: 'MZR_GEO_RES', id: d.id, ok: false, errorCode: 1, errorMessage: 'Permission denied' },
      //   '*',
      // );
      return;
    }

    const timeoutMs = typeof d.options?.timeout === 'number' ? d.options.timeout : 8000;
    const maximumAge = typeof d.options?.maximumAge === 'number' ? d.options.maximumAge : 0;

    const fix: GeoFix | null = await ipcRenderer.invoke(
      'mzr:geo:getCurrentPosition',
      { timeoutMs, maximumAge },
    );

    if (fix) {
      try {
        await ipcRenderer.invoke(
          'mzr:geo:log',
          `preload: ok lat=${fix.latitude} lon=${fix.longitude} ±${fix.accuracy}`,
        );
      } catch {}
      window.postMessage(
        { channel: 'MZR_GEO_RES', id: d.id, ok: true, fix },
        '*',
      );
    } else {
      try { await ipcRenderer.invoke('mzr:geo:log', 'preload: no position (null)'); } catch {}
      window.postMessage(
        { channel: 'MZR_GEO_RES', id: d.id, ok: false, errorCode: 2, errorMessage: 'Position unavailable' },
        '*',
      );
    }
  } catch (e) {
    // try { await ipcRenderer.invoke('mzr:geo:log', `preload: error ${String(e)}`); } catch {}
    window.postMessage(
      { channel: 'MZR_GEO_RES', id: d.id, ok: false, errorCode: 2, errorMessage: String(e) },
      '*',
    );
  }
});

/** -----------------------------------------------
 *  Inject MAIN-world shim for navigator.geolocation
 *  ----------------------------------------------- */
(function installGeolocationInjection() {
  const src = `
    (function(){
      if (!('geolocation' in navigator)) return;

      function onceHandler(id, success, error) {
        function onMsg(ev) {
          var d = ev && ev.data;
          if (!d || d.channel !== 'MZR_GEO_RES' || d.id !== id) return;
          window.removeEventListener('message', onMsg);
          if (d.ok && d.fix) {
            var pos = {
              coords: {
                latitude: d.fix.latitude,
                longitude: d.fix.longitude,
                accuracy: d.fix.accuracy,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null
              },
              timestamp: d.fix.timestamp
            };
            try { success(pos); } catch(_) {}
          } else if (typeof error === 'function') {
            error({ code: d.errorCode || 2, message: d.errorMessage || 'Position unavailable' });
          }
        }
        return onMsg;
      }

      var geoShim = {
        getCurrentPosition: function(success, error, options){
          var id = Math.random().toString(36).slice(2);
          var handler = onceHandler(id, success, error);
          window.addEventListener('message', handler);
          window.postMessage(
            { channel: 'MZR_GEO_REQ', id: id, kind: 'get', options: { timeout: options && options.timeout, enableHighAccuracy: options && options.enableHighAccuracy, maximumAge: options && options.maximumAge } },
            '*'
          );
        },
        watchPosition: function(success, error, options){
          var poll = Math.max(1000, (options && options.maximumAge) || 3000);
          var active = true;
          var wid = (Date.now() ^ Math.floor(Math.random()*1e9));

          function tick(){
            if (!active) return;
            var id = Math.random().toString(36).slice(2);
            var handler = onceHandler(id, success, error);
            window.addEventListener('message', handler);
            window.postMessage(
              { channel: 'MZR_GEO_REQ', id: id, kind: 'get', options: { timeout: options && options.timeout, enableHighAccuracy: options && options.enableHighAccuracy, maximumAge: options && options.maximumAge } },
              '*'
            );
            if (active) setTimeout(tick, poll);
          }

          setTimeout(tick, 0);
          (window.__mzrGeoCancel || (window.__mzrGeoCancel = {}))[wid] = function(){ active = false; };
          return wid;
        },
        clearWatch: function(wid){
          if (window.__mzrGeoCancel && typeof window.__mzrGeoCancel[wid] === 'function') {
            window.__mzrGeoCancel[wid]();
            delete window.__mzrGeoCancel[wid];
          }
        }
      };

      try {
        Object.defineProperty(navigator, 'geolocation', { value: geoShim, configurable: true });
      } catch(_){
        try {
          navigator.geolocation.getCurrentPosition = geoShim.getCurrentPosition;
          navigator.geolocation.watchPosition = geoShim.watchPosition;
          navigator.geolocation.clearWatch = geoShim.clearWatch;
        } catch(__){}
      }
    })();
  `;

  try {
    void webFrame.executeJavaScriptInIsolatedWorld(0, [{ code: src }]);
  } catch {
    try {
      const s = document.createElement('script');
      s.type = 'text/javascript';
      s.textContent = src;
      const root = document.documentElement || document.head || document.body;
      if (root) { root.appendChild(s); s.remove(); }
      else {
        document.addEventListener('DOMContentLoaded', () => {
          const r2 = document.documentElement || document.head || document.body;
          if (r2) { r2.appendChild(s); s.remove(); }
        });
      }
    } catch {}
  }
})();

(() => {
  if (window.top !== window) return;
  const lastCapture = new Map<string, number>();

  const findUsernameInput = (form: HTMLFormElement): HTMLInputElement | null => {
    const candidates = Array.from(
      form.querySelectorAll<HTMLInputElement>(
        'input[type="text"], input[type="email"], input:not([type])'
      )
    );
    return candidates.find((input) => (input.value ?? '').trim().length > 0) ?? candidates[0] ?? null;
  };

  const buildFormAction = (form: HTMLFormElement): string => {
    const actionAttr = form.getAttribute('action');
    if (!actionAttr) {
      return window.location.href;
    }
    try {
      return new URL(actionAttr, window.location.href).toString();
    } catch {
      return window.location.href;
    }
  };

  const handleSubmit = (event: SubmitEvent): void => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    const passwordInput = form.querySelector<HTMLInputElement>('input[type="password"]');
    if (!passwordInput) return;
    const password = passwordInput.value;
    if (!password) return;
    const origin = window.location.origin;
    const signonRealm = `${window.location.protocol}//${window.location.host}`;
    const formAction = buildFormAction(form);
    const usernameInput = findUsernameInput(form);
    const username = usernameInput?.value?.trim();
    const key = `${origin}|${formAction}|${username ?? ''}`;
    const now = Date.now();
    const last = lastCapture.get(key);
    if (last && now - last < 1000) return;
    lastCapture.set(key, now);

    try {
      ipcRenderer.send('merezhyvo:pw:capture', {
        origin,
        signonRealm,
        formAction,
        username,
        password
      });
    } catch {
      // noop
    }
  };

  document.addEventListener('submit', handleSubmit, true);
})();

(() => {
  if (window.top !== window) return;

  let lastUsernameInput: HTMLInputElement | null = null;
  let lastPasswordInput: HTMLInputElement | null = null;

  const signonRealm = `${window.location.protocol}//${window.location.host}`;
  const origin = window.location.origin;

  const sendFocus = (field: 'username' | 'password'): void => {
    try {
      ipcRenderer.sendToHost('mzr:pw:field-focus', { origin, signonRealm, field });
    } catch {
      // noop
    }
  };

  const sendBlur = (): void => {
    try {
      ipcRenderer.sendToHost('mzr:pw:field-blur');
    } catch {
      // noop
    }
  };

  const fillField = (field: HTMLInputElement, value: string): void => {
    try {
      field.focus();
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {
      // noop
    }
  };

  const handleFocusIn = (event: FocusEvent): void => {
    const target = event.target as HTMLInputElement | null;
    if (!target || target.tagName !== 'INPUT') return;
    const type = (target.getAttribute('type') ?? '').toLowerCase();
    if (type === 'password') {
      lastPasswordInput = target;
      sendFocus('password');
      return;
    }
    if (type === 'text' || type === 'email' || type === 'search' || type === 'tel') {
      lastUsernameInput = target;
      sendFocus('username');
    }
  };

  const handleFocusOut = (event: FocusEvent): void => {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    if (target === lastPasswordInput || target === lastUsernameInput) {
      sendBlur();
    }
  };

  const findPasswordInput = (): HTMLInputElement | null => {
    if (lastPasswordInput) return lastPasswordInput;
    if (lastUsernameInput && lastUsernameInput.form) {
      const candidate = lastUsernameInput.form.querySelector<HTMLInputElement>('input[type="password"]');
      if (candidate) {
        lastPasswordInput = candidate;
        return candidate;
      }
    }
    const fallback = document.querySelector<HTMLInputElement>('input[type="password"]');
    if (fallback) {
      lastPasswordInput = fallback;
      return fallback;
    }
    return null;
  };

  const findUsernameInput = (): HTMLInputElement | null => {
    if (lastUsernameInput) return lastUsernameInput;
    if (lastPasswordInput && lastPasswordInput.form) {
      const candidate = lastPasswordInput.form.querySelector<HTMLInputElement>(
        'input[type="text"],input[type="email"],input[type="search"],input:not([type])'
      );
      if (candidate) {
        lastUsernameInput = candidate;
        return candidate;
      }
    }
    const fallback = document.querySelector<HTMLInputElement>(
      'input[type="text"],input[type="email"],input[type="search"],input:not([type])'
    );
    if (fallback) {
      lastUsernameInput = fallback;
      return fallback;
    }
    return null;
  };

  ipcRenderer.on('merezhyvo:pw:fill', (_event, payload: { username?: string; password?: string }) => {
    if (payload.username) {
      const target = findUsernameInput();
      if (target) {
        fillField(target, payload.username);
      }
    }
    if (payload.password) {
      const target = findPasswordInput();
      if (target) {
        fillField(target, payload.password);
      }
    }
  });

document.addEventListener('focusin', handleFocusIn, true);
document.addEventListener('focusout', handleFocusOut, true);
})();

(() => {
  type FileDialogResponse = {
    requestId: string;
    files?: Array<{ name?: string; type?: string; data?: string | null; path?: string }>;
  };

  const pendingInputs = new Map<string, HTMLInputElement>();
  const activeInputs = new WeakSet<HTMLInputElement>();
  const MIME_TYPES: Record<string, string> = {
    '.aac': 'audio/aac',
    '.avi': 'video/x-msvideo',
    '.bz': 'application/x-bzip',
    '.bz2': 'application/x-bzip2',
    '.csv': 'text/csv',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.dmg': 'application/x-apple-diskimage',
    '.gif': 'image/gif',
    '.gz': 'application/gzip',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.hif': 'image/heif',
    '.heix': 'image/heif',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.json': 'application/json',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.tar': 'application/x-tar',
    '.txt': 'text/plain',
    '.wav': 'audio/wav',
    '.webm': 'video/webm',
    '.webp': 'image/webp',
    '.zip': 'application/zip'
  };

  const createRequestId = (): string =>
    `mzr_fd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const guessMimeType = (value: string): string => {
    const dot = value.lastIndexOf('.');
    if (dot === -1) return 'application/octet-stream';
    const ext = value.slice(dot).toLowerCase();
    return MIME_TYPES[ext] ?? 'application/octet-stream';
  };

  const openDialogForInput = (input: HTMLInputElement): boolean => {
    if (input.disabled || input.readOnly) return false;
    if (activeInputs.has(input)) return false;
    const requestId = createRequestId();
    pendingInputs.set(requestId, input);
    activeInputs.add(input);
    try {
      ipcRenderer.sendToHost('mzr:file-dialog:open', {
        requestId,
        accept: input.accept,
        multiple: Boolean(input.multiple)
      });
      return true;
    } catch {
      pendingInputs.delete(requestId);
      activeInputs.delete(input);
      // noop
      return false;
    }
  };

  const findFileInput = (event: Event): HTMLInputElement | null => {
    const pathFromEvent =
      typeof event.composedPath === 'function' ? event.composedPath() : (event as any).path ?? [];
    for (const entry of Array.isArray(pathFromEvent) ? pathFromEvent : []) {
      if (entry instanceof HTMLInputElement && entry.type === 'file') {
        return entry;
      }
      if (entry instanceof HTMLLabelElement) {
        const associated = entry.htmlFor ? document.getElementById(entry.htmlFor) : null;
        if (associated instanceof HTMLInputElement && associated.type === 'file') {
          return associated;
        }
      }
    }

    const target = event.target;
    if (target instanceof HTMLLabelElement && target.htmlFor) {
      const associated = document.getElementById(target.htmlFor);
      if (associated instanceof HTMLInputElement && associated.type === 'file') {
        return associated;
      }
    }
    if (target instanceof Element) {
      const closest = target.closest('input[type=file]');
      if (closest instanceof HTMLInputElement) {
        return closest;
      }
    }
    return null;
  };

  const base64ToArray = (base64: string): Uint8Array => {
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      array[i] = binary.charCodeAt(i);
    }
    return array;
  };

  const clampSelection = <T>(items: T[], multiple: boolean): T[] => {
    if (multiple) return items;
    if (!items.length) return [];
    return [items[0] as T];
  };

  const handleResponse = (_event: Electron.IpcRendererEvent, payload: FileDialogResponse): void => {
    const input = pendingInputs.get(payload.requestId);
    if (!input) return;
    const descriptors = clampSelection(payload.files ?? [], input.multiple);
    if (!descriptors.length) {
      pendingInputs.delete(payload.requestId);
      activeInputs.delete(input);
      return;
    }
    pendingInputs.delete(payload.requestId);
    activeInputs.delete(input);
    const files: File[] = [];
    for (const descriptor of descriptors) {
      if (!descriptor.data) {
        continue;
      }
      const buffer = base64ToArray(descriptor.data);
      const name = descriptor.name ?? descriptor.path ?? 'file';
      const type = descriptor.type ?? guessMimeType(name);
      files.push(new File([buffer as unknown as BlobPart], name, { type }));
    }
    if (!files.length) return;
    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));
    try {
      input.files = dataTransfer.files;
    } catch {
      // Assigning to files may fail; ignore
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const handleClick = (event: MouseEvent): void => {
    const input = findFileInput(event);
    if (!input) return;
    if (openDialogForInput(input)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const input = findFileInput(event);
    if (!input) return;
    if (openDialogForInput(input)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);
  ipcRenderer.on('mzr:file-dialog:response', handleResponse);
})();
