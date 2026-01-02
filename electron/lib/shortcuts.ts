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
import { getSiteKey } from './site-key';

export const BUNDLED_ICON_PATH = path.resolve(__dirname, '..', 'merezhyvo_256.png');
export const SETTINGS_SCHEMA = 9;

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
  theme?: 'dark' | 'light';
  webZoomMobile?: number;
  webZoomDesktop?: number;
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

export type TrackerPrivacySettings = {
  enabled: boolean;
  exceptions: string[];
};

export type AdsPrivacySettings = {
  enabled: boolean;
  exceptions: string[];
};

export type BlockingMode = 'basic' | 'strict';

export type SecureDnsMode = 'automatic' | 'secure';
export type SecureDnsProvider = 'auto' | 'cloudflare' | 'quad9' | 'google' | 'mullvad' | 'nextdns' | 'custom';
export type SecureDnsSettings = {
  enabled: boolean;
  mode: SecureDnsMode;
  provider: SecureDnsProvider;
  nextdnsId?: string;
  customUrl?: string;
};

export type NetworkSettings = {
  secureDns: SecureDnsSettings;
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
  network?: NetworkSettings;
  permissions?: unknown;
  privacy?: {
    cookies?: CookiePrivacySettings;
    trackers?: TrackerPrivacySettings;
    ads?: AdsPrivacySettings;
    blockingMode?: BlockingMode;
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
  network?: unknown;
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
  language: DEFAULT_LOCALE,
  theme: 'dark',
  webZoomMobile: 2.3,
  webZoomDesktop: 1.0
};

const DEFAULT_MESSENGER_SETTINGS: MessengerSettings = {
  order: [...DEFAULT_MESSENGER_ORDER],
  hideToolbar: false
};

const MESSENGER_HOST_EXCEPTIONS = [
  'web.telegram.org',
  'web.whatsapp.com',
  'whatsapp.com',
  'www.messenger.com',
  'messenger.com'
];

const DEFAULT_HTTPS_MODE: HttpsMode = 'strict';
const DEFAULT_SSL_EXCEPTIONS: SslException[] = [];
const DEFAULT_WEBRTC_MODE: WebrtcMode = 'always_on';
const DEFAULT_COOKIE_PRIVACY: CookiePrivacySettings = {
  blockThirdParty: false,
  exceptions: {
    thirdPartyAllow: MESSENGER_HOST_EXCEPTIONS.reduce<Record<string, boolean>>((acc, host) => {
      acc[host] = true;
      return acc;
    }, {})
  }
};
const DEFAULT_TRACKER_PRIVACY: TrackerPrivacySettings = {
  enabled: false,
  exceptions: [...MESSENGER_HOST_EXCEPTIONS]
};
const DEFAULT_ADS_PRIVACY: AdsPrivacySettings = {
  enabled: false,
  exceptions: [...MESSENGER_HOST_EXCEPTIONS]
};
const DEFAULT_BLOCKING_MODE: BlockingMode = 'basic';
const DEFAULT_SECURE_DNS: SecureDnsSettings = {
  enabled: false,
  mode: 'automatic',
  provider: 'auto',
  nextdnsId: '',
  customUrl: ''
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
  network: { secureDns: { ...DEFAULT_SECURE_DNS } },
  privacy: {
    blockingMode: DEFAULT_BLOCKING_MODE,
    cookies: { ...DEFAULT_COOKIE_PRIVACY },
    trackers: { ...DEFAULT_TRACKER_PRIVACY },
    ads: { ...DEFAULT_ADS_PRIVACY }
  }
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
  const theme =
    source.theme === 'light' || source.theme === 'dark'
      ? source.theme
      : DEFAULT_UI_SETTINGS.theme;
  const clampZoom = (v: number | undefined): number | undefined => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
    const rounded = Math.round(v * 100) / 100;
    return Math.min(3.5, Math.max(0.5, rounded));
  };
  const mobileRaw = typeof source.webZoomMobile === 'number' ? source.webZoomMobile : DEFAULT_UI_SETTINGS.webZoomMobile;
  const desktopRaw = typeof source.webZoomDesktop === 'number' ? source.webZoomDesktop : DEFAULT_UI_SETTINGS.webZoomDesktop;
  const webZoomMobile = clampZoom(mobileRaw) ?? DEFAULT_UI_SETTINGS.webZoomMobile;
  const webZoomDesktop = clampZoom(desktopRaw) ?? DEFAULT_UI_SETTINGS.webZoomDesktop;
  return { scale: coerceScale(scaleRaw), hideFileDialogNote: hide, language, theme, webZoomMobile, webZoomDesktop };
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

export const sanitizeSecureDnsSettings = (raw: unknown): SecureDnsSettings => {
  const source = (typeof raw === 'object' && raw !== null) ? raw as Partial<SecureDnsSettings> : {};
  const enabled = typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_SECURE_DNS.enabled;
  const mode: SecureDnsMode =
    source.mode === 'secure' || source.mode === 'automatic'
      ? source.mode
      : DEFAULT_SECURE_DNS.mode;
  const provider: SecureDnsProvider =
    source.provider === 'auto' ||
    source.provider === 'cloudflare' ||
    source.provider === 'quad9' ||
    source.provider === 'google' ||
    source.provider === 'mullvad' ||
    source.provider === 'nextdns' ||
    source.provider === 'custom'
      ? source.provider
      : DEFAULT_SECURE_DNS.provider;
  const nextdnsId =
    typeof source.nextdnsId === 'string' ? source.nextdnsId.trim() : DEFAULT_SECURE_DNS.nextdnsId;
  const customUrl =
    typeof source.customUrl === 'string' ? source.customUrl.trim() : DEFAULT_SECURE_DNS.customUrl;
  return {
    enabled,
    mode,
    provider,
    nextdnsId,
    customUrl
  };
};

export const sanitizeCookiePrivacy = (raw: unknown): CookiePrivacySettings => {
  const source = (typeof raw === 'object' && raw !== null) ? raw as Partial<CookiePrivacySettings> : {};
  const blockThirdParty = typeof source.blockThirdParty === 'boolean' ? source.blockThirdParty : DEFAULT_COOKIE_PRIVACY.blockThirdParty;
  const exceptionsRaw = (source.exceptions && typeof source.exceptions === 'object') ? source.exceptions : {};
  const thirdPartyAllow = (exceptionsRaw as { thirdPartyAllow?: unknown }).thirdPartyAllow;
  const hasProvidedExceptions = thirdPartyAllow !== undefined;
  const map: Record<string, boolean> = {};
  if (thirdPartyAllow && typeof thirdPartyAllow === 'object') {
    for (const [key, val] of Object.entries(thirdPartyAllow as Record<string, unknown>)) {
      if (typeof val === 'boolean' && typeof key === 'string' && key.trim()) {
        const siteKey = getSiteKey(key) ?? key.toLowerCase();
        map[siteKey] = val;
      }
    }
  }
  if (!hasProvidedExceptions) {
    for (const host of MESSENGER_HOST_EXCEPTIONS) {
      if (!(host in map)) {
        map[host] = true;
      }
    }
  }
  return {
    blockThirdParty,
    exceptions: { thirdPartyAllow: map }
  };
};

export const sanitizeTrackerPrivacy = (raw: unknown): TrackerPrivacySettings => {
  const source = (typeof raw === 'object' && raw !== null) ? raw as Partial<TrackerPrivacySettings> : {};
  const enabled = typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_TRACKER_PRIVACY.enabled;
  const hasProvidedExceptions = Array.isArray(source.exceptions);
  const exceptions = Array.isArray(source.exceptions)
    ? Array.from(new Set(source.exceptions
      .map((item) => {
        if (typeof item !== 'string') return '';
        const siteKey = getSiteKey(item);
        return siteKey ?? item.trim().toLowerCase();
      })
      .filter((item) => item.length > 0)))
    : [];
  if (!hasProvidedExceptions) {
    for (const host of MESSENGER_HOST_EXCEPTIONS) {
      if (!exceptions.includes(host)) {
        exceptions.push(host);
      }
    }
  }
  return { enabled, exceptions };
};

export const sanitizeAdsPrivacy = (raw: unknown): AdsPrivacySettings => {
  const source = (typeof raw === 'object' && raw !== null) ? raw as Partial<AdsPrivacySettings> : {};
  const enabled = typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_ADS_PRIVACY.enabled;
  const hasProvidedExceptions = Array.isArray(source.exceptions);
  const exceptions = Array.isArray(source.exceptions)
    ? Array.from(new Set(source.exceptions
      .map((item) => {
        if (typeof item !== 'string') return '';
        const siteKey = getSiteKey(item);
        return siteKey ?? item.trim().toLowerCase();
      })
      .filter((item) => item.length > 0)))
    : [];
  if (!hasProvidedExceptions) {
    for (const host of MESSENGER_HOST_EXCEPTIONS) {
      if (!exceptions.includes(host)) {
        exceptions.push(host);
      }
    }
  }
  return { enabled, exceptions };
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
  const privacyTrackers = sanitizeTrackerPrivacy((source.privacy as { trackers?: unknown } | undefined)?.trackers);
  const privacyAds = sanitizeAdsPrivacy((source.privacy as { ads?: unknown } | undefined)?.ads);
  const blockingModeRaw = (source.privacy as { blockingMode?: unknown } | undefined)?.blockingMode;
  const blockingMode: BlockingMode =
    blockingModeRaw === 'basic' || blockingModeRaw === 'strict'
      ? blockingModeRaw
      : DEFAULT_BLOCKING_MODE;
  const downloads = sanitizeDownloadsSettings(source.downloads);
  const ui = sanitizeUiSettings(source.ui);
  const httpsMode = sanitizeHttpsMode(source.httpsMode);
  const sslExceptions = sanitizeSslExceptions(source.sslExceptions);
  const networkSource = (source.network && typeof source.network === 'object') ? source.network as Record<string, unknown> : {};
  const secureDns = sanitizeSecureDnsSettings((networkSource as { secureDns?: unknown }).secureDns);
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
    network: { secureDns },
    ...(permissions ? { permissions } : {}),
    privacy: { cookies: privacyCookies, trackers: privacyTrackers, ads: privacyAds, blockingMode }
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

const writeJsonAtomic = async (file: string, value: unknown): Promise<void> => {
  const dir = path.dirname(file);
  const tmpFile = `${file}.${process.pid}.${Date.now()}_${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(tmpFile, JSON.stringify(value, null, 2), 'utf8');
  await fsp.rename(tmpFile, file);
};

export async function readSettingsState(): Promise<SettingsState> {
  const targetFile = getSettingsFilePath();
  const backupFile = getBackupSettingsFilePath();

  const attemptPersist = async (value: SettingsState) => {
    try {
      await writeJsonAtomic(targetFile, value);
    } catch (writeErr) {
      console.error('[merezhyvo] settings write failed', writeErr);
    }
    try {
      await writeJsonAtomic(backupFile, value);
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

  const legacyPayload = typeof legacyState === 'object' && legacyState !== null ? legacyState : {};
  const backupPayload = typeof backupState === 'object' && backupState !== null ? backupState : {};
  const merged = {
    ...legacyPayload,
    ...backupPayload,
    ...(!('tor' in backupPayload) && legacyTor ? { tor: legacyTor } : {})
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
  const currentPrivacy = (current as SettingsLike | null)?.privacy ?? {};
  const patchPrivacy = (patch as SettingsLike | null)?.privacy ?? {};
  const mergedPrivacy =
    typeof currentPrivacy === 'object' && currentPrivacy !== null
      ? { ...currentPrivacy, ...(typeof patchPrivacy === 'object' && patchPrivacy !== null ? patchPrivacy : {}) }
      : patchPrivacy;

  const merged = sanitizeSettingsPayload({
    ...(current ?? {}),
    ...(patch ?? {}),
    ...(mergedPrivacy ? { privacy: mergedPrivacy } : {})
  });

  // 3) Persist merged result.
  await writeJsonAtomic(file, merged);
  try {
    await writeJsonAtomic(backupFile, merged);
  } catch {
    // best-effort backup
  }
  return merged;
}
