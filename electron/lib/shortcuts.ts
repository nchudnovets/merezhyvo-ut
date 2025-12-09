'use strict';

import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import {
  DEFAULT_MESSENGER_ORDER,
  sanitizeMessengerSettings as sanitizeSharedMessengerSettings,
  type MessengerSettings
} from '../../src/shared/messengers';
import { DEFAULT_LOCALE, isValidLocale } from '../../src/i18n/locales';
import { INTERNAL_BASE_FOLDER } from './internal-paths';

export const BUNDLED_ICON_PATH = path.resolve(__dirname, '..', 'merezhyvo_256.png');
export const SETTINGS_SCHEMA = 6;

export type KeyboardSettings = {
  enabledLayouts: string[];
  defaultLayout: string;
};

export type TorConfig = {
  keepEnabled: boolean;
};

export type DownloadsSettings = {
  defaultDir: string;
  concurrent: 1 | 2 | 3;
};

export type UISettings = {
  scale: number;
  hideFileDialogNote: boolean;
  language: string;
};

export type HttpsMode = 'strict' | 'preferred';

export type SslException = {
  host: string;
  errorType: string;
};

export type WebrtcMode = 'always_on' | 'always_off' | 'off_with_tor';

export type CookiePrivacySettings = {
  blockThirdParty: boolean;
  exceptions: {
    thirdPartyAllow: Record<string, boolean>;
  };
};

export type SettingsState = {
  schema: typeof SETTINGS_SCHEMA;
  keyboard: KeyboardSettings;
  tor: TorConfig;
  messenger: MessengerSettings;
  downloads: DownloadsSettings;
  ui: UISettings;
  httpsMode: HttpsMode;
  sslExceptions: SslException[];
  webrtcMode: WebrtcMode;
  permissions?: unknown;
  privacy?: {
    cookies?: CookiePrivacySettings;
  };
};

type SettingsLike = {
  schema?: unknown;
  keyboard?: unknown;
  tor?: unknown;
  messenger?: unknown;
  downloads?: unknown;
  ui?: unknown;
  httpsMode?: unknown;
  sslExceptions?: unknown;
  webrtcMode?: unknown;
  privacy?: unknown;
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
  const keepEnabled = typeof source.keepEnabled === 'boolean' ? source.keepEnabled : false;
  return { keepEnabled };
};

const fsp = fs.promises;

// export const slugify = (value: unknown): string =>
//   (value ?? '')
//     .toString()
//     .toLowerCase()
//     .replace(/[^a-z0-9]+/g, '-')
//     .replace(/^-+|-+$/g, '')
//     .slice(0, 60) || 'merezhyvo';

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
const getBackupSettingsFilePath = (): string => path.join(INTERNAL_BASE_FOLDER, 'settings.json');

const DEFAULT_KEYBOARD_SETTINGS: KeyboardSettings = {
  enabledLayouts: ['en'],
  defaultLayout: 'en'
};

const DEFAULT_TOR_CONFIG: TorConfig = {
  keepEnabled: false
};

import { DOWNLOADS_FOLDER } from './internal-paths';

const DEFAULT_DOWNLOADS_SETTINGS: DownloadsSettings = {
  defaultDir: DOWNLOADS_FOLDER,
  concurrent: 2
};

const DEFAULT_UI_SETTINGS: UISettings = {
  scale: 1.0,
  hideFileDialogNote: false,
  language: DEFAULT_LOCALE
};

const DEFAULT_MESSENGER_SETTINGS: MessengerSettings = {
  order: [...DEFAULT_MESSENGER_ORDER]
};

const DEFAULT_HTTPS_MODE: HttpsMode = 'strict';
const DEFAULT_SSL_EXCEPTIONS: SslException[] = [];
const DEFAULT_WEBRTC_MODE: WebrtcMode = 'always_on';
const DEFAULT_COOKIE_PRIVACY: CookiePrivacySettings = {
  blockThirdParty: true,
  exceptions: { thirdPartyAllow: {} }
};

export const createDefaultSettingsState = (): SettingsState => ({
  schema: SETTINGS_SCHEMA,
  keyboard: { ...DEFAULT_KEYBOARD_SETTINGS },
  tor: { ...DEFAULT_TOR_CONFIG },
  messenger: { ...DEFAULT_MESSENGER_SETTINGS }
  ,
  downloads: { ...DEFAULT_DOWNLOADS_SETTINGS }
  ,
  ui: { ...DEFAULT_UI_SETTINGS },
  httpsMode: DEFAULT_HTTPS_MODE,
  sslExceptions: [...DEFAULT_SSL_EXCEPTIONS],
  webrtcMode: DEFAULT_WEBRTC_MODE,
  privacy: { cookies: { ...DEFAULT_COOKIE_PRIVACY, exceptions: { thirdPartyAllow: {} } } }
});

const coerceScale = (value: number): number => {
  const rounded = Math.round(value * 10) / 10;
  return Number(Math.max(0.5, Math.min(1.6, rounded)).toFixed(1));
};

export const sanitizeUiSettings = (raw: unknown): UISettings => {
  const source = (typeof raw === 'object' && raw !== null) ? raw as Partial<UISettings> : {};
  const scaleRaw = typeof source.scale === 'number' ? source.scale : DEFAULT_UI_SETTINGS.scale;
  const hide = typeof source.hideFileDialogNote === 'boolean' ? source.hideFileDialogNote : DEFAULT_UI_SETTINGS.hideFileDialogNote;
  const language =
    typeof source.language === 'string' && isValidLocale(source.language)
      ? source.language
      : DEFAULT_UI_SETTINGS.language;
  return { scale: coerceScale(scaleRaw), hideFileDialogNote: hide, language };
};

export const sanitizeDownloadsSettings = (raw: unknown): DownloadsSettings => {
  const source = (typeof raw === 'object' && raw !== null) ? raw as Partial<DownloadsSettings> : {};
  const defaultDir = typeof source.defaultDir === 'string' && source.defaultDir.trim().length
    ? source.defaultDir.trim()
    : DEFAULT_DOWNLOADS_SETTINGS.defaultDir;
  const concurrentRaw = typeof source.concurrent === 'number' ? source.concurrent : DEFAULT_DOWNLOADS_SETTINGS.concurrent;
  const concurrent = Math.min(3, Math.max(1, Math.round(concurrentRaw)));
  return { defaultDir, concurrent: concurrent as 1 | 2 | 3 };
};

export const sanitizeHttpsMode = (raw: unknown): HttpsMode => {
  if (raw === 'preferred') return 'preferred';
  if (raw === 'strict') return 'strict';
  if (typeof raw === 'string') {
    const lowered = raw.toLowerCase();
    if (lowered === 'preferred') return 'preferred';
    if (lowered === 'strict') return 'strict';
  }
  return DEFAULT_HTTPS_MODE;
};

export const sanitizeCookiePrivacy = (raw: unknown): CookiePrivacySettings => {
  const source = (typeof raw === 'object' && raw !== null) ? raw as Partial<CookiePrivacySettings> : {};
  const blockThirdParty = typeof source.blockThirdParty === 'boolean' ? source.blockThirdParty : DEFAULT_COOKIE_PRIVACY.blockThirdParty;
  const exceptionsRaw = (source.exceptions && typeof source.exceptions === 'object') ? source.exceptions : {};
  const thirdPartyAllow = (exceptionsRaw as { thirdPartyAllow?: unknown }).thirdPartyAllow;
  const map: Record<string, boolean> = {};
  if (thirdPartyAllow && typeof thirdPartyAllow === 'object') {
    for (const [key, val] of Object.entries(thirdPartyAllow as Record<string, unknown>)) {
      if (typeof val === 'boolean' && typeof key === 'string' && key.trim()) {
        map[key.toLowerCase()] = val;
      }
    }
  }
  return {
    blockThirdParty,
    exceptions: { thirdPartyAllow: map }
  };
};

export const sanitizeSslExceptions = (raw: unknown): SslException[] => {
  if (!Array.isArray(raw)) return [...DEFAULT_SSL_EXCEPTIONS];
  const normalized = raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const obj = entry as Record<string, unknown>;
      const host = isNonEmptyString(obj.host) ? obj.host.trim().toLowerCase() : null;
      const errorType = isNonEmptyString(obj.errorType) ? obj.errorType.trim() : null;
      if (!host || !errorType) return null;
      return { host, errorType };
    })
    .filter((item): item is SslException => Boolean(item));
  const dedup = new Map<string, SslException>();
  for (const item of normalized) {
    const key = `${item.host}__${item.errorType}`;
    if (!dedup.has(key)) {
      dedup.set(key, item);
    }
  }
  return Array.from(dedup.values());
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
  const privacyCookies = sanitizeCookiePrivacy((source.privacy as { cookies?: unknown } | undefined)?.cookies);
  const downloads = sanitizeDownloadsSettings(source.downloads);
  const ui = sanitizeUiSettings(source.ui);
  const httpsMode = sanitizeHttpsMode(source.httpsMode);
  const sslExceptions = sanitizeSslExceptions(source.sslExceptions);
  const wm = typeof source.webrtcMode === 'string' ? source.webrtcMode : null;
  const webrtcMode: WebrtcMode =
    wm === 'always_off' || wm === 'off_with_tor' ? wm : 'always_on';

  return {
    schema: SETTINGS_SCHEMA,
    keyboard,
    tor,
    messenger,
    downloads,
    ui,
    httpsMode,
    sslExceptions,
    webrtcMode,
    ...(permissions ? { permissions } : {}),
    privacy: { cookies: privacyCookies }
  };
};

const readJsonIfExists = async (file: string): Promise<unknown | null> => {
  try {
    const raw = await fsp.readFile(file, 'utf8');
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

export async function readSettingsState(): Promise<SettingsState> {
  const targetFile = getSettingsFilePath();
  const backupFile = getBackupSettingsFilePath();

  const attemptPersist = async (value: SettingsState) => {
    try {
      await fsp.mkdir(path.dirname(targetFile), { recursive: true });
      await fsp.writeFile(targetFile, JSON.stringify(value, null, 2), 'utf8');
    } catch (writeErr) {
      console.error('[merezhyvo] settings write failed', writeErr);
    }
    try {
      await fsp.mkdir(path.dirname(backupFile), { recursive: true });
      await fsp.writeFile(backupFile, JSON.stringify(value, null, 2), 'utf8');
    } catch {
      // backup best-effort
    }
  };

  // primary read
  try {
    const raw = await fsp.readFile(targetFile, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const sanitized = sanitizeSettingsPayload(parsed);
    await attemptPersist(sanitized);
    return sanitized;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    const isSyntaxError = err instanceof SyntaxError;
    if (!isSyntaxError && code !== 'ENOENT') {
      console.warn('[merezhyvo] settings read failed, attempting fallback', err);
    }
  }

  // fallback: backup copy
  const backupState = await readJsonIfExists(backupFile);

  // legacy paths
  const legacyState = await readJsonIfExists(getLegacySettingsFilePath());
  const legacyTor = await readJsonIfExists(getLegacyTorSettingsFilePath());

  const merged = {
    ...(typeof backupState === 'object' && backupState !== null ? backupState : {}),
    ...(typeof legacyState === 'object' && legacyState !== null ? legacyState : {}),
    ...(legacyTor ? { tor: legacyTor } : {})
  };

  const sanitized = sanitizeSettingsPayload(merged);
  await attemptPersist(sanitized);
  return sanitized;
}

export async function writeSettingsState(patch: SettingsLike | SettingsState): Promise<SettingsState> {
  const file = getSettingsFilePath();
  const backupFile = getBackupSettingsFilePath();

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
  try {
    await fs.promises.mkdir(path.dirname(backupFile), { recursive: true });
    await fs.promises.writeFile(backupFile, JSON.stringify(merged, null, 2), 'utf8');
  } catch {
    // best-effort backup
  }
  return merged;
}
