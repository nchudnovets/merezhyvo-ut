import https from 'https';
import {
  readSettingsState,
  writeSettingsState,
  sanitizeNetworkSettings,
  type NetworkSettings
} from './shortcuts';

export type CountryDetectionResult = {
  countryCode: string | null;
  ip: string | null;
  timezone: string | null;
};

type CountryDetectionOptions = {
  ip?: string | null;
  persist?: boolean;
};

const SUCCESS_TTL_MS = 2 * 60 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 15 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 2500;

const inFlightByIp = new Map<string, Promise<CountryDetectionResult>>();
const failureAtByIp = new Map<string, number>();
let latestDetectionResult: CountryDetectionResult | null = null;

const normalizeCountryCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : null;
};

const normalizeIp = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeTimezone = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return null;
  if (trimmed === 'UTC') return trimmed;
  return /^[A-Za-z]+(?:[_-][A-Za-z]+)*\/[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)*$/.test(trimmed)
    ? trimmed
    : null;
};

const defaultTimezoneForCountry = (countryCode: string | null): string | null => {
  switch (countryCode) {
    case 'FR': return 'Europe/Paris';
    case 'UA': return 'Europe/Kyiv';
    case 'PL': return 'Europe/Warsaw';
    case 'DE': return 'Europe/Berlin';
    case 'NL': return 'Europe/Amsterdam';
    case 'BE': return 'Europe/Brussels';
    case 'ES': return 'Europe/Madrid';
    case 'IT': return 'Europe/Rome';
    case 'GB': return 'Europe/London';
    case 'US': return 'America/New_York';
    case 'CA': return 'America/Toronto';
    default: return null;
  }
};

const parseTimestamp = (value: unknown): number => {
  if (typeof value !== 'string') return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fromNetworkSettings = (settings: NetworkSettings): CountryDetectionResult => ({
  countryCode: normalizeCountryCode(settings.detectedCountry),
  ip: normalizeIp(settings.detectedIp),
  timezone: normalizeTimezone(settings.detectedTimezone)
});

const getFreshCachedResult = async (expectedIp: string | null): Promise<CountryDetectionResult | null> => {
  const state = await readSettingsState();
  const network = sanitizeNetworkSettings(state.network);
  const detectedAt = parseTimestamp(network.detectedAt);
  if (!detectedAt || Date.now() - detectedAt > SUCCESS_TTL_MS) return null;

  const cached = fromNetworkSettings(network);
  if (!cached.countryCode) return null;
  if (expectedIp && cached.ip !== expectedIp) return null;
  return cached;
};

const requestJson = <T>(url: string, timeoutMs = PROVIDER_TIMEOUT_MS): Promise<T | null> => {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        resolve(null);
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body) as T);
        } catch {
          resolve(null);
        }
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
  });
};

const detectFromProviders = async (ip: string | null): Promise<CountryDetectionResult> => {
  let fallbackCountry: string | null = null;
  let detectedIp: string | null = ip;
  if (!ip) {
    const countryIs = await requestJson<{ ip?: unknown; country?: unknown }>('https://api.country.is/');
    const countryCode = normalizeCountryCode(countryIs?.country);
    if (countryCode) {
      fallbackCountry = countryCode;
      detectedIp = normalizeIp(countryIs?.ip);
    }
  }

  const providerIp = ip ?? detectedIp;
  const ipapiUrl = providerIp
    ? `https://ipapi.co/${encodeURIComponent(providerIp)}/json/`
    : 'https://ipapi.co/json/';
  const ipapi = await requestJson<{ ip?: unknown; country_code?: unknown; timezone?: unknown }>(ipapiUrl);
  const ipapiCountry = normalizeCountryCode(ipapi?.country_code);
  if (ipapiCountry) {
    return {
      countryCode: ipapiCountry,
      ip: providerIp ?? normalizeIp(ipapi?.ip),
      timezone: normalizeTimezone(ipapi?.timezone) ?? defaultTimezoneForCountry(ipapiCountry)
    };
  }

  const ipwhoUrl = providerIp
    ? `https://ipwho.is/${encodeURIComponent(providerIp)}`
    : 'https://ipwho.is/';
  const ipwho = await requestJson<{ ip?: unknown; country_code?: unknown; success?: unknown; timezone?: unknown }>(ipwhoUrl);
  if (ipwho?.success !== false) {
    const ipwhoCountry = normalizeCountryCode(ipwho?.country_code);
    if (ipwhoCountry) {
      const timezone = typeof ipwho?.timezone === 'object' && ipwho.timezone !== null
        ? normalizeTimezone((ipwho.timezone as { id?: unknown }).id)
        : normalizeTimezone(ipwho?.timezone);
      return {
        countryCode: ipwhoCountry,
        ip: providerIp ?? normalizeIp(ipwho?.ip),
        timezone: timezone ?? defaultTimezoneForCountry(ipwhoCountry)
      };
    }
  }

  return {
    countryCode: fallbackCountry,
    ip: detectedIp,
    timezone: defaultTimezoneForCountry(fallbackCountry)
  };
};

const readEnvOverride = (): CountryDetectionResult | null => {
  const raw = process.env.MEREZHYVO_E2E_GEO_JSON ?? process.env.APP_E2E_GEO_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { countryCode?: unknown; country?: unknown; ip?: unknown };
    return {
      countryCode: normalizeCountryCode(parsed.countryCode ?? parsed.country),
      ip: normalizeIp(parsed.ip),
      timezone: normalizeTimezone((parsed as { timezone?: unknown; timeZone?: unknown }).timezone ?? (parsed as { timeZone?: unknown }).timeZone)
    };
  } catch {
    return { countryCode: null, ip: null, timezone: null };
  }
};

const persistDetectionResult = async (result: CountryDetectionResult): Promise<void> => {
  const state = await readSettingsState();
  const current = sanitizeNetworkSettings(state.network);
  await writeSettingsState({
    network: sanitizeNetworkSettings({
      ...current,
      detectedIp: result.ip,
      detectedCountry: result.countryCode,
      detectedTimezone: result.timezone,
      detectedAt: new Date().toISOString()
    })
  });
};

export const detectCountryFromIp = async (options?: string | null | CountryDetectionOptions): Promise<CountryDetectionResult> => {
  const expectedIp = normalizeIp(typeof options === 'object' && options !== null ? options.ip : options);
  const shouldPersist = typeof options === 'object' && options !== null && options.persist === false ? false : true;
  const override = readEnvOverride();
  if (override) {
    latestDetectionResult = override;
    if (shouldPersist && override.countryCode) {
      await persistDetectionResult(override);
    }
    return override;
  }

  const cached = await getFreshCachedResult(expectedIp);
  if (cached?.timezone) {
    latestDetectionResult = cached;
    return cached;
  }

  const inFlightKey = `${expectedIp ?? ''}|${shouldPersist ? 'persist' : 'volatile'}`;
  const lastFailureAt = failureAtByIp.get(inFlightKey) ?? 0;
  if (lastFailureAt && Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) {
    return { countryCode: null, ip: expectedIp, timezone: null };
  }

  let inFlight = inFlightByIp.get(inFlightKey) ?? null;
  if (!inFlight) {
    inFlight = (async () => {
      const result = await detectFromProviders(expectedIp ?? cached?.ip ?? null);
      latestDetectionResult = result;
      if (result.countryCode) {
        if (shouldPersist) {
          await persistDetectionResult(result);
        }
        failureAtByIp.delete(inFlightKey);
      } else {
        failureAtByIp.set(inFlightKey, Date.now());
      }
      return result;
    })().finally(() => {
      inFlightByIp.delete(inFlightKey);
    });
    inFlightByIp.set(inFlightKey, inFlight);
  }

  return inFlight;
};

export const getKnownNetworkTimezone = async (): Promise<string | null> => {
  const latestTimezone = normalizeTimezone(latestDetectionResult?.timezone);
  if (latestTimezone) return latestTimezone;
  const latestCountryTimezone = defaultTimezoneForCountry(normalizeCountryCode(latestDetectionResult?.countryCode));
  if (latestCountryTimezone) return latestCountryTimezone;
  for (const pending of inFlightByIp.values()) {
    try {
      const result = await pending;
      const pendingTimezone = normalizeTimezone(result.timezone);
      if (pendingTimezone) return pendingTimezone;
      const pendingCountryTimezone = defaultTimezoneForCountry(normalizeCountryCode(result.countryCode));
      if (pendingCountryTimezone) return pendingCountryTimezone;
    } catch {
      // ignore pending lookup failures
    }
  }
  const cached = await getFreshCachedResult(null);
  if (cached?.timezone) {
    latestDetectionResult = cached;
    return cached.timezone;
  }
  const cachedCountryTimezone = defaultTimezoneForCountry(normalizeCountryCode(cached?.countryCode));
  if (cachedCountryTimezone) {
    latestDetectionResult = cached;
    return cachedCountryTimezone;
  }
  return null;
};

export const fetchDirectIp = async (): Promise<string> => {
  const result = await requestJson<{ ip?: unknown }>('https://api.ipify.org?format=json');
  return normalizeIp(result?.ip) ?? '';
};
