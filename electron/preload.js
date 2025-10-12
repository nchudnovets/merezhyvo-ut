'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose a minimal, safe API to the renderer.
 * Usage in renderer:
 *   const off = window.merezhyvo?.onMode((mode) => { /* apply mode *\/ });
 *   off && off(); // to unsubscribe
 */
contextBridge.exposeInMainWorld('merezhyvo', {
  onMode: (handler) => {
    if (typeof handler !== 'function') return () => {};
    const channel = 'merezhyvo:mode';
    const wrapped = (_e, mode) => { try { handler(mode); } catch {} };
    ipcRenderer.on(channel, wrapped);
    return () => {
      try { ipcRenderer.removeListener(channel, wrapped); } catch {}
    };
  },

  /**
   * Ask main process to create a .desktop shortcut for the current site.
   * `icon` is optional and usually omitted (main tries to fetch favicon itself).
   */
  createShortcut: async ({ title, url, single = true, icon }) => {
    const payload = {
      title: String(title || '').trim(),
      url: String(url || '').trim(),
      single: !!single,
      icon: (icon && icon.data && icon.name)
        ? {
            name: String(icon.name || 'icon.png'),
            // `Buffer` is available in preload (Node in preload is enabled)
            dataBase64: Buffer.from(icon.data).toString('base64')
          }
        : null
    };
    try {
      return await ipcRenderer.invoke('merezhyvo:createShortcut', payload);
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  session: {
    load: async () => {
      try {
        return await ipcRenderer.invoke('merezhyvo:session:load');
      } catch (err) {
        console.error('[merezhyvo] session.load failed', err);
        return null;
      }
    },
    save: async (data) => {
      try {
        return await ipcRenderer.invoke('merezhyvo:session:save', data);
      } catch (err) {
        console.error('[merezhyvo] session.save failed', err);
        return { ok: false, error: String(err) };
      }
    }
  },

  power: {
    start: async () => {
      try {
        return await ipcRenderer.invoke('merezhyvo:power:start');
      } catch (err) {
        console.error('[merezhyvo] power.start failed', err);
        return null;
      }
    },
    stop: async (id) => {
      try {
        return await ipcRenderer.invoke('merezhyvo:power:stop', id ?? null);
      } catch (err) {
        console.error('[merezhyvo] power.stop failed', err);
        return null;
      }
    },
    isStarted: async (id) => {
      try {
        return await ipcRenderer.invoke('merezhyvo:power:isStarted', id ?? null);
      } catch (err) {
        console.error('[merezhyvo] power.isStarted failed', err);
        return false;
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Deny VP9/AV1 by faking support checks (h264ify-like behavior).
// Keeps sites from selecting VP9/AV1 when H.264 is preferable on-device.
// ---------------------------------------------------------------------------
(() => {
  try {
    const deny = (type = '') => /(webm|vp9|av01|av1)/i.test(type);

    const origMSE =
      globalThis.MediaSource && globalThis.MediaSource.isTypeSupported;
    if (origMSE) {
      Object.defineProperty(MediaSource, 'isTypeSupported', {
        value: (type) => (!deny(type) && origMSE.call(MediaSource, type)),
        configurable: true
      });
    }

    const videoProto = HTMLMediaElement.prototype;
    const origCanPlay = videoProto.canPlayType;
    Object.defineProperty(videoProto, 'canPlayType', {
      value: function (type) {
        if (deny(type)) return '';
        return origCanPlay.call(this, type);
      },
      configurable: true
    });

    // (UA override not used; left here as a safe no-op placeholder.)
    try {
      const desc = Object.getOwnPropertyDescriptor(
        Navigator.prototype,
        'userAgent'
      );
      if (desc && desc.get) {
        // const ua = desc.get.call(navigator);
        // no UA mutation in preload
      }
    } catch {}
  } catch {}
})();

// ---------------------------------------------------------------------------
// Optional battery-saver for YouTube: enforce 720p.
// Enable with env MZV_LIMIT_QUALITY=1
// ---------------------------------------------------------------------------
(() => {
  try {
    if (process.env.MZV_LIMIT_QUALITY !== '1') return;
    const host = (location.hostname || '').toLowerCase();
    if (!/(^|\.)youtube\.com$/.test(host)) return;

    localStorage.setItem(
      'yt-player-quality',
      JSON.stringify({ data: 'hd720' })
    );
    localStorage.setItem(
      'yt-player-quality-manual',
      JSON.stringify({ data: true })
    );
  } catch {}
})();
