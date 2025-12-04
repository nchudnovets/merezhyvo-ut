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
 *  WebRTC policy enforcement
 *  ------------------------------- */

type WebrtcPolicyPayload = {
  enabled?: boolean;
};

const WEBRTC_DISABLE_MESSAGE = 'WebRTC is disabled by browser policy';

const installWebrtcGuard = (): void => {
  const code = `
    (() => {
      const root = window;
      const store = root.__mzrRtcState || (root.__mzrRtcState = { originals: null, disabled: false });
      const message = ${JSON.stringify(WEBRTC_DISABLE_MESSAGE)};

      function capture() {
        if (store.originals) return;
        const nav = root.navigator;
        store.originals = {
          RTCPeerConnection: root.RTCPeerConnection,
          webkitRTCPeerConnection: root.webkitRTCPeerConnection,
          mediaDevices: nav && nav.mediaDevices,
          getUserMedia: nav && nav.mediaDevices && nav.mediaDevices.getUserMedia,
          legacyGetUserMedia: nav && nav.getUserMedia
        };
      }

      function disableRtc() {
        capture();
        const err = new Error(message);
        const thrower = function() { throw err; };
        const rejector = function() { return Promise.reject(err); };

        try { Object.defineProperty(root, 'RTCPeerConnection', { value: undefined, configurable: true }); } catch {}
        try { Object.defineProperty(root, 'webkitRTCPeerConnection', { value: undefined, configurable: true }); } catch {}

        try {
          if (root.navigator) {
            const base = (store.originals && store.originals.mediaDevices) || root.navigator.mediaDevices || {};
            const wrapper = Object.create(base || {});
            try { Object.defineProperty(wrapper, 'getUserMedia', { value: rejector, configurable: true, writable: true }); }
            catch { try { wrapper.getUserMedia = rejector; } catch {} }
            try { Object.defineProperty(root.navigator, 'mediaDevices', { value: wrapper, configurable: true }); }
            catch { try { root.navigator.mediaDevices = wrapper; } catch {} }
          }
        } catch {}

        try {
          if (root.navigator) {
            const hadLegacy = typeof (store.originals && store.originals.legacyGetUserMedia) !== 'undefined';
            if (hadLegacy || typeof root.navigator.getUserMedia === 'function') {
              Object.defineProperty(root.navigator, 'getUserMedia', { value: thrower, configurable: true });
            }
          }
        } catch {}
        store.disabled = true;
      }

      function enableRtc() {
        const orig = store.originals;
        const nav = root.navigator;
        if (!orig) { store.disabled = false; return; }

        try {
          if (typeof orig.RTCPeerConnection !== 'undefined') {
            Object.defineProperty(root, 'RTCPeerConnection', { value: orig.RTCPeerConnection, configurable: true });
          } else {
            delete root.RTCPeerConnection;
          }
        } catch {}
        try {
          if (typeof orig.webkitRTCPeerConnection !== 'undefined') {
            Object.defineProperty(root, 'webkitRTCPeerConnection', { value: orig.webkitRTCPeerConnection, configurable: true });
          } else {
            delete root.webkitRTCPeerConnection;
          }
        } catch {}

        try {
          if (nav) {
            if (typeof orig.mediaDevices !== 'undefined') {
              Object.defineProperty(nav, 'mediaDevices', { value: orig.mediaDevices, configurable: true });
            } else {
              delete nav.mediaDevices;
            }
          }
        } catch {}

        try {
          if (nav) {
            if (typeof orig.legacyGetUserMedia !== 'undefined') {
              Object.defineProperty(nav, 'getUserMedia', { value: orig.legacyGetUserMedia, configurable: true });
            } else if (typeof nav.getUserMedia !== 'undefined') {
              delete nav.getUserMedia;
            }
          }
        } catch {}

        store.disabled = false;
      }

      root.__mzrApplyWebrtcPolicy = function(enabled) {
        if (enabled) { enableRtc(); return true; }
        disableRtc(); return false;
      };
    })();
  `;
  try {
    void webFrame.executeJavaScriptInIsolatedWorld(0, [{ code }]);
  } catch {
    // ignore
  }
};

const applyWebrtcPolicy = (enabled: boolean): void => {
  const code = `
    try {
      if (typeof window.__mzrApplyWebrtcPolicy === 'function') {
        window.__mzrApplyWebrtcPolicy(${enabled ? 'true' : 'false'});
      }
    } catch {}
  `;
  try {
    void webFrame.executeJavaScriptInIsolatedWorld(0, [{ code }]);
  } catch {
    // ignore
  }
};

installWebrtcGuard();

const getInitialWebrtcPolicy = (): boolean => {
  try {
    const payload = ipcRenderer.sendSync('merezhyvo:webrtc:getEffectiveSync') as WebrtcPolicyPayload | undefined;
    if (payload && typeof payload === 'object' && typeof payload.enabled === 'boolean') {
      return payload.enabled;
    }
  } catch {
    // ignore
  }
  return true;
};

let webrtcEnabled = getInitialWebrtcPolicy();
applyWebrtcPolicy(webrtcEnabled);

ipcRenderer.on('merezhyvo:webrtc:updatePolicy', (_event, payload: WebrtcPolicyPayload) => {
  try {
    const enabled = payload && typeof payload.enabled === 'boolean' ? payload.enabled : true;
    if (enabled === webrtcEnabled) return;
    webrtcEnabled = enabled;
    applyWebrtcPolicy(enabled);
  } catch {
    // ignore
  }
});

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
  const TOP_EDGE_PX = 50;
  const PULL_THRESHOLD_RATIO = 0.5;
  const MAX_START_SCROLL = 8;
  const MAX_SCROLL_DELTA = 24;

  let spinner: HTMLDivElement | null = null;
  const spinnerStyles = `
    .mzr-pull-spinner {
      position: fixed;
      top: 12px;
      left: 50%;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 4px solid #259cebff;
      border-top-color: #fde047;
      border-right-color: #259cebff;
      border-bottom-color: #259cebff;
      border-left-color: #259cebff;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.45);
      transform: translate3d(-50%, 0, 0);
      opacity: 0;
      animation: app-spin 0.8s linear infinite;
      transition: transform 0.08s ease, opacity 0.2s ease;
      pointer-events: none;
      z-index: 99999;
    }
    .mzr-pull-spinner[data-active="true"] {
      opacity: 1;
    }
  `;
  const ensureSpinner = () => {
    if (spinner) return;
    try {
      const styleEl = document.createElement('style');
      styleEl.textContent = spinnerStyles;
      const styleParent = document.head ?? document.documentElement;
      styleParent?.appendChild(styleEl);
      spinner = document.createElement('div');
      spinner.className = 'mzr-pull-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      spinner.setAttribute('data-active', 'false');
      const bodyParent = document.body ?? document.documentElement;
      bodyParent?.appendChild(spinner);
    } catch (error) {
      console.warn('[pull] spinner init failed', error);
      spinner = null;
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureSpinner, { once: true });
  } else {
    ensureSpinner();
  }
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  const showSpinner = () => {
    ensureSpinner();
    if (!spinner) return;
    spinner.setAttribute('data-active', 'true');
  };
  const hideSpinner = () => {
    ensureSpinner();
    if (!spinner) return;
    spinner.setAttribute('data-active', 'false');
    spinner.style.transform = 'translate3d(-50%, 0, 0) scale(1, 1)';
  };
  const moveSpinner = (delta: number) => {
    ensureSpinner();
    if (!spinner) return;
    const capped = clamp(delta, 0, Math.max(threshold(), 1));
    const progress = clamp(capped / Math.max(threshold(), 1), 0, 1);
    const translate = capped * 0.6;
    const scaleY = 1 + progress * 0.25;
    const scaleX = 1 - progress * 0.08;
    spinner.style.transform = `translate3d(-50%, ${translate}px, 0) scaleX(${scaleX}) scaleY(${scaleY})`;
  };

  type GestureSource = 'pointer' | 'touch' | 'mouse';

  let tracking = false;
  let readyToRefresh = false;
  let startY = 0;
  let pointerIdentifier: number | null = null;
  let source: GestureSource | null = null;

  const getScrollTop = () => document.scrollingElement?.scrollTop ?? 0;
  const threshold = () => window.innerHeight * PULL_THRESHOLD_RATIO;

  const reset = () => {
    tracking = false;
    readyToRefresh = false;
    startY = 0;
    pointerIdentifier = null;
    source = null;
    hideSpinner();
  };

  const shouldTrack = (clientY: number) => {
    const scrollTop = getScrollTop();
    return clientY <= TOP_EDGE_PX && scrollTop <= MAX_START_SCROLL;
  };

  const startTracking = (clientY: number, type: GestureSource, id?: number) => {
    if (tracking) return;
    tracking = true;
    source = type;
    pointerIdentifier = typeof id === 'number' ? id : null;
    startY = clientY;
    showSpinner();
    moveSpinner(0);
  };

  const MAX_NEGATIVE_DELTA = -8;
  const updateTracking = (clientY: number, type: GestureSource, id?: number) => {
    if (!tracking || source !== type) return;
    if (pointerIdentifier !== null && typeof id === 'number' && id !== pointerIdentifier) return;
    const delta = clientY - startY;
    const currentScroll = getScrollTop();
    if (currentScroll > MAX_SCROLL_DELTA || delta < MAX_NEGATIVE_DELTA) {
      reset();
      return;
    }
    readyToRefresh = delta >= threshold();
    moveSpinner(delta);
  };

  const finishTracking = (type: GestureSource, id?: number) => {
    if (!tracking || source !== type) return;
    if (pointerIdentifier !== null && typeof id === 'number' && id !== pointerIdentifier) {
      return;
    }
    if (readyToRefresh) {
      try {
        window.location.reload();
      } catch {
        // noop
      }
    }
    reset();
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    if (!shouldTrack(event.clientY)) return;
    startTracking(event.clientY, 'pointer', event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent) => {
    updateTracking(event.clientY, 'pointer', event.pointerId);
  };

  const handlePointerUp = (event: PointerEvent) => {
    finishTracking('pointer', event.pointerId);
  };

  const handlePointerCancel = (event: PointerEvent) => {
    finishTracking('pointer', event.pointerId);
  };

  const handleTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch || !shouldTrack(touch.clientY)) return;
    startTracking(touch.clientY, 'touch', touch.identifier);
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (!tracking || source !== 'touch' || pointerIdentifier === null) return;
    const touch = Array.from(event.touches).find((t) => t.identifier === pointerIdentifier);
    if (!touch) return;
    updateTracking(touch.clientY, 'touch', touch.identifier);
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (!tracking || source !== 'touch' || pointerIdentifier === null) return;
    const ended = Array.from(event.changedTouches).find((t) => t.identifier === pointerIdentifier);
    if (ended) {
      finishTracking('touch', ended.identifier);
    } else if (event.touches.length === 0) {
      finishTracking('touch');
    }
  };

  window.addEventListener('pointerdown', handlePointerDown, { passive: true });
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerCancel);

  window.addEventListener('touchstart', handleTouchStart, { passive: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: true });
  window.addEventListener('touchend', handleTouchEnd);
  window.addEventListener('touchcancel', handleTouchEnd);
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
