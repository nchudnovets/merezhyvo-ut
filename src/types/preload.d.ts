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
  MessengerSettings,
  OpenUrlPayload,
  SessionState,
  SettingsState,
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
  PasswordCaptureAction,
  PasswordCaptureActionResult,
  PasswordStatus,
  DownloadsSettings,
  SavingsSettings,
  CertificateInfo,
  HttpsMode,
  SslException,
  WebrtcMode,
  TrackerPrivacySettings,
  TrackerStatus,
  CookieBlockStatus,
  AdsPrivacySettings,
  NetworkSettings,
  StartPageSettings,
  SecureDnsSettings
} from './models';

export interface ContextMenuState {
  canBack: boolean;
  canForward: boolean;
  hasSelection: boolean;
  isEditable: boolean;
  canPaste: boolean;
  linkUrl: string;
  mediaType?: string;
  mediaSrc?: string;
  pageUrl?: string;
  autofill?: {
    available: boolean;
    locked: boolean;
    options: Array<{ id: string; username: string; siteName: string }>;
    siteName: string;
  };
}

export interface PasswordFieldFocusPayload {
  wcId: number;
  origin: string;
  signonRealm: string;
  field: 'username' | 'password';
}

type MerezhyvoUnsubscribe = Unsubscribe;

export type MerezhyvoOpenUrlPayload = OpenUrlPayload;

export type MerezhyvoTorState = TorState;

export type MerezhyvoSessionState = SessionState;

export interface MerezhyvoUISettings {
  scale: number;
  hideFileDialogNote: boolean;
  language: string;
  theme?: 'dark' | 'light';
  webZoomMobile?: number;
  webZoomDesktop?: number;
  releasePopupVersion?: string | null;
}

export interface MerezhyvoAppInfo {
  name: string;
  version: string;
  description?: string;
  chromium?: string;
  electron?: string;
  node?: string;
  torVersion?: string | null;
}

export interface MerezhyvoAboutInfo {
  appVersion: string;
  chromiumVersion: string;
  torVersion: string | null;
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
  query?(
    options?: { q?: string; limit?: number; includeDeleted?: boolean }
  ): Promise<{ items?: { url?: string; title?: string | null; createdAt?: number; updatedAt?: number }[] }>;
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

export interface MerezhyvoCertificatesApi {
  getStatus(wcId: number): Promise<CertificateInfo>;
  continue(wcId: number): Promise<{ ok: boolean; error?: string }>;
  onUpdate(
    handler: (payload: { wcId?: number; webContentsId?: number; info?: CertificateInfo } | CertificateInfo) => void
  ): MerezhyvoUnsubscribe;
}

export interface MerezhyvoFileDialogApi {
  list(payload?: { path?: string; filters?: string[] }): Promise<FileDialogListing>;
  readFile(payload: { path: string }): Promise<string>;
  readBinary(payload: { path: string }): Promise<{ data: string }>;
  onRequest(handler: (payload: FileDialogRequestPayload) => void): () => void;
  respond(payload: FileDialogResponsePayload): Promise<{ ok: boolean }>;
  saveFile(payload: FileDialogSavePayload): Promise<{ ok: boolean }>;
}

export interface MerezhyvoFaviconsApi {
  getPath(faviconId: string): Promise<string | null>;
}

export interface MerezhyvoJsDialogApi {
  attach(webContentsId: number): void;
  onOpen(
    handler: (payload: {
      requestId?: string;
      webContentsId?: number;
      type?: 'alert' | 'confirm' | 'beforeunload';
      message?: string;
    }) => void
  ): Unsubscribe;
  respond(payload: { requestId: string; webContentsId: number; accept?: boolean; promptText?: string | null }): void;
}

export type MerezhyvoSettingsState = SettingsState;

export type CookiePrivacyState = {
  blockThirdParty: boolean;
  exceptions: { thirdPartyAllow: Record<string, boolean> };
};

export interface MerezhyvoAPI {
  appInfo?: MerezhyvoAppInfo;
  about: {
    getInfo(): Promise<MerezhyvoAboutInfo>;
  };
  onMode(handler: (mode: 'desktop' | 'mobile') => void): MerezhyvoUnsubscribe;
  notifyTabsReady(): void;
  onOpenUrl(
    handler: (payload: MerezhyvoOpenUrlPayload) => void
  ): MerezhyvoUnsubscribe;
  tor: {
    toggle(): Promise<MerezhyvoTorState>;
    getState(): Promise<MerezhyvoTorState>;
    clearSession(): Promise<{ ok: boolean; error?: string }>;
    getIp(): Promise<{ ok: boolean; ip?: string; error?: string }>;
    onState(handler: (enabled: boolean, reason: string | null) => void): MerezhyvoUnsubscribe;
  };
  openContextMenuAt(x: number, y: number, dpr?: number, webContentsId?: number): void;
  contextMenu: {
    onShow(handler: (payload: unknown) => void): MerezhyvoUnsubscribe;
    onHide(handler: () => void): MerezhyvoUnsubscribe;
    getState(): Promise<ContextMenuState | null | unknown>;
    click(id: string): void;
    close(): void;
  };
  clipboard: {
    readText(): Promise<string>;
  };
  session: {
    load(): Promise<MerezhyvoSessionState | null>;
    save(data: MerezhyvoSessionState): Promise<{ ok: boolean; error?: string } | null>;
  };
  settings: {
    load(): Promise<MerezhyvoSettingsState>;
    cookies: {
      get(): Promise<CookiePrivacyState>;
      setBlock(blockThirdParty: boolean): Promise<CookiePrivacyState>;
      setException(host: string, allow: boolean): Promise<CookiePrivacyState>;
      listExceptions(): Promise<Record<string, boolean>>;
      clearExceptions(): Promise<CookiePrivacyState>;
    };
    trackers: {
      get(): Promise<TrackerPrivacySettings>;
      setEnabled(enabled: boolean): Promise<TrackerPrivacySettings>;
      addException(host: string): Promise<TrackerPrivacySettings>;
      removeException(host: string): Promise<TrackerPrivacySettings>;
      clearExceptions(): Promise<TrackerPrivacySettings>;
    };
    ads: {
      get(): Promise<AdsPrivacySettings>;
      setEnabled(enabled: boolean): Promise<AdsPrivacySettings>;
      addException(host: string): Promise<AdsPrivacySettings>;
      removeException(host: string): Promise<AdsPrivacySettings>;
      clearExceptions(): Promise<AdsPrivacySettings>;
    };
    tor: {
      setKeepEnabled(keepEnabled: boolean): Promise<TorConfigResult>;
    };
    secureDns: {
      get(): Promise<SecureDnsSettings>;
      update(payload: Partial<SecureDnsSettings>): Promise<{ ok: boolean; settings?: SecureDnsSettings; error?: string }>;
    };
    network: {
      updateDetected(payload: { detectedIp?: string | null; detectedCountry?: string | null; detectedAt?: string | null }): Promise<NetworkSettings>;
    };
    savings: {
      get(): Promise<SavingsSettings>;
      update(payload: Partial<SavingsSettings>): Promise<SavingsSettings>;
    };
    startPage: {
      get(): Promise<StartPageSettings>;
      update(payload: Partial<StartPageSettings>): Promise<StartPageSettings>;
    };
    keyboard: {
      get(): Promise<KeyboardSettings>;
      update(patch: Partial<KeyboardSettings>): Promise<KeyboardSettings>;
    };
    messenger: {
      get(): Promise<MessengerSettings>;
      update(payload: Partial<MessengerSettings>): Promise<MessengerSettings>;
    };
    https: {
      get(): Promise<{ httpsMode: HttpsMode; sslExceptions: SslException[] }>;
      setMode(mode: HttpsMode): Promise<{ ok?: boolean; httpsMode?: HttpsMode; error?: string }>;
      addException(payload: { host: string; errorType: string }): Promise<{ ok?: boolean; sslExceptions?: SslException[]; error?: string }>;
      removeException(payload: { host: string; errorType: string }): Promise<{ ok?: boolean; sslExceptions?: SslException[]; error?: string }>;
    };
    webrtc: {
      get(): Promise<{ mode: WebrtcMode }>;
      setMode(mode: WebrtcMode): Promise<{ ok?: boolean; mode?: WebrtcMode; error?: string }>;
    };
    siteData: {
      list(): Promise<{ host: string; hasCookies: boolean; hasSiteStorage: boolean; hasHistory: boolean }[]>;
      clearCookiesForSite(host: string): Promise<{ ok?: boolean; error?: string }>;
      clearStorageForSite(host: string): Promise<{ ok?: boolean; error?: string }>;
      clearHistoryForSite(host: string): Promise<{ ok?: boolean; error?: string }>;
      clearGlobal(opts: { cookiesAndSiteData?: boolean; cache?: boolean; history?: boolean }): Promise<{ ok?: boolean; error?: string }>;
    };
  };
  ui: {
    get(): Promise<MerezhyvoUISettings>;
    set(
      payload: Partial<MerezhyvoUISettings>
    ): Promise<
      | { ok: true; scale: number; hideFileDialogNote: boolean; language: string }
      | { ok: false; error: string }
    >;
    getLanguage(): Promise<string>;
    setLanguage(language: string): Promise<{ ok: true; language: string } | { ok: false; error: string }>;
  };
  downloads: {
    settings: {
      get(): Promise<DownloadsSettings>;
      set(payload: Partial<DownloadsSettings>): Promise<DownloadsSettings>;
    };
  };
  cookies: {
    getStatus(payload: { webContentsId?: number | null }): Promise<CookieBlockStatus>;
    onStats(handler: (payload: CookieBlockStatus) => void): MerezhyvoUnsubscribe;
  };
  trackers?: {
    getStatus(payload: { webContentsId?: number | null }): Promise<TrackerStatus>;
    setBlockingMode(mode: 'basic' | 'strict'): Promise<TrackerStatus>;
    setEnabled(enabled: boolean): Promise<TrackerPrivacySettings>;
    setAdsEnabled(enabled: boolean): Promise<AdsPrivacySettings>;
    setSiteAllowed(payload: { siteHost: string; allowed: boolean; webContentsId?: number | null }): Promise<TrackerStatus>;
    setAdsAllowed(payload: { siteHost: string; allowed: boolean; webContentsId?: number | null }): Promise<TrackerStatus>;
    clearExceptions(): Promise<TrackerPrivacySettings>;
    clearAdsExceptions(): Promise<AdsPrivacySettings>;
    onStats(handler: (payload: TrackerStatus) => void): MerezhyvoUnsubscribe;
  };
  power: {
    start(): Promise<number | null>;
    stop(id?: number | null): Promise<unknown>;
    isStarted(id?: number | null): Promise<boolean>;
  };
  ua?: {
    setMode(mode: 'desktop' | 'mobile' | 'auto'): Promise<void>;
  };
  jsDialog?: MerezhyvoJsDialogApi;
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
  certificates: MerezhyvoCertificatesApi;
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
    downloadsSymlinkCommand: string;
    documentsSymlinkCommand: string;
  };
}

declare global {
  interface Window {
    merezhyvo?: MerezhyvoAPI;
  }
}
