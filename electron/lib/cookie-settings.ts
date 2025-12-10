import { readSettingsState, writeSettingsState, type CookiePrivacySettings } from './shortcuts';
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

export async function getCookiePrivacyState(): Promise<CookiePrivacyState> {
  const settings = await readSettingsState();
  const cookies = settings.privacy?.cookies;
  return {
    blockThirdParty: cookies?.blockThirdParty ?? false,
    exceptions: {
      thirdPartyAllow: { ...(cookies?.exceptions?.thirdPartyAllow ?? {}) }
    }
  };
}

export async function setBlockThirdParty(enabled: boolean): Promise<CookiePrivacyState> {
  const settings = await readSettingsState();
  const cookies = settings.privacy?.cookies ?? { blockThirdParty: false, exceptions: { thirdPartyAllow: {} } };
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
