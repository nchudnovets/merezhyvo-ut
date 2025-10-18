type MerezhyvoUnsubscribe = () => void;

export interface MerezhyvoOpenUrlPayload {
  url: string;
  activate: boolean;
}

export interface MerezhyvoShortcutIcon {
  name: string;
  data: ArrayBuffer | Uint8Array | string;
}

export interface MerezhyvoShortcutRequest {
  title: string;
  url: string;
  single?: boolean;
  icon?: MerezhyvoShortcutIcon | null;
}

export interface MerezhyvoShortcutResult {
  ok: boolean;
  error?: string | null;
  desktopFilePath?: string;
  iconPath?: string;
  installedApp?: unknown;
}

export interface MerezhyvoTorState {
  enabled: boolean;
  starting?: boolean;
  reason?: string | null;
}

export interface MerezhyvoSessionState {
  schema: number;
  activeId?: string;
  tabs?: unknown[];
}

export interface MerezhyvoInstalledApp {
  id: string;
  title: string;
  url: string;
  desktopFilePath?: string;
  iconPath?: string;
  single?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface MerezhyvoInstalledAppsResult {
  ok: boolean;
  error?: string;
  installedApps: MerezhyvoInstalledApp[];
}

export interface MerezhyvoSettingsState {
  schema: number;
  installedApps: MerezhyvoInstalledApp[];
}

export interface MerezhyvoAPI {
  onMode(handler: (mode: 'desktop' | 'mobile') => void): MerezhyvoUnsubscribe;
  notifyTabsReady(): void;
  onOpenUrl(
    handler: (payload: MerezhyvoOpenUrlPayload) => void
  ): MerezhyvoUnsubscribe;
  createShortcut(payload: MerezhyvoShortcutRequest): Promise<MerezhyvoShortcutResult>;
  tor: {
    toggle(): Promise<MerezhyvoTorState>;
    getState(): Promise<MerezhyvoTorState>;
    onState(handler: (enabled: boolean, reason: string | null) => void): MerezhyvoUnsubscribe;
  };
  openContextMenuAt(x: number, y: number, dpr?: number): void;
  session: {
    load(): Promise<MerezhyvoSessionState | null>;
    save(data: MerezhyvoSessionState): Promise<{ ok: boolean; error?: string } | null>;
  };
  settings: {
    load(): Promise<MerezhyvoSettingsState>;
    installedApps: {
      list(): Promise<MerezhyvoInstalledAppsResult>;
      remove(
        idOrPayload: string | { id: string } | { desktopFilePath: string }
      ): Promise<{ ok: boolean; error?: string }>;
    };
  };
  power: {
    start(): Promise<number | null>;
    stop(id?: number | null): Promise<unknown>;
    isStarted(id?: number | null): Promise<boolean>;
  };
}

declare global {
  interface Window {
    merezhyvo?: MerezhyvoAPI;
  }
}

export {};
