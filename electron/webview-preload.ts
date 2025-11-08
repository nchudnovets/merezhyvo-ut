import { ipcRenderer } from 'electron';

// Preserve native Notification
const NativeNotification = window.Notification;

// Lightweight proxy that mirrors notifications to host (renderer) via sendToHost
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
          tag: options?.tag ?? ''
        }
      });
    } catch {
      // ignore
    }
  }
}

// Replace window.Notification only if it exists and is configurable
try {
  Object.defineProperty(window, 'Notification', { value: MirrorNotification, configurable: true });
} catch {
  // ignore override errors (some sites may lock down globals)
}

// ---- Geolocation shim (main world injection): force sites to use our backend via postMessage bridge
(function installGeolocationInjection() {
  // Bridge: listen to page -> preload requests and answer back
  window.addEventListener('message', async (ev: MessageEvent) => {
    const d = (ev && ev.data) as
      | { channel: 'MZR_GEO_REQ'; id: string; kind: 'get'; options?: { timeout?: number } }
      | undefined;
    if (!d || d.channel !== 'MZR_GEO_REQ') return;

    const origin = window.location.origin;
    try {
      const allowed = await ipcRenderer.invoke('mzr:perms:softRequest', { origin, types: ['geolocation'] });
      if (!allowed) {
        window.postMessage(
          { channel: 'MZR_GEO_RES', id: d.id, ok: false, errorCode: 1, errorMessage: 'Permission denied' },
          '*'
        );
        return;
      }
      const fix = (await ipcRenderer.invoke('mzr:geo:getCurrentPosition', {
        timeoutMs: typeof d.options?.timeout === 'number' ? d.options.timeout : 8000
      })) as { latitude: number; longitude: number; accuracy: number; timestamp: number } | null;

      if (fix) {
        window.postMessage({ channel: 'MZR_GEO_RES', id: d.id, ok: true, fix }, '*');
      } else {
        window.postMessage(
          { channel: 'MZR_GEO_RES', id: d.id, ok: false, errorCode: 2, errorMessage: 'Position unavailable' },
          '*'
        );
      }
    } catch (e) {
      window.postMessage(
        { channel: 'MZR_GEO_RES', id: d.id, ok: false, errorCode: 2, errorMessage: String(e) },
        '*'
      );
    }
  });

  // Inject code into the page's MAIN world so it overrides window.navigator APIs before site JS runs
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
          } else {
            if (typeof error === 'function') {
              error({ code: d.errorCode || 2, message: d.errorMessage || 'Position unavailable' });
            }
          }
        }
        return onMsg;
      }

      var geoShim = {
        getCurrentPosition: function(success, error, options){
          var id = Math.random().toString(36).slice(2);
          var handler = onceHandler(id, success, error);
          window.addEventListener('message', handler);
          window.postMessage({ channel: 'MZR_GEO_REQ', id: id, kind: 'get', options: { timeout: options && options.timeout } }, '*');
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
            window.postMessage({ channel: 'MZR_GEO_REQ', id: id, kind: 'get', options: { timeout: options && options.timeout } }, '*');
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

      // Try defineProperty first; if blocked, patch methods on existing object
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

  const s = document.createElement('script');
  s.type = 'text/javascript';
  s.textContent = src;
  // Run as early as possible
  (document.documentElement || document.head || document.body).appendChild(s);
  s.remove();
})();