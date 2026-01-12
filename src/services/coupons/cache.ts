import type { CouponsForPageResponse } from '../../types/models';
import { normalizeCountryCode } from '../../utils/savings';

const COUPONS_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

type CouponsCacheEntry = {
  data: CouponsForPageResponse;
  fetchedAt: string;
  expiresAt: string;
};

const cache = new Map<string, CouponsCacheEntry>();

const normalizeHostname = (value: string): string => value.trim().toLowerCase();
const getCacheKey = (country: string, hostname: string): string => `${country.toUpperCase()}::${normalizeHostname(hostname)}`;

export const getCachedCouponsForPage = (
  country: string,
  hostname: string
): CouponsCacheEntry | null => {
  const normalizedCountry = normalizeCountryCode(country);
  if (!normalizedCountry) return null;
  const key = getCacheKey(normalizedCountry, hostname);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.parse(entry.expiresAt) <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry;
};

export const setCachedCouponsForPage = (country: string, hostname: string, data: CouponsForPageResponse): void => {
  const normalizedCountry = normalizeCountryCode(country);
  if (!normalizedCountry) return;
  const key = getCacheKey(normalizedCountry, hostname);
  const fetchedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + COUPONS_CACHE_TTL_MS).toISOString();
  cache.set(key, { data, fetchedAt, expiresAt });
};

export const clearCouponsCache = (): void => {
  cache.clear();
};
