import type {
  BookmarkAddPayload,
  BookmarkHtmlExportPayload,
  BookmarkHtmlExportResult,
  BookmarkHtmlImportPayload,
  BookmarkHtmlImportPreviewPayload,
  BookmarkHtmlImportPreviewResult,
  BookmarkMovePayload,
  BookmarkUpdatePayload,
  BookmarksTree,
  FileDialogListing,
  FileDialogOptions,
  FileDialogSavePayload,
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
  KeyboardSettings,
  PasswordEntryMeta,
  PasswordEntrySecret,
  PasswordSettings,
  PasswordUpsertPayload,
  PasswordCsvPreview,
  PasswordCsvImportResult,
  PasswordEncryptedExportResult,
  PasswordChangeMasterResult,
  PasswordImportMode,
  PasswordImportFormat,
  PasswordAutofillState,
  PasswordCaptureAction,
  PasswordCaptureActionResult,
  PasswordStatus
} from './models';

export interface PasswordFieldFocusPayload {
  wcId: number;
  origin: string;
  signonRealm: string;
  field: 'username' | 'password';
}

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
  importHtml: {
    preview(payload: BookmarkHtmlImportPreviewPayload): Promise<BookmarkHtmlImportPreviewResult>;
    apply(payload: BookmarkHtmlImportPayload): Promise<BookmarkHtmlImportResult>;
  };
  exportHtml(payload: BookmarkHtmlExportPayload): Promise<BookmarkHtmlExportResult>;
}

export interface MerezhyvoPasswordsApi {
  status(): Promise<PasswordStatus>;
  unlock(master: string, durationMinutes?: number): Promise<{ ok?: true; error?: string }>;
  lock(): Promise<{ ok: true }>;
  changeMasterPassword(current: string, next: string): Promise<PasswordChangeMasterResult>;
  createMasterPassword(master: string): Promise<PasswordChangeMasterResult>;
  list(payload?: { query?: string } | string): Promise<PasswordEntryMeta[]>;
  get(id: string): Promise<PasswordEntrySecret | { error: string }>;
  add(entry: PasswordUpsertPayload): Promise<{ id: string; updated: boolean } | { error: string }>;
  update(id: string, entry: PasswordUpsertPayload): Promise<{ id: string; updated: boolean } | { error: string }>;
  remove(id: string): Promise<{ ok: true } | { error: string }>;
  notifyFieldFocus(payload: PasswordFieldFocusPayload): Promise<void>;
  notifyFieldBlur(wcId: number): Promise<void>;
  blacklist: {
    add(origin: string): Promise<{ ok: true } | { error: string }>;
    remove(origin: string): Promise<{ ok: true } | { error: string }>;
    list(): Promise<string[]>;
  };
  settings: {
    get(): Promise<PasswordSettings>;
    set(patch: Partial<PasswordSettings>): Promise<PasswordSettings | { error: string }>;
  };
  import: {
    detect(content?: Buffer | string | { content?: Buffer | string }): Promise<PasswordImportFormat>;
    csv: {
      preview(text: string): Promise<PasswordCsvPreview>;
      apply(text: string, mode: PasswordImportMode): Promise<PasswordCsvImportResult>;
    };
    mzrpass: {
      apply(payload: { content: Buffer | string; mode: PasswordImportMode; password?: string }): Promise<{ imported: number }>;
    };
  };
  export: {
    csv(): Promise<string>;
    mzrpass(password?: string): Promise<PasswordEncryptedExportResult>;
  };
  captureAction(payload: { captureId: string; action: PasswordCaptureAction; entryId?: string }): Promise<PasswordCaptureActionResult>;
}

export interface FileDialogRequestPayload {
  requestId: string;
  options: FileDialogOptions;
}

export interface FileDialogResponsePayload {
  requestId: string;
  paths: string[] | null;
}

export interface MerezhyvoFileDialogApi {
  list(payload?: { path?: string; filters?: string[] }): Promise<FileDialogListing>;
  readFile(payload: { path: string }): Promise<string>;
  onRequest(handler: (payload: FileDialogRequestPayload) => void): () => void;
  respond(payload: FileDialogResponsePayload): Promise<{ ok: boolean }>;
  saveFile(payload: FileDialogSavePayload): Promise<{ ok: boolean }>;
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
  fileDialog: MerezhyvoFileDialogApi;
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
  passwords: MerezhyvoPasswordsApi;
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
