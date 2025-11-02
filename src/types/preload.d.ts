import type {
  InstalledApp,
  OpenUrlPayload,
  SessionState,
  SettingsState,
  ShortcutIcon,
  ShortcutRequest,
  ShortcutResult,
  TorState,
  TorConfigResult,
  Unsubscribe
} from './models';

type MerezhyvoUnsubscribe = Unsubscribe;

export type MerezhyvoOpenUrlPayload = OpenUrlPayload;

export type MerezhyvoShortcutIcon = ShortcutIcon;

export type MerezhyvoShortcutRequest = ShortcutRequest;

export type MerezhyvoShortcutResult = ShortcutResult;

export type MerezhyvoTorState = TorState;

export type MerezhyvoSessionState = SessionState;

export interface MerezhyvoTorToggleOptions {
  containerId?: string | null;
}

export interface MerezhyvoAppInfo {
  name: string;
  version: string;
  description?: string;
  chromium?: string;
  electron?: string;
  node?: string;
}

export interface MerezhyvoInstalledAppsResult {
  ok: boolean;
  error?: string;
  installedApps: InstalledApp[];
}

export interface MerezhyvoSettingsState extends SettingsState {
  keyboard?: KeyboardSettings;
}

export interface MerezhyvoAPI {
  appInfo?: MerezhyvoAppInfo;
  onMode(handler: (mode: 'desktop' | 'mobile') => void): MerezhyvoUnsubscribe;
  notifyTabsReady(): void;
  onOpenUrl(
    handler: (payload: MerezhyvoOpenUrlPayload) => void
  ): MerezhyvoUnsubscribe;
  createShortcut(payload: MerezhyvoShortcutRequest): Promise<MerezhyvoShortcutResult>;
  tor: {
    toggle(options?: MerezhyvoTorToggleOptions): Promise<MerezhyvoTorState>;
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
    tor: {
      update(payload: { containerId?: string }): Promise<TorConfigResult>;
    };
    keyboard: {
      get(): Promise<KeyboardSettings>;
      update(patch: Partial<KeyboardSettings>): Promise<KeyboardSettings>;
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
