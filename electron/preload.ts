'use strict';

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import pkgJson from '../package.json';

import type {
  MerezhyvoAPI,
  MerezhyvoAppInfo,
  MerezhyvoAboutInfo,
  MerezhyvoOpenUrlPayload,
  MerezhyvoTorState,
  MerezhyvoSessionState,
  MerezhyvoSettingsState,
  MerezhyvoTabCleanResult,
  PasswordFieldFocusPayload
} from '../src/types/preload';
import type {
  FileDialogOptions,
  Mode,
  TorConfigResult,
  Unsubscribe,
  PasswordEntryMeta,
  PasswordEntrySecret,
  PasswordSettings,
  PasswordUpsertPayload,
  PasswordCsvPreview,
  PasswordCsvImportResult,
  PasswordEncryptedExportResult,
  PasswordImportMode,
  PasswordImportFormat,
  PasswordChangeMasterResult,
  PasswordStatus,
  CertificateInfo,
  HttpsMode,
  SslException,
  WebrtcMode,
  TrackerStatus,
  TrackerPrivacySettings
} from '../src/types/models';
import { sanitizeMessengerSettings } from '../src/shared/messengers';
import type { PermissionsState } from './lib/permissions-settings';
import { DOWNLOADS_SYMLINK_COMMAND, DOCUMENTS_SYMLINK_COMMAND } from './lib/internal-paths';
import path from 'path';
import { DEFAULT_LOCALE } from '../src/i18n/locales';

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
  description: pkg.description || '',
  torVersion: null
};

const runtimeVersions = {
  chromium: process.versions.chrome || '',
  electron: process.versions.electron || '',
  node: process.versions.node || ''
};

const applyUiScale = () => {
  const root =
    document.documentElement ?? document?.getElementsByTagName?.('html')?.[0] ?? null;
  if (!root) return;
  try {
    const scale =
      (ipcRenderer.sendSync('merezhyvo:ui:getScaleSync') as number | undefined) ?? 1;
    root.style.setProperty('--ui-scale', String(scale));
  } catch {
    root.style.setProperty('--ui-scale', '1');
  }
};
applyUiScale();

const noopUnsubscribe: Unsubscribe = () => {};

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

  tor: {
    toggle: () =>
      ipcRenderer.invoke('tor:toggle') as Promise<MerezhyvoTorState>,
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
  about: {
    getInfo: () =>
      ipcRenderer.invoke('about:get-info') as Promise<MerezhyvoAboutInfo>
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
          schema: 6,
          tor: { keepEnabled: false },
          keyboard: { enabledLayouts: ['en'], defaultLayout: 'en' },
          messenger: sanitizeMessengerSettings(null),
          downloads: { defaultDir: '', concurrent: 2 },
          ui: { scale: 1, hideFileDialogNote: false, language: DEFAULT_LOCALE },
          httpsMode: 'strict',
          sslExceptions: [],
          webrtcMode: 'always_on',
          privacy: { cookies: { blockThirdParty: false, exceptions: { thirdPartyAllow: {} } } }
        };
      }
    },
    cookies: {
      get: async () => {
        try {
          return (await ipcRenderer.invoke('merezhyvo:settings:cookies:get')) as {
            blockThirdParty: boolean;
            exceptions: { thirdPartyAllow: Record<string, boolean> };
          };
        } catch (err) {
          console.error('[merezhyvo] settings.cookies.get failed', err);
          return { blockThirdParty: false, exceptions: { thirdPartyAllow: {} } };
        }
      },
      setBlock: async (blockThirdParty: boolean) => {
        try {
          return (await ipcRenderer.invoke('merezhyvo:settings:cookies:set-block', { blockThirdParty })) as {
            blockThirdParty: boolean;
            exceptions: { thirdPartyAllow: Record<string, boolean> };
          };
        } catch (err) {
          console.error('[merezhyvo] settings.cookies.setBlock failed', err);
          return { blockThirdParty, exceptions: { thirdPartyAllow: {} } };
        }
      },
      setException: async (host: string, allow: boolean) => {
        try {
          return (await ipcRenderer.invoke('merezhyvo:settings:cookies:set-exception', { host, allow })) as {
            blockThirdParty: boolean;
            exceptions: { thirdPartyAllow: Record<string, boolean> };
          };
        } catch (err) {
          console.error('[merezhyvo] settings.cookies.setException failed', err);
          return { blockThirdParty: false, exceptions: { thirdPartyAllow: {} } };
        }
      },
      listExceptions: async () => {
        try {
          return (await ipcRenderer.invoke('merezhyvo:settings:cookies:list-exceptions')) as Record<string, boolean>;
        } catch (err) {
          console.error('[merezhyvo] settings.cookies.listExceptions failed', err);
          return {};
        }
      },
      clearExceptions: async () => {
        try {
          return (await ipcRenderer.invoke('merezhyvo:settings:cookies:clear-exceptions')) as {
            blockThirdParty: boolean;
            exceptions: { thirdPartyAllow: Record<string, boolean> };
          };
        } catch (err) {
          console.error('[merezhyvo] settings.cookies.clearExceptions failed', err);
          return { blockThirdParty: false, exceptions: { thirdPartyAllow: {} } };
        }
      }
    },
    tor: {
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
    },
    https: {
      get: async (): Promise<{ httpsMode: HttpsMode; sslExceptions: SslException[] }> => {
        try {
          const result = await ipcRenderer.invoke('merezhyvo:settings:https:get');
          const mode =
            result && typeof result === 'object' && typeof (result as { httpsMode?: unknown }).httpsMode !== 'undefined'
              ? (result as { httpsMode?: unknown }).httpsMode
              : undefined;
          const exceptions =
            result && typeof result === 'object' && Array.isArray((result as { sslExceptions?: unknown }).sslExceptions)
              ? (result as { sslExceptions: unknown }).sslExceptions
              : undefined;
          return {
            httpsMode: mode === 'preferred' ? 'preferred' : 'strict',
            sslExceptions: Array.isArray(exceptions) ? (exceptions as SslException[]) : []
          };
        } catch (err) {
          console.error('[merezhyvo] settings.https.get failed', err);
          return { httpsMode: 'strict', sslExceptions: [] };
        }
      },
      setMode: async (mode: HttpsMode) => {
        try {
          const result = await ipcRenderer.invoke('merezhyvo:settings:https:set-mode', { mode });
          return result as { ok?: boolean; httpsMode?: HttpsMode; error?: string };
        } catch (err) {
          console.error('[merezhyvo] settings.https.setMode failed', err);
          return { ok: false, error: String(err) };
        }
      },
      addException: async (payload: { host: string; errorType: string }) => {
        try {
          const result = await ipcRenderer.invoke('merezhyvo:settings:https:add-exception', payload ?? {});
          return result as { ok?: boolean; sslExceptions?: SslException[]; error?: string };
        } catch (err) {
          console.error('[merezhyvo] settings.https.addException failed', err);
          return { ok: false, error: String(err) };
        }
      },
      removeException: async (payload: { host: string; errorType: string }) => {
        try {
          const result = await ipcRenderer.invoke('merezhyvo:settings:https:remove-exception', payload ?? {});
          return result as { ok?: boolean; sslExceptions?: SslException[]; error?: string };
        } catch (err) {
          console.error('[merezhyvo] settings.https.removeException failed', err);
          return { ok: false, error: String(err) };
        }
      }
    },
    webrtc: {
      get: async (): Promise<{ mode: WebrtcMode }> => {
        try {
          const result = await ipcRenderer.invoke('merezhyvo:settings:webrtc:get');
          const mode =
            result && typeof result === 'object' && typeof (result as { mode?: unknown }).mode === 'string'
              ? (result as { mode: WebrtcMode }).mode
              : 'always_on';
          return { mode };
        } catch (err) {
          console.error('[merezhyvo] settings.webrtc.get failed', err);
          return { mode: 'always_on' };
        }
      },
      setMode: async (mode: WebrtcMode) => {
        try {
          const result = await ipcRenderer.invoke('merezhyvo:settings:webrtc:set-mode', { mode });
          return result as { ok?: boolean; mode?: WebrtcMode; error?: string };
        } catch (err) {
          console.error('[merezhyvo] settings.webrtc.setMode failed', err);
          return { ok: false, error: String(err) };
        }
      }
    },
    trackers: {
      get: async (): Promise<TrackerPrivacySettings> => {
        try {
          const result = await ipcRenderer.invoke('merezhyvo:settings:trackers:get');
          const enabled = typeof result?.enabled === 'boolean' ? result.enabled : true;
          const exceptions = Array.isArray(result?.exceptions) ? result.exceptions : [];
          return { enabled, exceptions };
        } catch (err) {
          console.error('[merezhyvo] settings.trackers.get failed', err);
          return { enabled: true, exceptions: [] };
        }
      },
      setEnabled: async (enabled: boolean) => {
        try {
          return (await ipcRenderer.invoke('merezhyvo:settings:trackers:set-enabled', enabled)) as TrackerPrivacySettings;
        } catch (err) {
          console.error('[merezhyvo] settings.trackers.setEnabled failed', err);
          return { enabled, exceptions: [] };
        }
      },
      addException: async (host: string) => {
        try {
          return (await ipcRenderer.invoke('merezhyvo:settings:trackers:add-exception', { host })) as TrackerPrivacySettings;
        } catch (err) {
          console.error('[merezhyvo] settings.trackers.addException failed', err);
          return { enabled: true, exceptions: [] };
        }
      },
      removeException: async (host: string) => {
        try {
          return (await ipcRenderer.invoke('merezhyvo:settings:trackers:remove-exception', { host })) as TrackerPrivacySettings;
        } catch (err) {
          console.error('[merezhyvo] settings.trackers.removeException failed', err);
          return { enabled: true, exceptions: [] };
        }
      },
      clearExceptions: async () => {
        try {
          return (await ipcRenderer.invoke('merezhyvo:settings:trackers:clear-exceptions')) as TrackerPrivacySettings;
        } catch (err) {
          console.error('[merezhyvo] settings.trackers.clearExceptions failed', err);
          return { enabled: true, exceptions: [] };
        }
      }
    },
    siteData: {
        list: async () => {
          try {
            return (await ipcRenderer.invoke('merezhyvo:siteData:list')) as Array<{
              host: string;
              hasCookies: boolean;
              hasSiteStorage: boolean;
              hasHistory: boolean;
            }>;
          } catch (err) {
            console.error('[merezhyvo] siteData.list failed', err);
            return [];
          }
        },
      clearCookiesForSite: async (host: string) => {
        try {
          return (await ipcRenderer.invoke('merezhyvo:siteData:clearCookiesForSite', { host })) as { ok?: boolean; error?: string };
        } catch (err) {
          console.error('[merezhyvo] siteData.clearCookiesForSite failed', err);
          return { ok: false, error: String(err) };
        }
      },
      clearStorageForSite: async (host: string) => {
        try {
          return (await ipcRenderer.invoke('merezhyvo:siteData:clearStorageForSite', { host })) as { ok?: boolean; error?: string };
        } catch (err) {
          console.error('[merezhyvo] siteData.clearStorageForSite failed', err);
          return { ok: false, error: String(err) };
        }
      },
      clearHistoryForSite: async (host: string) => {
        try {
          return (await ipcRenderer.invoke('merezhyvo:siteData:clearHistoryForSite', { host })) as { ok?: boolean; error?: string };
        } catch (err) {
          console.error('[merezhyvo] siteData.clearHistoryForSite failed', err);
          return { ok: false, error: String(err) };
        }
      },
      clearGlobal: async (opts: { cookiesAndSiteData?: boolean; cache?: boolean; history?: boolean }) => {
        try {
          return (await ipcRenderer.invoke('merezhyvo:siteData:clearGlobal', opts ?? {})) as { ok?: boolean; error?: string };
        } catch (err) {
          console.error('[merezhyvo] siteData.clearGlobal failed', err);
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
      readBinary: (payload) => ipcRenderer.invoke('merezhyvo:file-dialog:read-binary', payload ?? {}),
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
  downloads: {
    settings: {
      get: () => ipcRenderer.invoke('merezhyvo:downloads:settings:get'),
      set: (payload) => ipcRenderer.invoke('merezhyvo:downloads:settings:set', payload ?? {})
    }
  },
  trackers: {
    getStatus: async (payload: { webContentsId?: number | null }) => {
      try {
        return (await ipcRenderer.invoke('trackers:getStatus', payload ?? {})) as TrackerStatus;
      } catch (err) {
        console.error('[merezhyvo] trackers.getStatus failed', err);
        return { enabledGlobal: false, siteHost: null, siteAllowed: false, blockedCount: 0 };
      }
    },
    setEnabled: async (enabled: boolean) => {
      try {
        return (await ipcRenderer.invoke('trackers:setEnabled', enabled)) as TrackerPrivacySettings;
      } catch (err) {
        console.error('[merezhyvo] trackers.setEnabled failed', err);
        return { enabled, exceptions: [] };
      }
    },
    setSiteAllowed: async (payload: { siteHost: string; allowed: boolean }) => {
      try {
        return (await ipcRenderer.invoke('trackers:setSiteAllowed', payload ?? {})) as TrackerPrivacySettings;
      } catch (err) {
        console.error('[merezhyvo] trackers.setSiteAllowed failed', err);
        return { enabled: true, exceptions: [] };
      }
    },
    clearExceptions: async () => {
      try {
        return (await ipcRenderer.invoke('trackers:clearExceptions')) as TrackerPrivacySettings;
      } catch (err) {
        console.error('[merezhyvo] trackers.clearExceptions failed', err);
        return { enabled: true, exceptions: [] };
      }
    },
    onStats: (handler: (payload: TrackerStatus) => void) => {
      if (typeof handler !== 'function') return noopUnsubscribe;
      const channel = 'trackers:statsChanged';
      const listener = (_event: IpcRendererEvent, payload: unknown) => {
        try {
          handler(payload as TrackerStatus);
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
  ui: {
    get: async () => {
      try {
        const result = await ipcRenderer.invoke('merezhyvo:ui:getScale');
        if (typeof result === 'object' && result && typeof result.scale === 'number') {
          return {
            scale: result.scale,
            hideFileDialogNote: Boolean(result.hideFileDialogNote),
            language: typeof result.language === 'string' ? result.language : DEFAULT_LOCALE
          };
        }
      } catch {
        // noop
      }
      return { scale: 1, hideFileDialogNote: false, language: DEFAULT_LOCALE };
    },
    set: async (payload) => {
      try {
        const normalized = (await ipcRenderer.invoke('merezhyvo:ui:setScale', payload ?? {})) as
          | { ok: true; scale: number; hideFileDialogNote: boolean; language: string }
          | { ok: false; error: string };
        return normalized;
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
    getLanguage: async () => {
      try {
        const result = await ipcRenderer.invoke('merezhyvo:ui:getLanguage');
        if (typeof result === 'string' && result.trim().length) {
          return result;
        }
      } catch {
        /* noop */
      }
      return DEFAULT_LOCALE;
    },
    setLanguage: async (language?: string) => {
      if (!language || typeof language !== 'string') {
        return { ok: false, error: 'Invalid language' };
      }
      try {
        const normalized = (await ipcRenderer.invoke(
          'merezhyvo:ui:setLanguage',
          language
        )) as { ok: true; language: string } | { ok: false; error: string };
        return normalized;
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }
  },
  favicons: {
    getPath: (faviconId: string) =>
      ipcRenderer.invoke('merezhyvo:favicons:get-path', faviconId ?? '') as Promise<string | null>
  },
  certificates: {
    getStatus: (wcId: number) => ipcRenderer.invoke('merezhyvo:certs:get', { wcId }),
    continue: (wcId: number) => ipcRenderer.invoke('merezhyvo:certs:continue', { wcId }),
    onUpdate: (handler) => {
      if (typeof handler !== 'function') return noopUnsubscribe;
      const channel = 'merezhyvo:certs:update';
      type CertificateUpdatePayload = {
        wcId?: number;
        webContentsId?: number;
        info?: CertificateInfo;
      };
      const listener = (_event: IpcRendererEvent, payload: CertificateUpdatePayload | CertificateInfo) => {
        try {
          handler(payload);
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
  passwords: {
    status: () => ipcRenderer.invoke('merezhyvo:pw:status') as Promise<PasswordStatus>,
    unlock: (master: string, durationMinutes?: number) =>
      ipcRenderer.invoke('merezhyvo:pw:unlock', master, durationMinutes) as Promise<{ ok?: true; error?: string }>,
    lock: () => ipcRenderer.invoke('merezhyvo:pw:lock') as Promise<{ ok: true }>,
    changeMasterPassword: (current: string, next: string) =>
      ipcRenderer.invoke('merezhyvo:pw:change-master', { current, next }) as Promise<{ ok?: true; error?: string }>,
    createMasterPassword: (master: string) =>
      ipcRenderer.invoke('merezhyvo:pw:create-master', master) as Promise<PasswordChangeMasterResult>,
    list: (payload?: { query?: string } | string) =>
      ipcRenderer.invoke('merezhyvo:pw:list', payload) as Promise<PasswordEntryMeta[]>,
    get: (id: string) =>
      ipcRenderer.invoke('merezhyvo:pw:get', id) as Promise<PasswordEntrySecret | { error: string }>,
    add: (entry: PasswordUpsertPayload) =>
      ipcRenderer.invoke('merezhyvo:pw:add', entry) as Promise<{ id: string; updated: boolean } | { error: string }>,
    update: (id: string, entry: PasswordUpsertPayload) =>
      ipcRenderer.invoke('merezhyvo:pw:update', id, entry) as Promise<{ id: string; updated: boolean } | { error: string }>,
    remove: (id: string) =>
      ipcRenderer.invoke('merezhyvo:pw:remove', id) as Promise<{ ok: true } | { error: string }>,
    notifyFieldFocus: (payload: PasswordFieldFocusPayload) =>
      ipcRenderer.invoke('merezhyvo:pw:notify-field-focus', payload),
    notifyFieldBlur: (wcId: number) =>
      ipcRenderer.invoke('merezhyvo:pw:notify-field-blur', wcId),
    blacklist: {
      add: (origin: string) => ipcRenderer.invoke('merezhyvo:pw:blacklist:add', origin),
      remove: (origin: string) => ipcRenderer.invoke('merezhyvo:pw:blacklist:remove', origin),
      list: () => ipcRenderer.invoke('merezhyvo:pw:blacklist:list')
    },
    settings: {
      get: () => ipcRenderer.invoke('merezhyvo:pw:settings:get') as Promise<PasswordSettings>,
      set: (patch: Partial<PasswordSettings>) =>
        ipcRenderer.invoke('merezhyvo:pw:settings:set', patch) as Promise<PasswordSettings | { error: string }>
    },
    captureAction: (payload: { captureId: string; action: 'save' | 'update' | 'keep-both' | 'never'; entryId?: string }) =>
      ipcRenderer.invoke('merezhyvo:pw:capture:action', payload),
    import: {
      detect: (content?: Buffer | string | { content?: Buffer | string }) =>
        ipcRenderer.invoke('merezhyvo:pw:import:detect', content) as Promise<PasswordImportFormat>,
      csv: {
        preview: (text: string) =>
          ipcRenderer.invoke('merezhyvo:pw:import:csv:preview', text) as Promise<PasswordCsvPreview>,
        apply: (text: string, mode: PasswordImportMode) =>
          ipcRenderer.invoke('merezhyvo:pw:import:csv:apply', { text, mode }) as Promise<PasswordCsvImportResult>
      },
      mzrpass: {
        apply: (payload: { content: Buffer | string; mode: PasswordImportMode; password?: string }) =>
          ipcRenderer.invoke('merezhyvo:pw:import:mzrpass:apply', payload) as Promise<{ imported: number }>
      }
    },
    export: {
      csv: () => ipcRenderer.invoke('merezhyvo:pw:export:csv') as Promise<string>,
      mzrpass: (password?: string) =>
        ipcRenderer.invoke('merezhyvo:pw:export:mzrpass', { password }) as Promise<PasswordEncryptedExportResult>
    }
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
    ,
    downloadsSymlinkCommand: DOWNLOADS_SYMLINK_COMMAND,
    documentsSymlinkCommand: DOCUMENTS_SYMLINK_COMMAND
  },

  // Simple debug hook to write into geo.log from the renderer
  debug: {
    logGeo(_msg: string): void {
  // try { void ipcRenderer.invoke('mzr:geo:log', `renderer: ${msg}`); } catch {}
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

ipcRenderer.on('merezhyvo:pw:prompt', (_event, payload) => {
  try {
    window.dispatchEvent(new CustomEvent('merezhyvo:pw:prompt', { detail: payload }));
  } catch {
    // noop
  }
});

ipcRenderer.on('merezhyvo:pw:unlock-required', (_event, payload: unknown) => {
  try {
    window.dispatchEvent(new CustomEvent('merezhyvo:pw:unlock-required', { detail: payload }));
  } catch {
    // noop
  }
});

ipcRenderer.on('merezhyvo:downloads:state', (_event, payload: { id: string; state: 'queued' | 'downloading' | 'completed' | 'failed' }) => {
  try {
    window.dispatchEvent(new CustomEvent('merezhyvo:downloads:state', { detail: payload }));
  } catch {
    // noop
  }
});

ipcRenderer.on('merezhyvo:downloads:progress', (_event, payload: { id: string; received: number; total: number }) => {
  try {
    window.dispatchEvent(new CustomEvent('merezhyvo:downloads:progress', { detail: payload }));
  } catch {
    // noop
  }
});

ipcRenderer.on(
  'mzr-close-tab',
  (_event, payload: { webContentsId?: number; url?: string } | null | undefined) => {
    try {
      window.dispatchEvent(new CustomEvent('mzr-close-tab', { detail: payload ?? {} }));
    } catch {
      // noop
    }
  }
);

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
