import { app, type ConfigureHostResolverOptions } from 'electron';

import {
  readSettingsState,
  writeSettingsState,
  sanitizeSecureDnsSettings,
  type SecureDnsSettings
} from './shortcuts';

type HostResolverOptions = ConfigureHostResolverOptions;

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

const ensureDohTemplate = (raw: string): string => {
  if (raw.includes('{')) return raw;
  try {
    const url = new URL(raw);
    const suffix = url.search ? '{&dns}' : '{?dns}';
    return `${url.toString()}${suffix}`;
  } catch {
    return raw;
  }
};

const resolveSecureDnsServers = (settings: SecureDnsSettings): string[] | null => {
  if (settings.provider === 'auto') return null;
  const preset = PRESET_SERVERS[settings.provider as keyof typeof PRESET_SERVERS];
  if (preset) {
    return [ensureDohTemplate(preset)];
  }
  if (settings.provider === 'nextdns') {
    const id = (settings.nextdnsId || '').trim();
    if (!id) return [];
    return [ensureDohTemplate(`https://dns.nextdns.io/${encodeURIComponent(id)}`)];
  }
  if (settings.provider === 'custom') {
    const url = normalizeHttpsUrl(settings.customUrl || '');
    return url ? [ensureDohTemplate(url)] : [];
  }
  return null;
};

export type SecureDnsResolvedConfig = {
  mode: 'off' | 'automatic' | 'secure';
  servers: string[] | null;
};

export const resolveSecureDnsConfig = (
  settings: SecureDnsSettings,
  torEnabled: boolean
): SecureDnsResolvedConfig => {
  const useDns = settings.enabled && !torEnabled;
  const mode: 'off' | 'automatic' | 'secure' = useDns
    ? (settings.mode === 'secure' ? 'secure' : 'automatic')
    : 'off';
  const servers = useDns ? resolveSecureDnsServers(settings) : null;

  if (useDns && servers && servers.length === 0 && settings.provider !== 'auto') {
    return { mode: 'off', servers: null };
  }

  return { mode, servers };
};

const applyHostResolver = async (options: HostResolverOptions): Promise<void> => {
  try {
    await app.whenReady();
    await app.configureHostResolver(options);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // ignore configure failures
  }
};

export const applySecureDnsSettings = async (settings: SecureDnsSettings, torEnabled: boolean): Promise<void> => {
  const resolved = resolveSecureDnsConfig(settings, torEnabled);

  const hostResolver: HostResolverOptions = {
    secureDnsMode: resolved.mode,
    enableBuiltInResolver: resolved.mode !== 'off',
  };

  if (resolved.mode === 'off') {
    hostResolver.secureDnsServers = [];
  } else if (resolved.servers === null) {
    hostResolver.secureDnsServers = [];
  } else {
    hostResolver.secureDnsServers = resolved.servers;
  }

  await applyHostResolver(hostResolver);
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
