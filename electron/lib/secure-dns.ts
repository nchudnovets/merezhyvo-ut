import { session, type Session } from 'electron';

import {
  readSettingsState,
  writeSettingsState,
  sanitizeSecureDnsSettings,
  type SecureDnsSettings
} from './shortcuts';

const TOR_PARTITION = 'mzr-tor';

const PRESET_SERVERS: Record<string, string> = {
  cloudflare: 'https://cloudflare-dns.com/dns-query',
  quad9: 'https://dns.quad9.net/dns-query',
  google: 'https://dns.google/dns-query',
  mullvad: 'https://doh.mullvad.net/dns-query'
};

const normalizeHttpsUrl = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
};

const resolveSecureDnsServers = (settings: SecureDnsSettings): string[] | null => {
  if (settings.provider === 'auto') return null;
  const preset = PRESET_SERVERS[settings.provider as keyof typeof PRESET_SERVERS];
  if (preset) {
    return [preset];
  }
  if (settings.provider === 'nextdns') {
    const id = (settings.nextdnsId || '').trim();
    if (!id) return [];
    return [`https://dns.nextdns.io/${encodeURIComponent(id)}`];
  }
  if (settings.provider === 'custom') {
    const url = normalizeHttpsUrl(settings.customUrl || '');
    return url ? [url] : [];
  }
  return null;
};

type HostResolverSession = Session & {
  configureHostResolver?: (config: { secureDnsMode: 'off' | 'automatic' | 'secure'; secureDnsServers?: string[] }) => void;
};

const applyHostResolver = (target: Session | null, config: { secureDnsMode: 'off' | 'automatic' | 'secure'; secureDnsServers?: string[] }): void => {
  const resolverSession = target as HostResolverSession | null;
  if (!resolverSession?.configureHostResolver) return;
  try {
    resolverSession.configureHostResolver(config);
  } catch (err) {
    console.error('[merezhyvo] secure DNS apply failed', err);
  }
};

export const applySecureDnsSettings = async (
  settings: SecureDnsSettings,
  torEnabled: boolean
): Promise<void> => {
  const useDns = settings.enabled && !torEnabled;
  const mode: 'off' | 'automatic' | 'secure' = useDns
    ? (settings.mode === 'secure' ? 'secure' : 'automatic')
    : 'off';
  const servers = useDns ? resolveSecureDnsServers(settings) : null;

  const config: { secureDnsMode: 'off' | 'automatic' | 'secure'; secureDnsServers?: string[] } = {
    secureDnsMode: mode
  };
  if (useDns && servers && servers.length > 0) {
    config.secureDnsServers = servers;
  }
  if (useDns && servers && servers.length === 0 && settings.provider !== 'auto') {
    config.secureDnsMode = 'off';
    delete config.secureDnsServers;
  }

  applyHostResolver(session.defaultSession ?? null, config);
  const torSession = session.fromPartition(TOR_PARTITION);
  applyHostResolver(torSession, { secureDnsMode: 'off' });
};

export const getSecureDnsSettings = async (): Promise<SecureDnsSettings> => {
  const state = await readSettingsState();
  return sanitizeSecureDnsSettings(state.network?.secureDns);
};

export const applySecureDnsFromSettings = async (torEnabled: boolean): Promise<void> => {
  const settings = await getSecureDnsSettings();
  await applySecureDnsSettings(settings, torEnabled);
};

export const updateSecureDnsSettings = async (
  patch: Partial<SecureDnsSettings>,
  torEnabled: boolean
): Promise<{ ok: boolean; settings?: SecureDnsSettings; error?: string }> => {
  try {
    const state = await readSettingsState();
    const current = sanitizeSecureDnsSettings(state.network?.secureDns);
    const next = sanitizeSecureDnsSettings({ ...current, ...(patch ?? {}) });
    const nextState = {
      ...state,
      network: { ...(state.network ?? {}), secureDns: next }
    };
    await writeSettingsState(nextState);
    await applySecureDnsSettings(next, torEnabled);
    return { ok: true, settings: next };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
};
