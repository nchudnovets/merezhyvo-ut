import type {
  InstalledApp,
  Mode,
  OpenUrlPayload,
  SettingsState,
  ShortcutRequest,
  ShortcutResult,
  TorState,
  TorConfigResult,
  Unsubscribe,
  MessengerSettings
} from '../../types/models';
import { sanitizeMessengerSettings } from '../../shared/messengers';

type InstalledAppsResponse = {
  ok: boolean;
  error?: string;
  installedApps: InstalledApp[];
};

type RemoveInstalledAppResponse =
  | { ok: false; error?: string }
  | { ok: true; removed?: InstalledApp; installedApps?: InstalledApp[] };

type SaveTorConfigResponse = TorConfigResult;

type Bridge = NonNullable<Window['merezhyvo']>;

export type PermissionType = 'camera' | 'microphone' | 'geolocation' | 'notifications';

const getApi = (): Bridge | undefined => {
  if (typeof window === 'undefined') return undefined;
  return window.merezhyvo ?? undefined;
};

export const ipc = {
  onMode(handler: (mode: Mode) => void): Unsubscribe {
    const api = getApi();
    if (!api?.onMode) return () => {};
    try {
      return api.onMode(handler) as Unsubscribe;
    } catch {
      return () => {};
    }
  },

  notifyTabsReady(): void {
    try {
      getApi()?.notifyTabsReady?.();
    } catch {}
  },

  onOpenUrl(handler: (payload: OpenUrlPayload) => void): Unsubscribe {
    const api = getApi();
    if (!api?.onOpenUrl) return () => {};
    try {
      return api.onOpenUrl(handler) as Unsubscribe;
    } catch {
      return () => {};
    }
  },

  async createShortcut(payload: ShortcutRequest): Promise<ShortcutResult> {
    try {
      const res = await getApi()?.createShortcut?.(payload);
      return res ?? { ok: false, error: 'Shortcut creation failed.' };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  settings: {
    async loadState(): Promise<SettingsState | null> {
      try {
        const res = await getApi()?.settings?.load?.();
        return (res ?? null) as SettingsState | null;
      } catch {
        return null;
      }
    },
    async loadInstalledApps(): Promise<InstalledAppsResponse> {
      try {
        const res = await getApi()?.settings?.installedApps?.list?.();
        if (res && typeof res === 'object') {
          return res as InstalledAppsResponse;
        }
      } catch (err) {
        return { ok: false, error: String(err), installedApps: [] };
      }
      return { ok: false, error: 'Unknown error', installedApps: [] };
    },

    async removeInstalledApp(
      idOrPayload: string | { id: string } | { desktopFilePath: string }
    ): Promise<RemoveInstalledAppResponse> {
      try {
        const res = await getApi()?.settings?.installedApps?.remove?.(idOrPayload);
        if (res && typeof res === 'object') {
          return res as RemoveInstalledAppResponse;
        }
      } catch (err) {
        return { ok: false, error: String(err) };
      }
      return { ok: false, error: 'Unknown error' };
    },
    async saveTorConfig(payload: { containerId: string; keepEnabled: boolean }): Promise<SaveTorConfigResponse> {
      try {
        const res = await getApi()?.settings?.tor?.update?.(payload);
        if (res && typeof res === 'object') {
          return res as SaveTorConfigResponse;
        }
      } catch (err) {
        return { ok: false, error: String(err) };
      }
      return { ok: false, error: 'Unknown error' };
    },
    keyboard: {
      async get(): Promise<{ enabledLayouts: string[]; defaultLayout: string }> {
        try {
          const res = await getApi()?.settings?.keyboard?.get?.();
          if (res && typeof res === 'object') {
            return res as { enabledLayouts: string[]; defaultLayout: string };
          }
        } catch (e) {
          console.error('settings.keyboard.get failed', e);
        }
        // Safe fallback (UI все одно нормалізує значення):
        return { enabledLayouts: ['en'], defaultLayout: 'en' };
      },

      async update(payload: any) {
        try {
          return await getApi()?.settings?.keyboard?.update?.(payload);
        } catch (e) {
          console.error('settings.keyboard.update failed', e);
          return null;
        }
      }
    },
    messenger: {
      async get(): Promise<MessengerSettings> {
        try {
          const res = await getApi()?.settings?.messenger?.get?.();
          return sanitizeMessengerSettings(res);
        } catch (err) {
          console.error('settings.messenger.get failed', err);
          return sanitizeMessengerSettings(null);
        }
      },
      async update(order: MessengerSettings['order']): Promise<MessengerSettings> {
        try {
          const res = await getApi()?.settings?.messenger?.update?.(order ?? []);
          return sanitizeMessengerSettings(res);
        } catch (err) {
          console.error('settings.messenger.update failed', err);
          return sanitizeMessengerSettings({ order });
        }
      }
    },
  },

  power: {
    async start(): Promise<number | null> {
      try {
        const res = await getApi()?.power?.start?.();
        return typeof res === 'number' ? res : null;
      } catch {
        return null;
      }
    },
    async stop(id?: number | null): Promise<void> {
      try {
        await getApi()?.power?.stop?.(id ?? null);
      } catch {}
    }
  },

  tor: {
    async toggle(options?: { containerId?: string | null }): Promise<TorState | null> {
      try {
        const res = await getApi()?.tor?.toggle?.(options);
        return res ?? null;
      } catch {
        return null;
      }
    },
    async getState(): Promise<TorState | null> {
      try {
        const res = await getApi()?.tor?.getState?.();
        return res ?? null;
      } catch {
        return null;
      }
    },
    onState(handler: (enabled: boolean, reason: string | null) => void): Unsubscribe {
      const api = getApi();
      if (!api?.tor?.onState) return () => {};
      try {
        return api.tor.onState(handler) as Unsubscribe;
      } catch {
        return () => {};
      }
    }
  },

  tabs: {
    async cleanData(input: { url: string; webContentsId?: number }): Promise<{ ok: boolean; error?: string }> {
      const url = typeof input?.url === 'string' ? input.url.trim() : '';
      if (!url) {
        return { ok: false, error: 'URL is required.' };
      }
      const webContentsId = typeof input?.webContentsId === 'number' ? input.webContentsId : undefined;
      try {
        const api = getApi();
        const result = await api?.tabs?.cleanData?.({ url, webContentsId });
        if (result && typeof result === 'object') {
          const { ok = false, error } = result as { ok?: boolean; error?: unknown };
          return {
            ok: Boolean(ok),
            error: typeof error === 'string' ? error : undefined
          };
        }
      } catch (err) {
        return { ok: false, error: String(err) };
      }
      return { ok: false, error: 'Operation not supported.' };
    }
  },

  openContextMenuAt(x: number, y: number, dpr?: number): void {
    try {
      getApi()?.openContextMenuAt?.(x, y, dpr ?? window.devicePixelRatio ?? 1);
    } catch {}
  },

  ua: {
    async setMode(mode: 'desktop' | 'mobile' | 'auto'): Promise<void> {
      try {
        await getApi()?.ua?.setMode?.(mode);
      } catch (err) {
        console.error('ua.setMode failed', err);
      }
    }
  },

  osk: {
    char(wcId: number, text: string) {
      return window.merezhyvo?.osk.char(wcId, text);
    },
    key(
      wcId: number,
      key: string,
      modifiers?: Array<'shift' | 'control' | 'alt' | 'meta'>
    ) {
      return window.merezhyvo?.osk.key(wcId, key, modifiers);
    },
  },
  permissions: {
    onPrompt(handler: (req: { id: string; origin: string; types: PermissionType[] }) => void): () => void {
      if (window.merezhyvo && window.merezhyvo.permissions) {
        return window.merezhyvo.permissions.onPrompt(handler);
      }
      // No-op unsubscribe when bridge is unavailable (e.g., tests/SSR)
      return () => {};
    },
    decide(payload: { id: string; allow: boolean; remember: boolean; persist?: Partial<Record<PermissionType, 'allow' | 'deny'>> }): void {
      window.merezhyvo?.permissions.decide(payload);
    },
    store: {
      get: () => window.merezhyvo?.permissions.store.get(),
      updateSite: (origin: string, patch: Partial<Record<PermissionType, 'allow' | 'deny'>>) =>
        window.merezhyvo?.permissions.store.updateSite(origin, patch),
      resetSite: (origin: string) => window.merezhyvo?.permissions.store.resetSite(origin),
      resetAll: () => window.merezhyvo?.permissions.store.resetAll()
    }
  }
};
