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
  MerezhyvoInstalledAppsResult,
  MerezhyvoTabCleanResult
} from '../src/types/preload';
import type { FileDialogOptions, Mode, TorConfigResult, Unsubscribe } from '../src/types/models';
import { sanitizeMessengerSettings } from '../src/shared/messengers';
import type { PermissionsState } from './lib/permissions-settings';
import path from 'path';

type KeyboardSettings = {
  enabledLayouts: string[];
  defaultLayout: string;
};

const sanitizeKeyboardSettings = (raw: unknown): KeyboardSettings => {
  if (!raw || typeof raw !== 'object') {
    return { enabledLayouts: ['en'], defaultLayout: 'en' };
  }
  const record = raw as Record<string, unknown>;
  const layouts = Array.isArray(record.enabledLayouts)
    ? record.enabledLayouts.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const enabledLayouts = layouts.length > 0 ? Array.from(new Set(layouts)) : ['en'];
  const defCandidate = typeof record.defaultLayout === 'string' ? record.defaultLayout.trim() : undefined;
  const defaultLayout = defCandidate && enabledLayouts.includes(defCandidate)
    ? defCandidate
    : enabledLayouts[0] ?? 'en';
  return { enabledLayouts, defaultLayout };
};

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

  tabs: {
    cleanData: async (input) => {
      const url = typeof input?.url === 'string' ? input.url.trim() : '';
      const webContentsId =
        typeof input?.webContentsId === 'number' ? input.webContentsId : undefined;
      try {
        return (await ipcRenderer.invoke('merezhyvo:tabs:clean-data', {
          url,
          webContentsId
        })) as MerezhyvoTabCleanResult;
      } catch (err) {
        return { ok: false, error: String(err) };
      }
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
        return {
          schema: 2,
          installedApps: [],
          tor: { containerId: '', keepEnabled: false },
          keyboard: { enabledLayouts: ['en'], defaultLayout: 'en' },
          messenger: sanitizeMessengerSettings(null)
        };
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
      update: async (payload?: { containerId?: string; keepEnabled?: boolean }) => {
        try {
          return (await ipcRenderer.invoke(
            'merezhyvo:settings:tor:update',
            payload ?? {}
          )) as TorConfigResult;
        } catch (err) {
          console.error('[merezhyvo] settings.tor.update failed', err);
          return { ok: false, error: String(err) };
        }
      },
      setKeepEnabled: async (keepEnabled: boolean) => {
        try {
          return (await ipcRenderer.invoke(
            'merezhyvo:settings:tor:set-keep',
            { keepEnabled }
          )) as TorConfigResult;
        } catch (err) {
          console.error('[merezhyvo] settings.tor.setKeepEnabled failed', err);
          return { ok: false, error: String(err) };
        }
      }
    },
    keyboard: {
      get: async (): Promise<KeyboardSettings> => {
        try {
          const result = await ipcRenderer.invoke('mzr:kb:get');
          return sanitizeKeyboardSettings(result);
        } catch (err) {
          console.error('[merezhyvo] keyboard.get failed', err);
          return sanitizeKeyboardSettings({});
        }
      },
      update: async (payload: Partial<KeyboardSettings>): Promise<KeyboardSettings> => {
        try {
          const result = await ipcRenderer.invoke('mzr:kb:update', payload ?? {});
          return sanitizeKeyboardSettings(result);
        } catch (err) {
          console.error('[merezhyvo] keyboard.update failed', err);
          return sanitizeKeyboardSettings({});
        }
      }
    },
    messenger: {
      get: async () => {
        try {
          const result = await ipcRenderer.invoke('merezhyvo:settings:messenger:get');
          return sanitizeMessengerSettings(result);
        } catch (err) {
          console.error('[merezhyvo] settings.messenger.get failed', err);
          return sanitizeMessengerSettings(null);
        }
      },
      update: async (order) => {
        try {
          const payload = Array.isArray(order) ? order : [];
          const result = await ipcRenderer.invoke('merezhyvo:settings:messenger:update', payload);
          return sanitizeMessengerSettings(result);
        } catch (err) {
          console.error('[merezhyvo] settings.messenger.update failed', err);
          return sanitizeMessengerSettings({ order });
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
        await ipcRenderer.invoke('merezhyvo:power:stop', id ?? null);
        return undefined;
      } catch (err) {
        console.error('[merezhyvo] power.stop failed', err);
        return undefined;
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
  },
  ua: {
    setMode: async (mode: 'desktop' | 'mobile' | 'auto') => {
      const value = mode === 'desktop' || mode === 'mobile' ? mode : 'auto';
      try {
        await ipcRenderer.invoke('merezhyvo:ua:set-mode', value);
      } catch (err) {
        console.error('[merezhyvo] ua.setMode failed', err);
      }
    }
  },
  osk: {
    /**
     * Send printable characters as trusted 'char' events.
     */
    char: (wcId: number, text: string) =>
      ipcRenderer.invoke('mzr:osk:char', { wcId, text }),

    /**
     * Send special keys as trusted keyDown/keyUp events.
     * Examples: 'Backspace', 'Enter', 'ArrowLeft', 'ArrowRight', etc.
     */
    key: (
      wcId: number,
      key: string,
      modifiers?: Array<'shift' | 'control' | 'alt' | 'meta'>
    ) => ipcRenderer.invoke('mzr:osk:key', { wcId, key, modifiers }),
  },
  permissions: {
    onPrompt(handler: (req: { id: string; origin: string; types: Array<'camera' | 'microphone' | 'geolocation' | 'notifications'> }) => void): () => void {
      const channel = 'merezhyvo:permission:prompt';
      const wrapped = (_evt: unknown, payload: { id: string; origin: string; types: Array<'camera' | 'microphone' | 'geolocation' | 'notifications'> }) => {
        handler(payload);
      };
      ipcRenderer.on(channel, wrapped as never);
      return () => ipcRenderer.removeListener(channel, wrapped as never);
    },
    decide(payload: { id: string; allow: boolean; remember: boolean; persist?: Partial<Record<'camera' | 'microphone' | 'geolocation' | 'notifications', 'allow' | 'deny'>> }): void {
      ipcRenderer.send('merezhyvo:permission:decide', payload);
    },
    store: {
      get(): Promise<PermissionsState> {
        return ipcRenderer.invoke('mzr:perms:get');
      },
      updateSite(origin: string, patch: Partial<Record<'camera' | 'microphone' | 'geolocation' | 'notifications', 'allow' | 'deny'>>): Promise<boolean> {
        return ipcRenderer.invoke('mzr:perms:updateSite', { origin, patch });
      },
      resetSite(origin: string): Promise<boolean> {
        return ipcRenderer.invoke('mzr:perms:resetSite', origin);
      },
      resetAll(): Promise<boolean> {
        return ipcRenderer.invoke('mzr:perms:resetAll');
      },
      updateDefaults(patch: Partial<Record<'camera' | 'microphone' | 'geolocation' | 'notifications', 'allow' | 'deny' | 'prompt'>>): Promise<boolean> {
        return ipcRenderer.invoke('mzr:perms:updateDefaults', patch);
      }
    }
  },
  history: {
    query: (options) => ipcRenderer.invoke('merezhyvo:history:query', options ?? {}),
    topSites: (options) => ipcRenderer.invoke('merezhyvo:history:top-sites', options ?? {}),
    remove: (filter) => ipcRenderer.invoke('merezhyvo:history:remove', filter ?? {}),
    clearAll: async () => {
      await ipcRenderer.invoke('merezhyvo:history:clear-all');
    }
  },
  bookmarks: {
    list: () => ipcRenderer.invoke('merezhyvo:bookmarks:list'),
    isBookmarked: (url: string) => ipcRenderer.invoke('merezhyvo:bookmarks:isBookmarked', url ?? ''),
    add: (payload) => ipcRenderer.invoke('merezhyvo:bookmarks:add', payload),
    update: (payload) => ipcRenderer.invoke('merezhyvo:bookmarks:update', payload),
    move: (payload) => ipcRenderer.invoke('merezhyvo:bookmarks:move', payload),
    remove: (id: string) => ipcRenderer.invoke('merezhyvo:bookmarks:remove', id ?? ''),
    export: () => ipcRenderer.invoke('merezhyvo:bookmarks:export'),
    import: (payload) => ipcRenderer.invoke('merezhyvo:bookmarks:import', payload),
    importHtml: {
      preview: (payload) => ipcRenderer.invoke('merezhyvo:bookmarks:import-html:preview', payload ?? {}),
      apply: (payload) => ipcRenderer.invoke('merezhyvo:bookmarks:import-html:apply', payload ?? {})
    },
    exportHtml: (payload) =>
      ipcRenderer.invoke('merezhyvo:bookmarks:export-html', payload ?? {})
  },
  fileDialog: {
    list: (payload) => ipcRenderer.invoke('merezhyvo:file-dialog:list', payload ?? {}),
    readFile: (payload) => ipcRenderer.invoke('merezhyvo:file-dialog:read', payload ?? {}),
    onRequest: (handler) => {
      if (typeof handler !== 'function') return noopUnsubscribe;
      const channel = 'merezhyvo:file-dialog:open';
      const listener = (_event: IpcRendererEvent, detail: { requestId?: string; options?: FileDialogOptions }) => {
        if (!detail?.requestId || !detail.options) return;
        try {
          handler({ requestId: detail.requestId, options: detail.options });
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
    respond: (payload) => ipcRenderer.invoke('merezhyvo:file-dialog:selection', payload ?? {}),
    saveFile: (payload) => ipcRenderer.invoke('merezhyvo:file-dialog:write', payload ?? {})
  },
  favicons: {
    getPath: (faviconId: string) =>
      ipcRenderer.invoke('merezhyvo:favicons:get-path', faviconId ?? '') as Promise<string | null>
  },
  paths: {
    webviewPreload(): string {
      const candidates = [
        path.join(__dirname, 'webview-preload.js'),
        path.join(__dirname, 'webview-preload.cjs'),
        path.join(__dirname, '../electron', 'webview-preload.js'),
        path.join(process.resourcesPath || '', 'app.asar.unpacked', 'electron', 'webview-preload.js'),
        path.join(process.resourcesPath || '', 'electron', 'webview-preload.js'),
      ];

      void candidates;

      // for (const p of candidates) {
      //   try {
      //     if (fs.existsSync(p)) {
      //       try { void ipcRenderer.invoke('mzr:geo:log', `paths.webviewPreload: ${p}`); } catch {}
      //       return p;
      //     }
      //   } catch {}
      // }

      // try { void ipcRenderer.invoke('mzr:geo:log', `paths.webviewPreload: not found (dirname=${__dirname})`); } catch {}
      return '';
    }
  },

  // Simple debug hook to write into geo.log from the renderer
  debug: {
    logGeo(msg: string): void {
      try { void ipcRenderer.invoke('mzr:geo:log', `renderer: ${msg}`); } catch {}
    }
  }
};

ipcRenderer.on('merezhyvo:download-status', (_event, payload: { status: 'started' | 'completed' | 'failed'; file?: string }) => {
  try {
    window.dispatchEvent(new CustomEvent('merezhyvo:download-status', { detail: payload }));
  } catch {
    // noop
  }
});

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
      void Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');
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
