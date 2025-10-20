import type {
  InstalledApp,
  Mode,
  OpenUrlPayload,
  ShortcutRequest,
  ShortcutResult,
  TorState,
  Unsubscribe
} from '../../types/models';

type InstalledAppsResponse = {
  ok: boolean;
  error?: string;
  installedApps: InstalledApp[];
};

type RemoveInstalledAppResponse = {
  ok: boolean;
  error?: string;
};

type Bridge = NonNullable<Window['merezhyvo']>;

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
    }
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

  openContextMenuAt(x: number, y: number, dpr?: number): void {
    try {
      getApi()?.openContextMenuAt?.(x, y, dpr ?? window.devicePixelRatio ?? 1);
    } catch {}
  }
};
