export type Mode = 'desktop' | 'mobile';

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
}

export interface TabsSnapshot {
  ready: boolean;
  tabs: Tab[];
  activeId: string | null;
}

export interface InstalledApp {
  id: string;
  title: string;
  url: string;
  desktopFilePath?: string;
  iconPath?: string;
  single?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface TorSettings {
  containerId: string;
}

export type KeyboardSettings = {
  enabledLayouts: string[];
  defaultLayout: string;
}
export interface SettingsState {
  schema: number;
  installedApps: InstalledApp[];
  tor?: TorSettings;
  keyboard?: KeyboardSettings;
}

export interface ShortcutIcon {
  name: string;
  data: ArrayBuffer | Uint8Array | string;
}

export interface ShortcutRequest {
  title: string;
  url: string;
  single?: boolean;
  icon?: ShortcutIcon | null;
}

export interface ShortcutResult {
  ok: boolean;
  error?: string | null;
  desktopFilePath?: string;
  iconPath?: string;
  installedApp?: InstalledApp;
}

export interface TorState {
  enabled: boolean;
  starting?: boolean;
  reason?: string | null;
}

export interface TorConfigResult {
  ok: boolean;
  containerId?: string;
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

export interface ZoomState {
  level: number;
  min: number;
  max: number;
  step: number;
}
