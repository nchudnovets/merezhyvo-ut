import { session as electronSession, type Session, type OnBeforeSendHeadersListenerDetails, type OnHeadersReceivedListenerDetails, webContents } from 'electron';
import { getCookiePrivacyState, onCookiePrivacyChange } from './cookie-settings';
import { getTopLevelHostForRequest, rememberTopLevelHost } from './windows';

type Policy = {
  blockThirdParty: boolean;
  exceptions: Record<string, boolean>;
};

export type CookieBlockStatus = {
  blockThirdParty: boolean;
  exceptionAllowed: boolean;
  siteHost: string | null;
  blockedTotal: number;
};

type CookieStats = {
  siteHost: string | null;
  blockedTotal: number;
};

const stateCache: {
  policy: Policy;
} = {
  policy: { blockThirdParty: false, exceptions: {} }
};

const statsByWcId = new Map<number, CookieStats>();

const normalizeHost = (host: string | null | undefined): string | null => {
  if (!host || typeof host !== 'string') return null;
  const trimmed = host.trim().toLowerCase();
  return trimmed || null;
};

const isSubdomainOrSame = (host: string | null | undefined, top: string | null | undefined): boolean => {
  if (!host || !top) return false;
  if (host === top) return true;
  return host.endsWith(`.${top}`);
};

const loadPolicy = async (): Promise<void> => {
  try {
    const state = await getCookiePrivacyState();
    stateCache.policy = {
      blockThirdParty: state.blockThirdParty,
      exceptions: { ...(state.exceptions?.thirdPartyAllow ?? {}) }
    };
  } catch {
    // noop
  }
};

void loadPolicy();
onCookiePrivacyChange((next) => {
  stateCache.policy = {
    blockThirdParty: next.blockThirdParty,
    exceptions: { ...(next.exceptions?.thirdPartyAllow ?? {}) }
  };
  statsByWcId.forEach((stats) => {
    stats.blockedTotal = 0;
  });
  statsByWcId.forEach((_stats, wcId) => {
    notifyRenderer(wcId);
  });
});

const isThirdParty = (requestHost: string | null | undefined, topLevelHost: string | null | undefined): boolean => {
  if (!requestHost || !topLevelHost) return false;
  return !isSubdomainOrSame(requestHost, topLevelHost);
};

const getStats = (wcId: number): CookieStats => {
  let stats = statsByWcId.get(wcId);
  if (!stats) {
    stats = { siteHost: null, blockedTotal: 0 };
    statsByWcId.set(wcId, stats);
  }
  return stats;
};

const updateStatsForHost = (wcId: number | null | undefined, topLevelHost: string | null | undefined): void => {
  if (!wcId || !Number.isFinite(wcId)) return;
  const normalized = normalizeHost(topLevelHost);
  if (!normalized) return;
  const stats = getStats(wcId);
  if (stats.siteHost !== normalized) {
    stats.siteHost = normalized;
    stats.blockedTotal = 0;
    notifyRenderer(wcId);
  }
};

const hasExceptionForHost = (host: string | null): boolean => {
  if (!host) return false;
  const exceptions = stateCache.policy.exceptions;
  if (exceptions[host]) return true;
  return Object.keys(exceptions).some((key) => key && exceptions[key] && isSubdomainOrSame(host, key));
};

const getEffectivePolicy = (topLevelHost: string | null): 'allow' | 'block-third-party' => {
  const policy = stateCache.policy;
  if (!policy.blockThirdParty) return 'allow';
  if (topLevelHost && policy.exceptions[topLevelHost]) return 'allow';
  return 'block-third-party';
};

const countHeaderValues = (value: string | string[] | undefined): number => {
  if (!value) return 0;
  if (Array.isArray(value)) return value.length;
  return value ? 1 : 0;
};

const countCookieHeader = (details: OnBeforeSendHeadersListenerDetails): number => {
  const headers = details.requestHeaders ?? {};
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'cookie') {
      return countHeaderValues(headers[key] as string | string[] | undefined);
    }
  }
  return 0;
};

const countSetCookieHeader = (details: OnHeadersReceivedListenerDetails): number => {
  const headers = details.responseHeaders ?? {};
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'set-cookie') {
      return countHeaderValues(headers[key] as string | string[] | undefined);
    }
  }
  return 0;
};

export const getCookieStatus = (wcId: number | null | undefined): CookieBlockStatus => {
  const stats = typeof wcId === 'number' ? statsByWcId.get(wcId) : null;
  const siteHost = stats?.siteHost ?? null;
  const blockThirdParty = Boolean(stateCache.policy.blockThirdParty);
  const exceptionAllowed = blockThirdParty ? hasExceptionForHost(siteHost) : false;
  const blockedTotal = blockThirdParty && !exceptionAllowed ? stats?.blockedTotal ?? 0 : 0;
  return {
    blockThirdParty,
    exceptionAllowed,
    siteHost,
    blockedTotal
  };
};

const notifyRenderer = (wcId: number): void => {
  const target = webContents.fromId(wcId);
  if (!target) return;
  const payload = getCookieStatus(wcId);
  try {
    target.send('cookies:statsChanged', payload);
  } catch {
    // ignore
  }
};

const bumpBlockedCount = (wcId: number | null | undefined, delta: number): void => {
  if (!wcId || !Number.isFinite(wcId) || delta <= 0) return;
  const stats = getStats(wcId);
  stats.blockedTotal += delta;
  notifyRenderer(wcId);
};

const stripCookieHeader = (details: OnBeforeSendHeadersListenerDetails) => {
  const headers = { ...details.requestHeaders };
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'cookie') {
      delete headers[key];
    }
  }
  return headers;
};

const stripSetCookieHeader = (details: OnHeadersReceivedListenerDetails) => {
  const headers = { ...details.responseHeaders };
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === 'set-cookie') {
      delete headers[key];
    }
  }
  return headers;
};

export const installCookiePolicy = (targetSession: Session | null | undefined = electronSession.defaultSession): void => {
  if (!targetSession) return;
  const sessionWithFlag = targetSession as Session & { __mzrCookiePolicy?: boolean };
  if (sessionWithFlag.__mzrCookiePolicy) return;
  sessionWithFlag.__mzrCookiePolicy = true;

  targetSession.webRequest.onBeforeSendHeaders((details, callback) => {
    try {
      const wcId = typeof details.webContentsId === 'number' ? details.webContentsId : null;
      const requestHost = normalizeHost(new URL(details.url).hostname);
      if (details.resourceType === 'mainFrame' && requestHost) {
        rememberTopLevelHost(details.webContentsId, requestHost);
      }
      const topHost = normalizeHost(getTopLevelHostForRequest(details));
      updateStatsForHost(wcId, topHost);
      const effective = getEffectivePolicy(topHost);
      if (effective === 'allow') {
        callback({ cancel: false, requestHeaders: details.requestHeaders });
        return;
      }
      const thirdParty = isThirdParty(requestHost, topHost);
      if (thirdParty) {
        const blockedCount = countCookieHeader(details);
        const headers = stripCookieHeader(details);
        if (blockedCount > 0) {
          bumpBlockedCount(wcId, blockedCount);
        }
        callback({ cancel: false, requestHeaders: headers });
      } else {
        callback({ cancel: false, requestHeaders: details.requestHeaders });
      }
    } catch {
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    }
  });

  targetSession.webRequest.onHeadersReceived((details, callback) => {
    try {
      const wcId = typeof details.webContentsId === 'number' ? details.webContentsId : null;
      const responseHost = normalizeHost(new URL(details.url).hostname);
      if (details.resourceType === 'mainFrame' && responseHost) {
        rememberTopLevelHost(details.webContentsId, responseHost);
      }
      const topHost = normalizeHost(getTopLevelHostForRequest(details));
      updateStatsForHost(wcId, topHost);
      const effective = getEffectivePolicy(topHost);
      if (effective === 'allow') {
        callback({ cancel: false, responseHeaders: details.responseHeaders });
        return;
      }
      const thirdParty = isThirdParty(responseHost, topHost);
      if (thirdParty) {
        const blockedCount = countSetCookieHeader(details);
        const headers = stripSetCookieHeader(details);
        if (blockedCount > 0) {
          bumpBlockedCount(wcId, blockedCount);
        }
        callback({ cancel: false, responseHeaders: headers });
      } else {
        callback({ cancel: false, responseHeaders: details.responseHeaders });
      }
    } catch {
      callback({ cancel: false, responseHeaders: details.responseHeaders });
    }
  });
};
