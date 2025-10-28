'use strict';

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import pkgJson from '../package.json';

import type {
  MerezhyvoAPI,
  MerezhyvoAppInfo,
  MerezhyvoOpenUrlPayload,
  MerezhyvoShortcutRequest,
  MerezhyvoShortcutResult,
  MerezhyvoTorToggleOptions,
  MerezhyvoTorState,
  MerezhyvoSessionState,
  MerezhyvoSettingsState,
  MerezhyvoInstalledAppsResult
} from '../src/types/preload';
import type { Mode, TorConfigResult, Unsubscribe } from '../src/types/models';

type PackageMeta = {
  productName?: string;
  name?: string;
  version?: string;
  description?: string;
};

const pkg = pkgJson as PackageMeta;

const appInfo: MerezhyvoAppInfo = {
  name: pkg.productName || pkg.name || 'Merezhyvo',
  version: pkg.version || '0.0.0',
  description: pkg.description || ''
};

const runtimeVersions = {
  chromium: process.versions.chrome || '',
  electron: process.versions.electron || '',
  node: process.versions.node || ''
};

type ShortcutIconInput = MerezhyvoShortcutRequest['icon'];

type CreateShortcutIconPayload = {
  name: string;
  dataBase64: string;
};

type CreateShortcutPayload = {
  title: string;
  url: string;
  single: boolean;
  icon: CreateShortcutIconPayload | null;
};

const noopUnsubscribe: Unsubscribe = () => {};

const encodeIconPayload = (icon: ShortcutIconInput): CreateShortcutIconPayload | null => {
  if (!icon) return null;
  const rawName = typeof icon.name === 'string' ? icon.name : '';
  const name = rawName.trim().length ? rawName.trim() : 'icon.png';
  const dataValue = (icon as { data?: unknown }).data;
  if (typeof dataValue === 'string') {
    return { name, dataBase64: Buffer.from(dataValue).toString('base64') };
  }
  if (dataValue instanceof ArrayBuffer) {
    return { name, dataBase64: Buffer.from(new Uint8Array(dataValue)).toString('base64') };
  }
  if (dataValue instanceof Uint8Array) {
    return { name, dataBase64: Buffer.from(dataValue).toString('base64') };
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(dataValue)) {
    return { name, dataBase64: (dataValue as Buffer).toString('base64') };
  }
  return null;
};

const exposeApi: MerezhyvoAPI = {
  appInfo: {
    ...appInfo,
    chromium: runtimeVersions.chromium,
    electron: runtimeVersions.electron,
    node: runtimeVersions.node
  },
  onMode: (handler) => {
    if (typeof handler !== 'function') return noopUnsubscribe;
    const channel = 'merezhyvo:mode';
    const wrapped = (_event: IpcRendererEvent, incoming: unknown) => {
      try {
        const normalized: Mode = incoming === 'mobile' ? 'mobile' : 'desktop';
        handler(normalized);
      } catch {
        // noop
      }
    };
    ipcRenderer.on(channel, wrapped);
    return () => {
      try {
        ipcRenderer.removeListener(channel, wrapped);
      } catch {
        // noop
      }
    };
  },

  notifyTabsReady: () => {
    try {
      ipcRenderer.send('tabs:ready');
    } catch {
      // noop
    }
  },

  onOpenUrl: (handler) => {
    if (typeof handler !== 'function') return noopUnsubscribe;
    const channel = 'mzr:open-url';
    const listener = (_event: IpcRendererEvent, payload: unknown) => {
      try {
        const url =
          typeof payload === 'string'
            ? payload
            : typeof payload === 'object' && payload && typeof (payload as { url?: unknown }).url === 'string'
            ? ((payload as { url?: string }).url ?? '')
            : '';
        const activate =
          typeof payload === 'object' && payload && typeof (payload as { activate?: unknown }).activate === 'boolean'
            ? ((payload as { activate?: boolean }).activate ?? true)
            : true;
        if (url) {
          const openPayload: MerezhyvoOpenUrlPayload = { url, activate };
          handler(openPayload);
        }
      } catch {
        // noop
      }
    };
    ipcRenderer.on(channel, listener);
    return () => {
      try {
        ipcRenderer.removeListener(channel, listener);
      } catch {
        // noop
      }
    };
  },

  createShortcut: async (input: MerezhyvoShortcutRequest): Promise<MerezhyvoShortcutResult> => {
    const payload: CreateShortcutPayload = {
      title: String(input?.title ?? '').trim(),
      url: String(input?.url ?? '').trim(),
      single: Boolean(input?.single ?? true),
      icon: encodeIconPayload(input?.icon ?? null)
    };
    try {
      return (await ipcRenderer.invoke('merezhyvo:createShortcut', payload)) as MerezhyvoShortcutResult;
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  tor: {
    toggle: (options?: MerezhyvoTorToggleOptions) =>
      ipcRenderer.invoke('tor:toggle', options ?? {}) as Promise<MerezhyvoTorState>,
    getState: () => ipcRenderer.invoke('tor:get-state') as Promise<MerezhyvoTorState>,
    onState: (handler) => {
      if (typeof handler !== 'function') return noopUnsubscribe;
      const channel = 'tor:state';
      const listener = (_event: IpcRendererEvent, state: MerezhyvoTorState | { enabled?: unknown; reason?: unknown }) => {
        try {
          const enabled =
            typeof state?.enabled === 'boolean'
              ? state.enabled
              : Boolean((state as { enabled?: unknown })?.enabled);
          const reason =
            typeof state?.reason === 'string'
              ? state.reason
              : (state as { reason?: unknown })?.reason != null
              ? String((state as { reason?: unknown }).reason)
              : null;
          handler(enabled, reason);
        } catch {
          // noop
        }
      };
      ipcRenderer.on(channel, listener);
      return () => {
        try {
          ipcRenderer.removeListener(channel, listener);
        } catch {
          // noop
        }
      };
    }
  },

  openContextMenuAt: (x: number, y: number, dpr = 1) => {
    try {
      ipcRenderer.send('mzr:ctxmenu:open', { x, y, dpr });
    } catch {
      // noop
    }
  },

  session: {
    load: async () => {
      try {
        return (await ipcRenderer.invoke('merezhyvo:session:load')) as MerezhyvoSessionState | null;
      } catch (err) {
        console.error('[merezhyvo] session.load failed', err);
        return null;
      }
    },
    save: async (data: MerezhyvoSessionState) => {
      try {
        return (await ipcRenderer.invoke(
          'merezhyvo:session:save',
          data
        )) as { ok: boolean; error?: string } | null;
      } catch (err) {
        console.error('[merezhyvo] session.save failed', err);
        return { ok: false, error: String(err) };
      }
    }
  },

  settings: {
    load: async () => {
      try {
        return (await ipcRenderer.invoke('merezhyvo:settings:load')) as MerezhyvoSettingsState;
      } catch (err) {
        console.error('[merezhyvo] settings.load failed', err);
        return { schema: 1, installedApps: [], tor: { containerId: '' } };
      }
    },
    installedApps: {
      list: async () => {
        try {
          return (await ipcRenderer.invoke(
            'merezhyvo:settings:installedApps:list'
          )) as MerezhyvoInstalledAppsResult;
        } catch (err) {
          console.error('[merezhyvo] settings.installedApps.list failed', err);
          return { ok: false, error: String(err), installedApps: [] };
        }
      },
      remove: async (payload: Parameters<MerezhyvoAPI['settings']['installedApps']['remove']>[0]) => {
        try {
          return (await ipcRenderer.invoke(
            'merezhyvo:settings:installedApps:remove',
            payload ?? null
          )) as { ok: boolean; error?: string };
        } catch (err) {
          console.error('[merezhyvo] settings.installedApps.remove failed', err);
          return { ok: false, error: String(err) };
        }
      }
    },
    tor: {
      update: async (payload?: { containerId?: string }) => {
        try {
          return (await ipcRenderer.invoke(
            'merezhyvo:settings:tor:update',
            payload ?? {}
          )) as TorConfigResult;
        } catch (err) {
          console.error('[merezhyvo] settings.tor.update failed', err);
          return { ok: false, error: String(err) };
        }
      }
    }
  },

  power: {
    start: async () => {
      try {
        return (await ipcRenderer.invoke('merezhyvo:power:start')) as number | null;
      } catch (err) {
        console.error('[merezhyvo] power.start failed', err);
        return null;
      }
    },
    stop: async (id?: number | null) => {
      try {
        return await ipcRenderer.invoke('merezhyvo:power:stop', id ?? null);
      } catch (err) {
        console.error('[merezhyvo] power.stop failed', err);
        return null;
      }
    },
    isStarted: async (id?: number | null) => {
      try {
        return (await ipcRenderer.invoke('merezhyvo:power:isStarted', id ?? null)) as boolean;
      } catch (err) {
        console.error('[merezhyvo] power.isStarted failed', err);
        return false;
      }
    }
  }
};

contextBridge.exposeInMainWorld('merezhyvo', exposeApi);

(() => {
  try {
    const deny = (type = ''): boolean => /(webm|vp9|av01|av1)/i.test(type);

    const origMSE = globalThis.MediaSource?.isTypeSupported;
    if (origMSE) {
      Object.defineProperty(MediaSource, 'isTypeSupported', {
        value: (type: string) => !deny(type) && origMSE.call(MediaSource, type),
        configurable: true
      });
    }

    const videoProto = HTMLMediaElement.prototype;
    const origCanPlay = videoProto.canPlayType;
    Object.defineProperty(videoProto, 'canPlayType', {
      value: function (this: HTMLMediaElement, type: string) {
        if (deny(type)) return '';
        return origCanPlay.call(this, type);
      },
      configurable: true
    });

    try {
      const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');
      if (desc?.get) {
        // const ua = desc.get.call(navigator);
        // no UA mutation in preload
      }
    } catch {
      // noop
    }
  } catch {
    // noop
  }
})();

(() => {
  try {
    if (process.env.MZV_LIMIT_QUALITY !== '1') return;
    const host = (globalThis.location?.hostname ?? '').toLowerCase();
    if (!/(^|\.)youtube\.com$/.test(host)) return;

    globalThis.localStorage?.setItem('yt-player-quality', JSON.stringify({ data: 'hd720' }));
    globalThis.localStorage?.setItem('yt-player-quality-manual', JSON.stringify({ data: true }));
  } catch {
    // noop
  }
})();
