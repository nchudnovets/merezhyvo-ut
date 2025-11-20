'use strict';

import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import {
  DEFAULT_MESSENGER_ORDER,
  sanitizeMessengerSettings as sanitizeSharedMessengerSettings,
  type MessengerSettings
} from '../../src/shared/messengers';

export const BUNDLED_ICON_PATH = path.resolve(__dirname, '..', 'merezhyvo_256.png');
export const SETTINGS_SCHEMA = 2;

export type KeyboardSettings = {
  enabledLayouts: string[];
  defaultLayout: string;
};

export type TorConfig = {
  containerId: string;
  keepEnabled: boolean;
};

export type DownloadsSettings = {
  defaultDir: string;
  concurrent: 1 | 2 | 3;
};

export type SettingsState = {
  schema: typeof SETTINGS_SCHEMA;
  keyboard: KeyboardSettings;
  tor: TorConfig;
  messenger: MessengerSettings;
  downloads: DownloadsSettings;
  permissions?: unknown;
};

type SettingsLike = {
  schema?: unknown;
  keyboard?: unknown;
  tor?: unknown;
  messenger?: unknown;
  permissions?: unknown;
};

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const sanitizeKeyboardSettings = (raw: unknown): KeyboardSettings => {
  const source = (typeof raw === 'object' && raw !== null) ? raw as Record<string, unknown> : {};
  const enabledRaw = Array.isArray(source.enabledLayouts)
    ? source.enabledLayouts.filter(isNonEmptyString)
    : [];
  const enabled = enabledRaw.length > 0 ? Array.from(new Set(enabledRaw)) : ['en'];
  const defCandidate = isNonEmptyString(source.defaultLayout) ? source.defaultLayout.trim() : undefined;
  const defaultLayout = defCandidate && enabled.includes(defCandidate) ? defCandidate : enabled[0] ?? 'en';
  return { enabledLayouts: enabled, defaultLayout };
};

export const sanitizeTorConfig = (raw: unknown): TorConfig => {
  const source = (typeof raw === 'object' && raw !== null) ? raw as Record<string, unknown> : {};
  const value = isNonEmptyString(source.containerId) ? source.containerId.trim() : '';
  let keepEnabled = typeof source.keepEnabled === 'boolean' ? source.keepEnabled : false;
  if (!value) {
    keepEnabled = false;
  }
  return { containerId: value, keepEnabled };
};

const fsp = fs.promises;

export const slugify = (value: unknown): string =>
  (value ?? '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'merezhyvo';

export const ensureDir = (dir: string): void => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // noop
  }
};

export const getProfileDir = (): string => {
  const dir = path.join(app.getPath('userData'), 'profiles', 'default');
  ensureDir(dir);
  return dir;
};

export const getSessionFilePath = (): string => path.join(getProfileDir(), 'session.json');
const getLegacySettingsFilePath = (): string => path.join(getProfileDir(), 'settings.json');
const getLegacyTorSettingsFilePath = (): string => path.join(getProfileDir(), 'tor-settings.json');
export const getSettingsFilePath = (): string => path.join(app.getPath('userData'), 'settings.json');

const DEFAULT_KEYBOARD_SETTINGS: KeyboardSettings = {
  enabledLayouts: ['en'],
  defaultLayout: 'en'
};

const DEFAULT_TOR_CONFIG: TorConfig = {
  containerId: '',
  keepEnabled: false
};

const DEFAULT_DOWNLOADS_SETTINGS: DownloadsSettings = {
  defaultDir: app.getPath('downloads'),
  concurrent: 2
};

const DEFAULT_MESSENGER_SETTINGS: MessengerSettings = {
  order: [...DEFAULT_MESSENGER_ORDER]
};

export const createDefaultSettingsState = (): SettingsState => ({
  schema: SETTINGS_SCHEMA,
  keyboard: { ...DEFAULT_KEYBOARD_SETTINGS },
  tor: { ...DEFAULT_TOR_CONFIG },
  messenger: { ...DEFAULT_MESSENGER_SETTINGS }
  ,
  downloads: { ...DEFAULT_DOWNLOADS_SETTINGS }
});

export const sanitizeDownloadsSettings = (raw: unknown): DownloadsSettings => {
  const source = (typeof raw === 'object' && raw !== null) ? raw as Partial<DownloadsSettings> : {};
  const defaultDir = typeof source.defaultDir === 'string' && source.defaultDir.trim().length
    ? source.defaultDir.trim()
    : DEFAULT_DOWNLOADS_SETTINGS.defaultDir;
  const concurrentRaw = typeof source.concurrent === 'number' ? source.concurrent : DEFAULT_DOWNLOADS_SETTINGS.concurrent;
  const concurrent = Math.min(3, Math.max(1, Math.round(concurrentRaw)));
  return { defaultDir, concurrent: concurrent as 1 | 2 | 3 };
};

export const sanitizeSettingsPayload = (payload: unknown): SettingsState => {
  const source = (typeof payload === 'object' && payload !== null)
    ? (payload as SettingsLike)
    : {};

  const keyboard = sanitizeKeyboardSettings(source.keyboard);
  const tor = sanitizeTorConfig(source.tor);
  const messenger = sanitizeSharedMessengerSettings(source.messenger);
  const permissions =
    typeof source.permissions === 'object' && source.permissions !== null
      ? source.permissions
      : undefined;
  const downloads = sanitizeDownloadsSettings(source.downloads);

  return {
    schema: SETTINGS_SCHEMA,
    keyboard,
    tor,
    messenger,
    downloads,
    ...(permissions ? { permissions } : {})
  };
};

export async function readSettingsState(): Promise<SettingsState> {
  const targetFile = getSettingsFilePath();
  try {
    const raw = await fsp.readFile(targetFile, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const sanitized = sanitizeSettingsPayload(parsed);
    await fsp.mkdir(path.dirname(targetFile), { recursive: true });
    await fsp.writeFile(targetFile, JSON.stringify(sanitized, null, 2), 'utf8');
    return sanitized;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    const isSyntaxError = err instanceof SyntaxError;
    if (!isSyntaxError && code !== 'ENOENT') {
      console.warn('[merezhyvo] settings read failed, attempting legacy fallback', err);
    }
  }

  let legacyState: unknown = null;
  try {
    const legacyRaw = await fsp.readFile(getLegacySettingsFilePath(), 'utf8');
    legacyState = JSON.parse(legacyRaw) as unknown;
  } catch {
    legacyState = null;
  }

  let legacyTor: unknown = null;
  try {
    const torRaw = await fsp.readFile(getLegacyTorSettingsFilePath(), 'utf8');
    legacyTor = JSON.parse(torRaw) as unknown;
  } catch {
    legacyTor = null;
  }

  const merged = {
    ...(typeof legacyState === 'object' && legacyState !== null ? legacyState : {}),
    tor: legacyTor
  };

  const sanitized = sanitizeSettingsPayload(merged);
  try {
    await fsp.mkdir(path.dirname(targetFile), { recursive: true });
    await fsp.writeFile(targetFile, JSON.stringify(sanitized, null, 2), 'utf8');
  } catch (writeErr) {
    console.error('[merezhyvo] settings write failed', writeErr);
  }
  return sanitized;
}

export async function writeSettingsState(patch: SettingsLike | SettingsState): Promise<SettingsState> {
  const file = getSettingsFilePath();

  // 1) Read current state from disk, but do NOT write defaults here.
  let current: SettingsState | null = null;
  try {
    current = await readSettingsState();
  } catch {
    current = null;
  }

  // 2) Merge current-on-disk with incoming patch (patch wins), then sanitize once.
  const merged = sanitizeSettingsPayload({
    ...(current ?? {}),
    ...(patch ?? {})
  });

  // 3) Persist merged result.
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}
