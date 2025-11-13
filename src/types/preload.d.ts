import type {
  BookmarkAddPayload,
  BookmarkMovePayload,
  BookmarkUpdatePayload,
  BookmarksTree,
  HistoryQueryOptions,
  HistoryQueryResult,
  InstalledApp,
  MessengerSettings,
  OpenUrlPayload,
  SessionState,
  SettingsState,
  ShortcutIcon,
  ShortcutRequest,
  ShortcutResult,
  TopSite,
  TopSitesOptions,
  TorState,
  TorConfigResult,
  Unsubscribe,
  KeyboardSettings
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

export interface MerezhyvoTabCleanPayload {
  url: string;
  webContentsId?: number | null;
}

export interface MerezhyvoTabCleanResult {
  ok: boolean;
  error?: string;
}

export interface MerezhyvoTabsAPI {
  cleanData(payload: MerezhyvoTabCleanPayload): Promise<MerezhyvoTabCleanResult>;
}

export interface MerezhyvoHistoryApi {
  query(options?: HistoryQueryOptions): Promise<HistoryQueryResult>;
  topSites(options?: TopSitesOptions): Promise<TopSite[]>;
  remove(filter?: { url?: string; origin?: string; beforeTs?: number }): Promise<{ removed: number }>;
  clearAll(): Promise<void>;
}

export interface MerezhyvoBookmarksApi {
  list(): Promise<BookmarksTree>;
  isBookmarked(url: string): Promise<{ yes: boolean; nodeId?: string }>;
  add(payload: BookmarkAddPayload): Promise<{ ok: true; nodeId: string } | { ok: false; error: string }>;
  update(payload: BookmarkUpdatePayload): Promise<{ ok: boolean }>;
  move(payload: BookmarkMovePayload): Promise<{ ok: boolean }>;
  remove(id: string): Promise<{ ok: boolean }>;
  export(): Promise<BookmarksTree>;
  import(payload: unknown): Promise<{ ok: boolean }>;
}

export interface MerezhyvoFaviconsApi {
  getPath(faviconId: string): Promise<string | null>;
}

export type MerezhyvoSettingsState = SettingsState;

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
      update(payload: { containerId?: string; keepEnabled?: boolean }): Promise<TorConfigResult>;
      setKeepEnabled(keepEnabled: boolean): Promise<TorConfigResult>;
    };
    keyboard: {
      get(): Promise<KeyboardSettings>;
      update(patch: Partial<KeyboardSettings>): Promise<KeyboardSettings>;
    };
    messenger: {
      get(): Promise<MessengerSettings>;
      update(order: MessengerSettings['order']): Promise<MessengerSettings>;
    };
  };
  power: {
    start(): Promise<number | null>;
    stop(id?: number | null): Promise<unknown>;
    isStarted(id?: number | null): Promise<boolean>;
  };
  ua?: {
    setMode(mode: 'desktop' | 'mobile' | 'auto'): Promise<void>;
  };
  tabs?: MerezhyvoTabsAPI;
  osk: {
    char(
      wcId: number,
      text: string
    ): Promise<{ ok: boolean; error?: string }>;

    key(
      wcId: number,
      key: string,
      modifiers?: Array<'shift' | 'control' | 'alt' | 'meta'>
    ): Promise<{ ok: boolean; error?: string }>;
  };
  history: MerezhyvoHistoryApi;
  bookmarks: MerezhyvoBookmarksApi;
  permissions: {
    onPrompt(handler: (req: { id: string; origin: string; types: Array<'camera' | 'microphone' | 'geolocation' | 'notifications'> }) => void): () => void;
    decide(payload: { id: string; allow: boolean; remember: boolean; persist?: Partial<Record<'camera' | 'microphone' | 'geolocation' | 'notifications', 'allow' | 'deny'>> }): void;
    store: {
      get(): Promise<{
        schema: 1;
        defaults: Record<'camera' | 'microphone' | 'geolocation' | 'notifications', 'allow' | 'deny' | 'prompt'>;
        sites: Record<string, Partial<Record<'camera' | 'microphone' | 'geolocation' | 'notifications', 'allow' | 'deny'>>>;
      }>;
      updateSite(origin: string, patch: Partial<Record<'camera' | 'microphone' | 'geolocation' | 'notifications', 'allow' | 'deny'>>): Promise<boolean>;
      resetSite(origin: string): Promise<boolean>;
      resetAll(): Promise<boolean>;
      updateDefaults(patch: Partial<Record<'camera' | 'microphone' | 'geolocation' | 'notifications', 'allow' | 'deny' | 'prompt'>>): Promise<boolean>;
    };
  };
  history: MerezhyvoHistoryApi;
  bookmarks: MerezhyvoBookmarksApi;
  favicons: MerezhyvoFaviconsApi;
  paths: {
    webviewPreload(): string;
  };
  debug?: {
    logGeo(msg: string): void;
  };
}

declare global {
  interface Window {
    merezhyvo?: MerezhyvoAPI;
  }
}
