import { readSettingsState, writeSettingsState, type CookiePrivacySettings } from './shortcuts';
import { session } from 'electron';
import { EventEmitter } from 'events';

const emitter = new EventEmitter();
export const onCookiePrivacyChange = (handler: (state: CookiePrivacySettings) => void): (() => void) => {
  emitter.on('change', handler);
  return () => emitter.off('change', handler);
};
const emitChange = (state: CookiePrivacySettings): void => {
  emitter.emit('change', state);
};

export type CookieExceptions = Record<string, boolean>;

export type CookiePrivacyState = CookiePrivacySettings;

const normalizeHost = (host: string | null | undefined): string | null => {
  if (!host || typeof host !== 'string') return null;
  const trimmed = host.trim().toLowerCase();
  return trimmed || null;
};

const isSubdomainOrSame = (candidate: string, root: string): boolean => {
  if (candidate === root) return true;
  return candidate.endsWith(`.${root}`);
};

const clearCookiesForHost = async (host: string): Promise<void> => {
  const sess = session.defaultSession;
  if (!sess?.cookies) return;
  const cookies = await sess.cookies.get({});
  const tasks: Promise<void>[] = [];
  for (const cookie of cookies) {
    const rawDomain = cookie.domain || '';
    const normalizedDomain = rawDomain.startsWith('.') ? rawDomain.slice(1).toLowerCase() : rawDomain.toLowerCase();
    // Remove cookies for this host/subdomains AND any third-party cookies stored while exception was active.
    // This is intentionally aggressive to avoid stale third-party cookies lingering after an exception is removed.
    const scheme = cookie.secure ? 'https' : 'http';
    const path = cookie.path || '/';
    const targetHost = normalizedDomain || host;
    const url = `${scheme}://${targetHost}${path.startsWith('/') ? path : `/${path}`}`;
    try {
      tasks.push(sess.cookies.remove(url, cookie.name));
    } catch {
      // ignore failed remove for individual cookie
    }
  }
  await Promise.allSettled(tasks);
};

export async function getCookiePrivacyState(): Promise<CookiePrivacyState> {
  const settings = await readSettingsState();
  const cookies = settings.privacy?.cookies;
  return {
    blockThirdParty: cookies?.blockThirdParty ?? true,
    exceptions: {
      thirdPartyAllow: { ...(cookies?.exceptions?.thirdPartyAllow ?? {}) }
    }
  };
}

export async function setBlockThirdParty(enabled: boolean): Promise<CookiePrivacyState> {
  const settings = await readSettingsState();
  const cookies = settings.privacy?.cookies ?? { blockThirdParty: true, exceptions: { thirdPartyAllow: {} } };
  const next = {
    ...cookies,
    blockThirdParty: Boolean(enabled),
    exceptions: {
      thirdPartyAllow: { ...(cookies.exceptions?.thirdPartyAllow ?? {}) }
    }
  };
  emitChange(next);
  try {
    await writeSettingsState({ ...settings, privacy: { ...(settings.privacy ?? {}), cookies: next } });
  } catch {
    // persist best-effort
  }
  return next;
}

export async function setThirdPartyException(host: string | null | undefined, allow: boolean): Promise<CookiePrivacyState> {
  const normalizedHost = normalizeHost(host);
  const state = await getCookiePrivacyState();
  const nextMap = { ...(state.exceptions.thirdPartyAllow ?? {}) };
  if (normalizedHost) {
    if (allow) {
      nextMap[normalizedHost] = true;
    } else {
      delete nextMap[normalizedHost];
    }
  }
  const next: CookiePrivacyState = {
    blockThirdParty: state.blockThirdParty,
    exceptions: { thirdPartyAllow: nextMap }
  };
  emitChange(next);
  try {
    await writeSettingsState({ privacy: { cookies: next } });
  } catch {
    // best-effort
  }
  if (normalizedHost && !allow) {
    try {
      await clearCookiesForHost(normalizedHost);
    } catch {
      // best-effort
    }
  }
  return next;
}

export async function clearThirdPartyExceptions(): Promise<CookiePrivacyState> {
  const state = await getCookiePrivacyState();
  const next: CookiePrivacyState = {
    blockThirdParty: state.blockThirdParty,
    exceptions: { thirdPartyAllow: {} }
  };
  emitChange(next);
  try {
    await writeSettingsState({ privacy: { cookies: next } });
  } catch {
    // best-effort
  }
  return next;
}

export async function listThirdPartyExceptions(): Promise<Record<string, boolean>> {
  const state = await getCookiePrivacyState();
  return { ...(state.exceptions.thirdPartyAllow ?? {}) };
}
