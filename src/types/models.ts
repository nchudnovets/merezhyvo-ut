export type Mode = 'desktop' | 'mobile';

export type MessengerId = 'whatsapp' | 'telegram' | 'messenger';

export interface MessengerDefinition {
  id: MessengerId;
  title: string;
  url: string;
}

export interface MessengerSettings {
  order: MessengerId[];
}

export type TabKind = 'browser' | 'messenger';

export interface Tab {
  id: string;
  url: string;
  title: string;
  favicon: string;
  isLoading: boolean;
  pinned: boolean;
  muted: boolean;
  discarded: boolean;
  isYouTube: boolean;
  isPlaying: boolean;
  lastUsedAt: number;
  kind: TabKind;
}

export interface TabsSnapshot {
  ready: boolean;
  tabs: Tab[];
  activeId: string | null;
}

export interface HistoryVisit {
  id: string;
  ts: number;
  url: string;
  title?: string | null;
  origin?: string | null;
  transition?: string | null;
  referrer?: string | null;
  wcId?: number | null;
  faviconId?: string | null;
}

export interface HistoryQueryOptions {
  q?: string;
  fromTs?: number;
  toTs?: number;
  origin?: string | null;
  limit?: number;
  cursor?: number;
}

export interface HistoryQueryResult {
  items: HistoryVisit[];
  nextCursor?: number;
}

export interface TopSitesOptions {
  days?: number;
  limit?: number;
}

export interface TopSite {
  origin: string;
  urlSample: string;
  titleSample?: string | null;
  visits: number;
  lastTs: number;
  faviconId?: string | null;
}

export type BookmarkNodeType = 'bookmark' | 'folder';

export interface BookmarkNode {
  id: string;
  type: BookmarkNodeType;
  title: string;
  parentId: string | null;
  url?: string;
  tags?: string[];
  faviconId?: string | null;
  createdAt?: number;
  updatedAt?: number;
  children?: string[];
}

export interface BookmarkRoots {
  toolbar: string;
  mobile: string;
  other: string;
}

export interface BookmarksTree {
  schema: 1;
  roots: BookmarkRoots;
  nodes: Record<string, BookmarkNode>;
}

export interface BookmarkAddPayload {
  type?: BookmarkNodeType;
  title?: string | null;
  url?: string;
  parentId?: string;
  tags?: string[] | null;
}

export interface BookmarkUpdatePayload {
  id: string;
  title?: string | null;
  url?: string | null;
  tags?: string[] | null;
}

export interface BookmarkMovePayload {
  id: string;
  newParentId: string;
  index?: number;
}

export type BookmarkHtmlImportScope = 'add' | 'replace';

export type BookmarkHtmlExportScope = 'current' | 'all';

export interface BookmarkHtmlImportPayload {
  content: string;
  scope?: BookmarkHtmlImportScope;
  targetFolderId?: string;
}

export type BookmarkHtmlImportPreviewPayload = BookmarkHtmlImportPayload;

export interface BookmarkHtmlImportPreviewResult {
  folders: number;
  bookmarks: number;
}

export interface BookmarkHtmlImportResult {
  foldersImported: number;
  bookmarksImported: number;
}

export interface BookmarkHtmlExportPayload {
  scope?: BookmarkHtmlExportScope;
  targetFolderId?: string;
}

export interface BookmarkHtmlExportResult {
  filenameSuggested: string;
  htmlContent: string;
}

export interface TorConfig {
  containerId: string;
  keepEnabled: boolean;
}

export interface KeyboardSettings {
  enabledLayouts: string[];
  defaultLayout: string;
}

export interface SettingsState {
  schema: number;
  tor: TorConfig;
  keyboard: KeyboardSettings;
  messenger: MessengerSettings;
}

export interface PasswordEntryMeta {
  id: string;
  origin: string;
  signonRealm: string;
  formAction?: string;
  username: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number;
  useCount: number;
  notes?: string;
  tags?: string[];
}

export interface PasswordEntrySecret {
  username: string;
  password: string;
}

export interface PasswordStatus {
  locked: boolean;
  hasMaster: boolean;
  autoLockMinutes: number;
}

export interface PasswordSettings {
  saveAndFill: boolean;
  offerToSave: boolean;
  disallowHttp: boolean;
  autoLockMinutes: number;
}

export interface PasswordUpsertPayload {
  id?: string;
  origin: string;
  signonRealm: string;
  formAction?: string;
  username: string;
  password: string;
  notes?: string;
  tags?: string[];
}

export interface PasswordCsvRow {
  name?: string;
  url: string;
  username: string;
}

export interface PasswordCsvPreview {
  total: number;
  valid: number;
  invalid: number;
  sample: PasswordCsvRow | null;
}

export type PasswordImportMode = 'add' | 'replace';

export interface PasswordCsvImportResult {
  imported: number;
  skipped: number;
}

export interface PasswordEncryptedExportResult {
  filenameSuggested: string;
  content: Buffer;
}

export interface PasswordChangeMasterResult {
  ok?: true;
  error?: string;
}

export interface PasswordAutofillOption {
  id: string;
  username: string;
  siteName: string;
}

export interface PasswordAutofillState {
  available: boolean;
  locked: boolean;
  options: PasswordAutofillOption[];
  siteName: string;
}

export type PasswordImportFormat = 'csv' | 'mzrpass' | 'unknown';

export interface PasswordPromptPayload {
  captureId: string;
  origin: string;
  signonRealm: string;
  formAction: string;
  username: string;
  siteName: string;
  isUpdate: boolean;
  entryId?: string;
}

export type PasswordCaptureAction = 'save' | 'update' | 'keep-both' | 'never';

export interface PasswordCaptureActionResult {
  ok?: true;
  updated?: boolean;
  error?: string;
}

export interface TorState {
  enabled: boolean;
  starting?: boolean;
  reason?: string | null;
}

export interface TorConfigResult {
  ok: boolean;
  containerId?: string;
  keepEnabled?: boolean;
  error?: string;
}

export interface OpenUrlPayload {
  url: string;
  activate: boolean;
}

export interface SessionState {
  schema: number;
  activeId?: string;
  tabs?: unknown[];
}

export type Unsubscribe = () => void;

export type FileDialogKind = 'file' | 'folder';

export type FileDialogMode = 'open' | 'save';

export interface FileDialogOptions {
  kind: FileDialogKind;
  mode?: FileDialogMode;
  allowMultiple?: boolean;
  filters?: string[];
  title?: string;
  initialPath?: string;
}

export interface FileDialogEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface FileDialogListing {
  path: string;
  parent: string | null;
  entries: FileDialogEntry[];
}

export interface FileDialogResult {
  paths: string[];
}

export interface FileDialogFileDescriptor {
  path: string;
  name: string;
  type?: string;
  data?: string | null;
}

export interface FileDialogResponsePayload {
  requestId: string;
  files: FileDialogFileDescriptor[];
}

export interface FileDialogSavePayload {
  path: string;
  data: string;
  encoding?: BufferEncoding;
}

export type FileDialogSource = 'internal' | 'external';

export interface FileDialogRequestDetail {
  id: string;
  options: FileDialogOptions;
  source: FileDialogSource;
}

export interface ZoomState {
  level: number;
  min: number;
  max: number;
  step: number;
}
