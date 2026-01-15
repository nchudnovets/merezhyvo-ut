import type { MerchantsCatalogCache, SavingsSettings } from '../types/models';

export const DEFAULT_SAVINGS_CATALOG: MerchantsCatalogCache = {
  country: null,
  merchants: [],
  updatedAt: null,
  etag: null,
  nextAllowedFetchAt: null,
  lastFetchAttemptAt: null
};

export const DEFAULT_SAVINGS_SETTINGS: SavingsSettings = {
  enabled: true,
  countrySaved: null,
  lastPopupCountry: null,
  syncRetryByCountry: {},
  floatingButtonPos: null,
  catalog: { ...DEFAULT_SAVINGS_CATALOG },
  pendingCoupon: null
};

export const normalizeCountryCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  if (trimmed.length !== 2) return null;
  if (!/^[A-Z]{2}$/.test(trimmed)) return null;
  if (trimmed === 'RU') return null;
  return trimmed;
};

export const getEffectiveCountry = (
  countrySaved?: string | null,
  lastPopupCountry?: string | null,
  detectedCountry?: string | null
): string => (
  normalizeCountryCode(countrySaved) ??
  normalizeCountryCode(lastPopupCountry) ??
  normalizeCountryCode(detectedCountry) ??
  'US'
);

export const getPopupCountry = (
  settings: SavingsSettings,
  detectedCountry?: string | null
): string => getEffectiveCountry(settings.countrySaved, settings.lastPopupCountry, detectedCountry);

export const getRetryTimestamp = (settings: SavingsSettings, country: string): string | null => {
  const code = normalizeCountryCode(country);
  if (!code) return null;
  const next = settings.syncRetryByCountry[code];
  if (!next) return null;
  return normalizeIsoDate(next) ?? null;
};

const normalizeIsoDate = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toISOString();
};

export const mergeSavingsSettings = (
  current: SavingsSettings,
  patch: Partial<SavingsSettings>
): SavingsSettings => ({
  ...current,
  ...patch,
  pendingCoupon: patch.pendingCoupon !== undefined ? patch.pendingCoupon : current.pendingCoupon,
  catalog: patch.catalog ? { ...current.catalog, ...patch.catalog } : current.catalog,
  syncRetryByCountry: patch.syncRetryByCountry
    ? { ...current.syncRetryByCountry, ...patch.syncRetryByCountry }
    : current.syncRetryByCountry
});
