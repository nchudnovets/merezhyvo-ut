'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose a minimal, safe API to the renderer.
 * Usage in renderer:
 *   if (window.merezhyvo?.onMode) {
 *     window.merezhyvo.onMode((mode) => { /* apply mode */ /* });
 *   }
 */
contextBridge.exposeInMainWorld('merezhyvo', {
  onMode: (handler) => {
    if (typeof handler !== 'function') return () => {};
    const channel = 'merezhyvo:mode';
    const wrapped = (_e, mode) => { try { handler(mode); } catch {} };
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },

  createShortcut: async ({ title, url, single = true, icon }) => {
    // icon?: { name: string, data: ArrayBuffer }  // не обов'язково
    const payload = {
      title: String(title || '').trim(),
      url: String(url || '').trim(),
      single: !!single,
      icon: icon && icon.data && icon.name ? {
        name: String(icon.name || 'icon.png'),
        // передамо як base64, щоб не плодити типів
        dataBase64: Buffer.from(icon.data).toString('base64')
      } : null
    };
    return ipcRenderer.invoke('merezhyvo:createShortcut', payload);
  }
});

// ---------------------------------------------------------------------------
// Deny VP9/AV1 by faking support checks (h264ify-like behavior).
// Keeps sites from selecting VP9/AV1 when H.264 is preferable on-device.
// ---------------------------------------------------------------------------
(() => {
  try {
    const deny = (type = '') => /(webm|vp9|av01|av1)/i.test(type);

    const origMSE = globalThis.MediaSource && globalThis.MediaSource.isTypeSupported;
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
      const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');
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

    localStorage.setItem('yt-player-quality', JSON.stringify({ data: 'hd720' }));
    localStorage.setItem('yt-player-quality-manual', JSON.stringify({ data: true }));
  } catch {}
})();
