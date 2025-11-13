import { ipcRenderer, webFrame } from 'electron';

// Mark preload as initialized in logs
// try {
//   void ipcRenderer.invoke('mzr:geo:log', 'preload init');
// } catch {}

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
  const origin = window.location.origin;

  try {
    await ipcRenderer.invoke(
      'mzr:geo:log',
      `preload: req kind=${d.kind ?? 'get'} origin=${origin}`,
    );
  } catch {}

  try {
    const allowed: boolean = await ipcRenderer.invoke(
      'mzr:perms:softRequest',
      { origin, types: ['geolocation'] },
    );

    if (!allowed) {
      try { await ipcRenderer.invoke('mzr:geo:log', 'preload: denied by softRequest'); } catch {}
      window.postMessage(
        { channel: 'MZR_GEO_RES', id: d.id, ok: false, errorCode: 1, errorMessage: 'Permission denied' },
        '*',
      );
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
    try { await ipcRenderer.invoke('mzr:geo:log', `preload: error ${String(e)}`); } catch {}
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
