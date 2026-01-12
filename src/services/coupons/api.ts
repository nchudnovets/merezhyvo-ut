import { normalizeCountryCode } from '../../utils/savings';
import type { CouponsForPageResponse } from '../../types/models';

export const COUPONS_API_BASE_URL = 'https://api.merezhyvo.site';
export const COUPONS_X_APP_KEY = '0Ayg3BFHkFsYZgOZ6VZddEPfSynqLDU0GldC3L0QZJg=';
export const COUPONS_X_CLIENT = 'merezhyvo';
export const COUPONS_API_TIMEOUT_MS = 15000;

export type MerchantsCatalogResult =
  | { status: 'ok'; domains: string[]; etag: string | null }
  | { status: 'not_modified'; etag: string | null }
  | { status: 'syncing'; retryAfterSeconds: number }
  | { status: 'error'; error?: string };

export type FetchCouponsForPageResult =
  | { status: 'ok'; data: CouponsForPageResponse }
  | { status: 'syncing'; retryAfterSeconds: number }
  | { status: 'error'; error: string };

const parseRetryAfterSeconds = (payload: unknown): number => {
  if (payload && typeof payload === 'object') {
    const record = payload as { retryAfterSeconds?: unknown };
    const raw = record.retryAfterSeconds;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return Math.max(1, Math.round(raw));
    }
  }
  return 120;
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

const extractDomain = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.domain === 'string') return record.domain;
    if (typeof record.hostname === 'string') return record.hostname;
    if (typeof record.url === 'string') return record.url;
  }
  return null;
};

const parseDomains = (payload: unknown): string[] => {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? Array.isArray((payload as { domains?: unknown }).domains)
        ? (payload as { domains: unknown[] }).domains
        : Array.isArray((payload as { merchants?: unknown }).merchants)
          ? (payload as { merchants: unknown[] }).merchants
          : []
      : [];
  const domains = list
    .map((item) => normalizeDomain(extractDomain(item)))
    .filter((item): item is string => Boolean(item));
  return Array.from(new Set(domains));
};

const getEtag = (response: Response): string | null => (
  response.headers.get('etag') || response.headers.get('ETag')
);

export const fetchMerchantsCatalog = async (
  country: string,
  etag?: string | null,
  clientVersion?: string
): Promise<MerchantsCatalogResult> => {
  const normalizedCountry = normalizeCountryCode(country);
  if (!normalizedCountry) {
    return { status: 'error', error: 'Invalid country code.' };
  }
  const url = new URL('/v1/merchants', COUPONS_API_BASE_URL);
  url.searchParams.set('country', normalizedCountry);

  const headers: Record<string, string> = {
    'X-App-Key': COUPONS_X_APP_KEY,
    'X-Client': 'merezhyvo'
  };
  if (clientVersion) {
    headers['X-Client-Version'] = clientVersion;
  }
  if (etag) {
    headers['If-None-Match'] = etag;
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      cache: 'no-store'
    });

    if (response.status === 200) {
      const payload = await response.json().catch(() => null);
      const domains = parseDomains(payload);
      return { status: 'ok', domains, etag: getEtag(response) };
    }

    if (response.status === 304) {
      return { status: 'not_modified', etag: getEtag(response) ?? etag ?? null };
    }

    if (response.status === 202) {
      const payload = await response.json().catch(() => null);
      const retryAfterSecondsRaw =
        payload && typeof payload === 'object'
          ? (payload as { retryAfterSeconds?: unknown }).retryAfterSeconds
          : null;
      const retryAfterSeconds =
        typeof retryAfterSecondsRaw === 'number' && Number.isFinite(retryAfterSecondsRaw)
          ? Math.max(1, Math.round(retryAfterSecondsRaw))
          : 1200;
      return { status: 'syncing', retryAfterSeconds };
    }

    return { status: 'error', error: `Unexpected status ${response.status}` };
  } catch (err) {
    return { status: 'error', error: String(err) };
  }
};

export const fetchCouponsForPage = async ({
  country,
  url,
  clientVersion
}: {
  country: string;
  url: string;
  clientVersion?: string;
}): Promise<FetchCouponsForPageResult> => {
  const normalizedCountry = normalizeCountryCode(country);
  if (!normalizedCountry) {
    return { status: 'error', error: 'Invalid country code' };
  }
  const endpoint = new URL('/v1/coupons/for-page', COUPONS_API_BASE_URL);
  endpoint.searchParams.set('country', normalizedCountry);
  endpoint.searchParams.set('url', url);

  const headers: Record<string, string> = {
    'X-App-Key': COUPONS_X_APP_KEY,
    'X-Client': COUPONS_X_CLIENT
  };
  if (clientVersion) {
    headers['X-Client-Version'] = clientVersion;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), COUPONS_API_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal,
      cache: 'no-store'
    });
    if (response.status === 200) {
      const data = await response.json().catch(() => null);
      if (data && typeof data === 'object') {
        return { status: 'ok', data: data as CouponsForPageResponse };
      }
      return { status: 'error', error: 'Invalid response data' };
    }
    if (response.status === 202) {
      const payload = await response.json().catch(() => null);
      return { status: 'syncing', retryAfterSeconds: parseRetryAfterSeconds(payload) };
    }
    return { status: 'error', error: `Unexpected status ${response.status}` };
  } catch (err) {
    if (controller.signal.aborted) {
      return { status: 'error', error: 'Request timed out' };
    }
    return { status: 'error', error: String(err) };
  } finally {
    window.clearTimeout(timeout);
  }
};
