import { session as electronSession, type Session, type OnBeforeSendHeadersListenerDetails, type OnHeadersReceivedListenerDetails } from 'electron';
import { getCookiePrivacyState, onCookiePrivacyChange } from './cookie-settings';
import { getTopLevelHostForRequest, rememberTopLevelHost } from './windows';

type Policy = {
  blockThirdParty: boolean;
  exceptions: Record<string, boolean>;
};

const stateCache: {
  policy: Policy;
} = {
  policy: { blockThirdParty: true, exceptions: {} }
};

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
});

const isThirdParty = (requestHost: string | null | undefined, topLevelHost: string | null | undefined): boolean => {
  if (!requestHost || !topLevelHost) return false;
  return !isSubdomainOrSame(requestHost, topLevelHost);
};

const getEffectivePolicy = (topLevelHost: string | null): 'allow' | 'block-third-party' => {
  const policy = stateCache.policy;
  if (!policy.blockThirdParty) return 'allow';
  if (topLevelHost && policy.exceptions[topLevelHost]) return 'allow';
  return 'block-third-party';
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
      const requestHost = normalizeHost(new URL(details.url).hostname);
      if (details.resourceType === 'mainFrame' && requestHost) {
        rememberTopLevelHost(details.webContentsId, requestHost);
      }
      const topHost = normalizeHost(getTopLevelHostForRequest(details));
      const effective = getEffectivePolicy(topHost);
      if (effective === 'allow') {
        callback({ cancel: false, requestHeaders: details.requestHeaders });
        return;
      }
      const thirdParty = isThirdParty(requestHost, topHost);
      if (thirdParty) {
        const headers = stripCookieHeader(details);
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
      const responseHost = normalizeHost(new URL(details.url).hostname);
      if (details.resourceType === 'mainFrame' && responseHost) {
        rememberTopLevelHost(details.webContentsId, responseHost);
      }
      const topHost = normalizeHost(getTopLevelHostForRequest(details));
      const effective = getEffectivePolicy(topHost);
      if (effective === 'allow') {
        callback({ cancel: false, responseHeaders: details.responseHeaders });
        return;
      }
      const thirdParty = isThirdParty(responseHost, topHost);
      if (thirdParty) {
        const headers = stripSetCookieHeader(details);
        callback({ cancel: false, responseHeaders: headers });
      } else {
        callback({ cancel: false, responseHeaders: details.responseHeaders });
      }
    } catch {
      callback({ cancel: false, responseHeaders: details.responseHeaders });
    }
  });
};
