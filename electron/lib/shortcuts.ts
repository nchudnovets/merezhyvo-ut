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

export type SavingsFloatingButtonPos = {
  x: number;
  y: number;
};

export type SavingsFloatingButtonPosByMode = {
  mobile?: SavingsFloatingButtonPos | null;
  desktop?: SavingsFloatingButtonPos | null;
};

export type SavingsFloatingButtonPosState = SavingsFloatingButtonPos | SavingsFloatingButtonPosByMode;

export type MerchantEntry = {
  domain: string;
  name: string | null;
  imageUrl?: string | null;
  hasLocal?: boolean;
  freshestCoupon?: string | null;
};

export type MerchantsCatalogCache = {
  country: string | null;
  merchants: MerchantEntry[];
  updatedAt: string | null;
  etag: string | null;
  nextAllowedFetchAt: string | null;
  lastFetchAttemptAt: string | null;
};

export type PendingCoupon = {
  couponId: string;
  promocode: string;
  source: string;
  domain: string;
  country: string;
  savedAt: string;
  expiresAt: string;
};

export type SavingsSettings = {
  enabled: boolean;
  countrySaved: string | null;
  lastPopupCountry: string | null;
  syncRetryByCountry: Record<string, string>;
  floatingButtonPos: SavingsFloatingButtonPosState | null;
  catalog: MerchantsCatalogCache;
  pendingCoupon?: PendingCoupon | null;
};

export type NetworkSettings = {
  secureDns: SecureDnsSettings;
  detectedIp?: string | null;
  detectedCountry?: string | null;
  detectedAt?: string | null;
};

export type StartPageSettings = {
  showTopSites: boolean;
  showFavorites: boolean;
  hidePanels: boolean;
  showCouponStores: boolean;
  favorites: StartPageFavorite[];
};

export type StartPageFavorite = {
  origin: string;
  faviconId?: string | null;
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
  savings?: SavingsSettings;
  startPage?: StartPageSettings;
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
  savings?: unknown;
  startPage?: unknown;
  privacy?: unknown;
  permissions?: unknown;
};

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const normalizeCountryCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  if (trimmed.length !== 2) return null;
  if (!/^[A-Z]{2}$/.test(trimmed)) return null;
  if (trimmed === 'RU') return null;
  return trimmed;
};

const normalizeStartPageFavorite = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
};

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
const DEFAULT_SAVINGS_CATALOG: MerchantsCatalogCache = {
  country: null,
  merchants: [],
  updatedAt: null,
  etag: null,
  nextAllowedFetchAt: null,
  lastFetchAttemptAt: null
};
const DEFAULT_SAVINGS_SETTINGS: SavingsSettings = {
  enabled: true,
  countrySaved: null,
  lastPopupCountry: null,
  syncRetryByCountry: {},
  floatingButtonPos: null,
  catalog: { ...DEFAULT_SAVINGS_CATALOG },
  pendingCoupon: null
};
const DEFAULT_START_PAGE_SETTINGS: StartPageSettings = {
  showTopSites: true,
  showFavorites: true,
  hidePanels: false,
  showCouponStores: true,
  favorites: []
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
  savings: { ...DEFAULT_SAVINGS_SETTINGS },
  startPage: { ...DEFAULT_START_PAGE_SETTINGS },
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

export const sanitizeNetworkSettings = (raw: unknown): NetworkSettings => {
  const source = (typeof raw === 'object' && raw !== null) ? raw as Partial<NetworkSettings> : {};
  const secureDns = sanitizeSecureDnsSettings((source as { secureDns?: unknown }).secureDns);
  const detectedIp = isNonEmptyString(source.detectedIp) ? source.detectedIp.trim() : null;
  const detectedCountry = normalizeCountryCode(source.detectedCountry) ?? null;
  const detectedAt = normalizeIsoDate(source.detectedAt) ?? null;
  return { secureDns, detectedIp, detectedCountry, detectedAt };
};

const normalizeDomain = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  let trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.includes('://')) {
    try {
      trimmed = new URL(trimmed).hostname.toLowerCase();
    } catch {
      // ignore URL parse issues
    }
  }
  trimmed = trimmed.replace(/\.$/, '');
  if (!trimmed) return null;
  if (!/^[a-z0-9.-]+$/.test(trimmed)) return null;
  return trimmed;
};

const normalizeMerchantName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeImageUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeMerchantEntry = (value: unknown): MerchantEntry | null => {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { domain?: unknown; name?: unknown; imageUrl?: unknown; hasLocal?: unknown; freshestCoupon?: unknown };
  const domain = normalizeDomain(candidate.domain);
  if (!domain) return null;
  const name = normalizeMerchantName(candidate.name);
  const imageUrl = normalizeImageUrl(candidate.imageUrl);
  const hasLocal = typeof candidate.hasLocal === 'boolean' ? candidate.hasLocal : undefined;
  const freshestCoupon = normalizeIsoDate(candidate.freshestCoupon) ?? null;
  return { domain, name, imageUrl: imageUrl ?? undefined, hasLocal, freshestCoupon };
};

const normalizeIsoDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toISOString();
};

const sanitizePendingCoupon = (value: unknown): PendingCoupon | null => {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Partial<PendingCoupon>;
  const couponId = isNonEmptyString(candidate.couponId) ? candidate.couponId.trim() : null;
  if (!couponId) return null;
  const promocode = isNonEmptyString(candidate.promocode) ? candidate.promocode.trim() : null;
  if (!promocode) return null;
  const sourceText = isNonEmptyString(candidate.source) ? candidate.source.trim() : null;
  if (!sourceText) return null;
  const domain = normalizeDomain(candidate.domain);
  if (!domain) return null;
  const country = normalizeCountryCode(candidate.country);
  if (!country) return null;
  const savedAt = normalizeIsoDate(candidate.savedAt);
  if (!savedAt) return null;
  const expiresAt = normalizeIsoDate(candidate.expiresAt);
  if (!expiresAt) return null;
  return {
    couponId,
    promocode,
    source: sourceText,
    domain,
    country,
    savedAt,
    expiresAt
  };
};

const normalizeFloatingButtonPos = (value: unknown): SavingsFloatingButtonPos | null => {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { x?: unknown; y?: unknown };
  const x = typeof candidate.x === 'number' && Number.isFinite(candidate.x) ? candidate.x : null;
  const y = typeof candidate.y === 'number' && Number.isFinite(candidate.y) ? candidate.y : null;
  return x !== null && y !== null ? { x, y } : null;
};

const normalizeFloatingButtonPosByMode = (value: unknown): SavingsFloatingButtonPosByMode | null => {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { mobile?: unknown; desktop?: unknown };
  const mobile = normalizeFloatingButtonPos(candidate.mobile);
  const desktop = normalizeFloatingButtonPos(candidate.desktop);
  if (!mobile && !desktop) return null;
  const result: SavingsFloatingButtonPosByMode = {};
  if (mobile) result.mobile = mobile;
  if (desktop) result.desktop = desktop;
  return result;
};

export const sanitizeSavingsSettings = (raw: unknown): SavingsSettings => {
  const source = (typeof raw === 'object' && raw !== null) ? raw as Partial<SavingsSettings> : {};
  const enabled = typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_SAVINGS_SETTINGS.enabled;
  const countrySaved = normalizeCountryCode(source.countrySaved) ?? DEFAULT_SAVINGS_SETTINGS.countrySaved;
  const lastPopupCountry = normalizeCountryCode(source.lastPopupCountry) ?? DEFAULT_SAVINGS_SETTINGS.lastPopupCountry;
  const posRaw = source.floatingButtonPos ?? null;
  const posByMode = normalizeFloatingButtonPosByMode(posRaw);
  const posSingle = normalizeFloatingButtonPos(posRaw);
  const floatingButtonPos = posByMode ?? posSingle;
  const catalogRaw = (source.catalog && typeof source.catalog === 'object') ? source.catalog as Partial<MerchantsCatalogCache> : {};
  const merchants: MerchantEntry[] = [];
  const seenDomains = new Set<string>();
  if (Array.isArray(catalogRaw.merchants)) {
    for (const rawEntry of catalogRaw.merchants) {
      const normalized = normalizeMerchantEntry(rawEntry);
      if (normalized && !seenDomains.has(normalized.domain)) {
        seenDomains.add(normalized.domain);
        merchants.push(normalized);
      }
    }
  }
  const fallbackDomains = (catalogRaw as { domains?: unknown }).domains;
  if (merchants.length === 0 && Array.isArray(fallbackDomains)) {
    for (const rawDomain of fallbackDomains) {
      const normalizedDomain = normalizeDomain(rawDomain);
      if (normalizedDomain && !seenDomains.has(normalizedDomain)) {
        seenDomains.add(normalizedDomain);
        merchants.push({ domain: normalizedDomain, name: null });
      }
    }
  }
  const catalog: MerchantsCatalogCache = {
    country: normalizeCountryCode(catalogRaw.country) ?? DEFAULT_SAVINGS_CATALOG.country,
    merchants,
    updatedAt: normalizeIsoDate(catalogRaw.updatedAt) ?? DEFAULT_SAVINGS_CATALOG.updatedAt,
    etag: typeof catalogRaw.etag === 'string' ? catalogRaw.etag : DEFAULT_SAVINGS_CATALOG.etag,
    nextAllowedFetchAt: normalizeIsoDate(catalogRaw.nextAllowedFetchAt) ?? DEFAULT_SAVINGS_CATALOG.nextAllowedFetchAt,
    lastFetchAttemptAt: normalizeIsoDate(catalogRaw.lastFetchAttemptAt) ?? DEFAULT_SAVINGS_CATALOG.lastFetchAttemptAt
  };
  const pendingCoupon = sanitizePendingCoupon(source.pendingCoupon);
  const retries = typeof source.syncRetryByCountry === 'object' && source.syncRetryByCountry !== null
    ? Object.entries(source.syncRetryByCountry as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, value]) => {
        const code = normalizeCountryCode(key);
        const timestamp = normalizeIsoDate(value);
        if (code && timestamp) {
          acc[code] = timestamp;
        }
        return acc;
      }, {})
    : {};
  return {
    enabled,
    countrySaved,
    lastPopupCountry,
    syncRetryByCountry: retries,
    floatingButtonPos,
    catalog,
    pendingCoupon
  };
};

export const sanitizeStartPageSettings = (raw: unknown): StartPageSettings => {
  const source = (typeof raw === 'object' && raw !== null) ? raw as Partial<StartPageSettings> : {};
  const showTopSites = typeof source.showTopSites === 'boolean'
    ? source.showTopSites
    : DEFAULT_START_PAGE_SETTINGS.showTopSites;
  const showFavorites = typeof source.showFavorites === 'boolean'
    ? source.showFavorites
    : DEFAULT_START_PAGE_SETTINGS.showFavorites;
  const hidePanels = typeof source.hidePanels === 'boolean'
    ? source.hidePanels
    : DEFAULT_START_PAGE_SETTINGS.hidePanels;
  const showCouponStores = typeof source.showCouponStores === 'boolean'
    ? source.showCouponStores
    : DEFAULT_START_PAGE_SETTINGS.showCouponStores;
  const favoritesRaw = Array.isArray(source.favorites) ? source.favorites : DEFAULT_START_PAGE_SETTINGS.favorites;
  const dedup = new Map<string, StartPageFavorite>();
  for (const item of favoritesRaw) {
    let origin: string | null = null;
    let faviconId: string | null | undefined;
    if (typeof item === 'string') {
      origin = normalizeStartPageFavorite(item);
    } else if (item && typeof item === 'object') {
      const rawOrigin = (item as { origin?: unknown }).origin;
      origin = normalizeStartPageFavorite(rawOrigin);
      const rawFavicon = (item as { faviconId?: unknown }).faviconId;
      faviconId = typeof rawFavicon === 'string' && rawFavicon.trim().length > 0 ? rawFavicon : null;
    }
    if (!origin) continue;
    if (!dedup.has(origin)) {
      dedup.set(origin, { origin, faviconId: faviconId ?? null });
    } else if (faviconId) {
      const existing = dedup.get(origin);
      if (existing && !existing.faviconId) {
        dedup.set(origin, { ...existing, faviconId });
      }
    }
  }
  return {
    showTopSites,
    showFavorites,
    hidePanels,
    showCouponStores,
    favorites: Array.from(dedup.values())
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
  const networkSource = (source.network && typeof source.network === 'object') ? source.network : {};
  const network = sanitizeNetworkSettings(networkSource);
  const savings = sanitizeSavingsSettings(source.savings);
  const startPage = sanitizeStartPageSettings(source.startPage);
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
    network,
    savings,
    startPage,
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

const TEMP_CLEANUP_AGE_MS = 10 * 60 * 1000;

const cleanupTempFilesFor = async (file: string): Promise<void> => {
  const dir = path.dirname(file);
  const base = path.basename(file);
  let entries: Array<{ name: string; isFile: () => boolean }> = [];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const now = Date.now();
  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isFile()) return;
      const name = entry.name;
      if (!name.startsWith(`${base}.`) || !name.endsWith('.tmp')) return;
      const fullPath = path.join(dir, name);
      try {
        const stat = await fsp.stat(fullPath);
        if (now - stat.mtimeMs < TEMP_CLEANUP_AGE_MS) return;
        await fsp.unlink(fullPath);
      } catch {
        // ignore cleanup failures
      }
    })
  );
};

const writeJsonAtomic = async (file: string, value: unknown): Promise<void> => {
  const dir = path.dirname(file);
  const tmpFile = `${file}.${process.pid}.${Date.now()}_${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(tmpFile, JSON.stringify(value, null, 2), 'utf8');
  await fsp.rename(tmpFile, file);
  void cleanupTempFilesFor(file);
};

export async function readSettingsState(): Promise<SettingsState> {
  const targetFile = getSettingsFilePath();
  const backupFile = getBackupSettingsFilePath();

  void cleanupTempFilesFor(targetFile);
  void cleanupTempFilesFor(backupFile);

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
