import type {
  Mode,
  OpenUrlPayload,
  SettingsState,
  TorState,
  TorConfigResult,
  TorClearResult,
  TorIpResult,
  Unsubscribe,
  MessengerSettings,
  KeyboardSettings,
  HttpsMode,
  SslException,
  WebrtcMode
} from '../../types/models';
import { sanitizeMessengerSettings } from '../../shared/messengers';
import { DEFAULT_LOCALE } from '../../i18n/locales';
import type { MerezhyvoUISettings } from '../../types/preload';
import type { SecureDnsSettings, SavingsSettings, NetworkSettings, StartPageSettings } from '../../types/models';
import { DEFAULT_SAVINGS_SETTINGS } from '../../utils/savings';

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

  settings: {
    async loadState(): Promise<SettingsState | null> {
      try {
        const res = await getApi()?.settings?.load?.();
        return (res ?? null) as SettingsState | null;
      } catch {
        return null;
      }
    },
    async setTorKeepEnabled(keepEnabled: boolean): Promise<TorConfigResult> {
      try {
        const res = await getApi()?.settings?.tor?.setKeepEnabled?.(keepEnabled);
        if (res && typeof res === 'object') {
          return res as TorConfigResult;
        }
      } catch (err) {
        return { ok: false, error: String(err) };
      }
      return { ok: false, error: 'Unknown error' };
    },
    secureDns: {
      async get(): Promise<SecureDnsSettings> {
        try {
          const res = await getApi()?.settings?.secureDns?.get?.();
          return (res ?? null) as SecureDnsSettings;
        } catch (err) {
          console.error('settings.secureDns.get failed', err);
          return { enabled: false, mode: 'automatic', provider: 'auto', nextdnsId: '', customUrl: '' };
        }
      },
      async update(payload: Partial<SecureDnsSettings>): Promise<{ ok: boolean; settings?: SecureDnsSettings; error?: string }> {
        try {
          const res = await getApi()?.settings?.secureDns?.update?.(payload ?? {});
          if (res && typeof res === 'object') {
            return res as { ok: boolean; settings?: SecureDnsSettings; error?: string };
          }
        } catch (err) {
          console.error('settings.secureDns.update failed', err);
          return { ok: false, error: String(err) };
        }
        return { ok: false, error: 'Unknown error' };
      }
    },
    network: {
      async updateDetected(payload: { detectedIp?: string | null; detectedCountry?: string | null; detectedAt?: string | null }): Promise<NetworkSettings | null> {
        try {
          const res = await getApi()?.settings?.network?.updateDetected?.(payload ?? {});
          return (res ?? null) as NetworkSettings | null;
        } catch (err) {
          console.error('settings.network.updateDetected failed', err);
          return null;
        }
      }
    },
    savings: {
      async get(): Promise<SavingsSettings> {
        try {
          const res = await getApi()?.settings?.savings?.get?.();
          return (res ?? DEFAULT_SAVINGS_SETTINGS) as SavingsSettings;
        } catch (err) {
          console.error('settings.savings.get failed', err);
          return DEFAULT_SAVINGS_SETTINGS;
        }
      },
      async update(payload: Partial<SavingsSettings>): Promise<SavingsSettings> {
        try {
          const res = await getApi()?.settings?.savings?.update?.(payload ?? {});
          return (res ?? payload ?? DEFAULT_SAVINGS_SETTINGS) as SavingsSettings;
        } catch (err) {
          console.error('settings.savings.update failed', err);
          return payload ? { ...DEFAULT_SAVINGS_SETTINGS, ...payload } : DEFAULT_SAVINGS_SETTINGS;
        }
      }
    },
    startPage: {
      async get(): Promise<StartPageSettings> {
        try {
          const res = await getApi()?.settings?.startPage?.get?.();
          return (res ?? null) as StartPageSettings;
        } catch (err) {
          console.error('settings.startPage.get failed', err);
          return { showTopSites: true, showFavorites: true, hidePanels: false, showCouponStores: true, favorites: [] };
        }
      },
      async update(payload: Partial<StartPageSettings>): Promise<StartPageSettings> {
        try {
          const res = await getApi()?.settings?.startPage?.update?.(payload ?? {});
          return (res ?? payload) as StartPageSettings;
        } catch (err) {
          console.error('settings.startPage.update failed', err);
          return { showTopSites: true, showFavorites: true, hidePanels: false, showCouponStores: true, favorites: [] };
        }
      }
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
        return { enabledLayouts: ['en'], defaultLayout: 'en' };
      },

      async update(payload: Partial<KeyboardSettings>) {
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
      async update(payload: Partial<MessengerSettings>): Promise<MessengerSettings> {
        try {
          const res = await getApi()?.settings?.messenger?.update?.(payload ?? {});
          return sanitizeMessengerSettings(res);
        } catch (err) {
          console.error('settings.messenger.update failed', err);
          return sanitizeMessengerSettings(payload);
        }
      }
    },
    https: {
      async get(): Promise<{ httpsMode: HttpsMode; sslExceptions: SslException[] }> {
        try {
          const res = await getApi()?.settings?.https?.get?.();
          if (res && typeof res === 'object') {
            const mode = (res as { httpsMode?: unknown }).httpsMode === 'preferred' ? 'preferred' : 'strict';
            const exceptions = Array.isArray((res as { sslExceptions?: unknown }).sslExceptions)
              ? ((res as { sslExceptions: unknown }).sslExceptions as SslException[])
              : [];
            return { httpsMode: mode, sslExceptions: exceptions };
          }
        } catch (err) {
          console.error('settings.https.get failed', err);
        }
        return { httpsMode: 'strict', sslExceptions: [] };
      },
      async setMode(mode: HttpsMode): Promise<{ ok?: boolean; httpsMode?: HttpsMode; error?: string }> {
        try {
          const res = await getApi()?.settings?.https?.setMode?.(mode);
          if (res && typeof res === 'object') {
            return res as { ok?: boolean; httpsMode?: HttpsMode; error?: string };
          }
        } catch (err) {
          console.error('settings.https.setMode failed', err);
          return { ok: false, error: String(err) };
        }
        return { ok: false, error: 'Operation not supported.' };
      },
      async addException(payload: { host: string; errorType: string }) {
        try {
          const res = await getApi()?.settings?.https?.addException?.(payload);
          if (res && typeof res === 'object') {
            return res as { ok?: boolean; sslExceptions?: SslException[]; error?: string };
          }
        } catch (err) {
          console.error('settings.https.addException failed', err);
          return { ok: false, error: String(err) };
        }
        return { ok: false, error: 'Operation not supported.' };
      },
      async removeException(payload: { host: string; errorType: string }) {
        try {
          const res = await getApi()?.settings?.https?.removeException?.(payload);
          if (res && typeof res === 'object') {
            return res as { ok?: boolean; sslExceptions?: SslException[]; error?: string };
          }
        } catch (err) {
          console.error('settings.https.removeException failed', err);
          return { ok: false, error: String(err) };
        }
        return { ok: false, error: 'Operation not supported.' };
      }
    },
    webrtc: {
      async get(): Promise<{ mode: WebrtcMode }> {
        try {
          const res = await getApi()?.settings?.webrtc?.get?.();
          if (res && typeof res === 'object') {
            const mode = (res as { mode?: unknown }).mode === 'always_off' || (res as { mode?: unknown }).mode === 'off_with_tor'
              ? (res as { mode: WebrtcMode }).mode
              : 'always_on';
            return { mode };
          }
        } catch (err) {
          console.error('settings.webrtc.get failed', err);
        }
        return { mode: 'always_on' };
      },
      async setMode(mode: WebrtcMode): Promise<{ ok?: boolean; mode?: WebrtcMode; error?: string }> {
        try {
          const res = await getApi()?.settings?.webrtc?.setMode?.(mode);
          if (res && typeof res === 'object') {
            return res as { ok?: boolean; mode?: WebrtcMode; error?: string };
          }
        } catch (err) {
          console.error('settings.webrtc.setMode failed', err);
          return { ok: false, error: String(err) };
        }
        return { ok: false, error: 'Operation not supported.' };
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

  ui: {
    async get(): Promise<MerezhyvoUISettings> {
      try {
        const res = await getApi()?.ui?.get?.();
        if (res) return res;
      } catch {}
      return { scale: 1, hideFileDialogNote: false, language: DEFAULT_LOCALE, webZoomMobile: 2.3, webZoomDesktop: 1.0 };
    },
    async update(patch: Partial<MerezhyvoUISettings>) {
      try {
        const res = await getApi()?.ui?.set?.(patch);
        if (res && typeof res === 'object') {
          return res;
        }
      } catch (err) {
        console.error('ui.set failed', err);
      }
      return { ok: false, error: 'Unknown error' };
    },
    async getLanguage(): Promise<string> {
      try {
        const res = await getApi()?.ui?.getLanguage?.();
        if (typeof res === 'string' && res.trim().length) return res;
      } catch {}
      return DEFAULT_LOCALE;
    },
    async setLanguage(language: string) {
      try {
        const res = await getApi()?.ui?.setLanguage?.(language);
        if (res && typeof res === 'object') return res;
      } catch (err) {
        console.error('ui.setLanguage failed', err);
      }
      return { ok: false, error: 'Unknown error' };
    }
  },
  tor: {
    async toggle(): Promise<TorState | null> {
      try {
        const res = await getApi()?.tor?.toggle?.();
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
    async clearSession(): Promise<TorClearResult> {
      try {
        const res = await getApi()?.tor?.clearSession?.();
        if (res && typeof res === 'object') {
          return res as TorClearResult;
        }
      } catch {
        // ignore
      }
      return { ok: false, error: 'Tor session clear failed.' };
    },
    async getIp(): Promise<TorIpResult> {
      try {
        const res = await getApi()?.tor?.getIp?.();
        if (res && typeof res === 'object') {
          return res as TorIpResult;
        }
      } catch {
        // ignore
      }
      return { ok: false, error: 'Tor IP lookup failed.' };
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
      resetAll: () => window.merezhyvo?.permissions.store.resetAll(),
      updateDefaults: (
        patch: Partial<Record<PermissionType, 'allow' | 'deny' | 'prompt'>>
      ) => window.merezhyvo?.permissions.store.updateDefaults(patch),
    }
  }
};
