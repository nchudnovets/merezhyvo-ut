import { session } from 'electron';
import { listHistoryHosts, remove as removeHistory } from './history';

export type SiteDataEntry = {
  host: string;
  hasCookies: boolean;
  hasSiteStorage: boolean;
  hasHistory: boolean;
};

const normalizeHost = (host: string | null | undefined): string | null => {
  if (!host) return null;
  const trimmed = host.trim().toLowerCase();
  if (!trimmed) return null;
  let safe = trimmed.startsWith('.') ? trimmed.slice(1) : trimmed;
  if (safe.startsWith('www.') && safe.length > 4) {
    safe = safe.slice(4);
  }
  return safe;
};

const getAllSessions = (): Array<Electron.Session> => {
  const sessions: Array<Electron.Session> = [];
  try {
    const defaultSession = session.defaultSession;
    if (defaultSession) sessions.push(defaultSession);
  } catch {
    // ignore
  }
  return sessions;
};

export const listSiteDataEntries = async (): Promise<SiteDataEntry[]> => {
  const map = new Map<string, { hasCookies: boolean; hasSiteStorage: boolean; hasHistory: boolean }>();
  try {
    const historyHosts = await listHistoryHosts();
    for (const host of historyHosts) {
      const normalized = normalizeHost(host);
      if (normalized) {
        const prev = map.get(normalized) ?? { hasCookies: false, hasSiteStorage: false, hasHistory: false };
        map.set(normalized, { ...prev, hasHistory: true });
      }
    }
  } catch {
    // ignore history failures
  }

  try {
    const sessions = getAllSessions();
    for (const sess of sessions) {
      const cookies = await sess.cookies.get({});
      for (const cookie of cookies) {
        const domain = normalizeHost(cookie.domain);
        if (domain) {
          const prev = map.get(domain) ?? { hasCookies: false, hasSiteStorage: false, hasHistory: false };
          map.set(domain, { ...prev, hasCookies: true, hasSiteStorage: true });
        }
      }
    }
  } catch {
    // ignore cookie failures
  }

  return Array.from(map.entries())
    .filter(Boolean)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([host, flags]) => ({
      host,
      hasCookies: flags.hasCookies,
      hasSiteStorage: flags.hasSiteStorage,
      hasHistory: flags.hasHistory
    }));
};

export const clearCookiesForHost = async (host: string): Promise<void> => {
  const normalized = normalizeHost(host);
  if (!normalized) return;
  const sessions = getAllSessions();
  const hostVariants = new Set<string>([normalized]);
  hostVariants.add(`www.${normalized}`);

  const removalTasks: Promise<unknown>[] = [];
  for (const sess of sessions) {
    // Extra pass to remove cookies with broader domains.
    removalTasks.push(
      (async () => {
        try {
          const cookies = await sess.cookies.get({});
          const tasks: Promise<unknown>[] = [];
          for (const cookie of cookies) {
            const domain = normalizeHost(cookie.domain);
            if (!domain) continue;
            if (domain === normalized || domain.endsWith(`.${normalized}`) || normalized.endsWith(`.${domain}`)) {
              const scheme = cookie.secure ? 'https' : 'http';
              const targetHost = domain;
              const path = cookie.path && cookie.path.startsWith('/') ? cookie.path : `/${cookie.path ?? ''}`;
              const url = `${scheme}://${targetHost}${path}`;
              tasks.push(
                sess.cookies.remove(url, cookie.name).catch(() => {
                  /* ignore */
                })
              );
            }
          }
          if (tasks.length) {
            await Promise.allSettled(tasks);
          }
        } catch {
          // ignore
        }
      })()
    );
  }

  await Promise.allSettled(removalTasks);
};

export const clearHistoryForHost = async (host: string): Promise<void> => {
  const normalized = normalizeHost(host);
  if (!normalized) return;
  const targets = [`https://${normalized}`, `http://${normalized}`];
  for (const origin of targets) {
    try {
      await removeHistory({ origin });
    } catch {
      // ignore per-origin failure
    }
  }
};

export const clearSiteStorageForHost = async (host: string): Promise<void> => {
  const normalized = normalizeHost(host);
  if (!normalized) return;
  const sessions = getAllSessions();
  const hostVariants = new Set<string>([normalized, `www.${normalized}`]);
  const origins = Array.from(hostVariants).flatMap((h) => [`https://${h}`, `http://${h}`]);
  type ClearStorageOpts = NonNullable<Parameters<Electron.Session['clearStorageData']>[0]>;
  const storages: ClearStorageOpts['storages'] = [
    'filesystem',
    'indexdb',
    'localstorage',
    'shadercache',
    'websql',
    'serviceworkers',
    'cachestorage'
  ];
  const tasks: Promise<unknown>[] = [];
  for (const sess of sessions) {
    for (const origin of origins) {
      tasks.push(
        sess.clearStorageData({
          origin,
          storages
        })
      );
    }
  }
  await Promise.allSettled(tasks);
};

export const clearSiteDataGlobal = async (opts: {
  cookiesAndSiteData?: boolean;
  cache?: boolean;
  history?: boolean;
}): Promise<void> => {
  const sessions = getAllSessions();
  type ClearStorageOpts = NonNullable<Parameters<Electron.Session['clearStorageData']>[0]>;
  const storages: ClearStorageOpts['storages'] = [
    'cookies',
    'filesystem',
    'indexdb',
    'localstorage',
    'shadercache',
    'websql',
    'serviceworkers',
    'cachestorage'
  ];

  const tasks: Promise<unknown>[] = [];
  for (const sess of sessions) {
    if (opts.cookiesAndSiteData) {
      tasks.push(
        sess.clearStorageData({
          storages
        })
      );
    }
    if (opts.cache) {
      tasks.push(sess.clearCache());
    }
  }

  if (opts.history) {
    try {
      const historyModule = await import('./history');
      await historyModule.clearAll();
    } catch {
      // ignore history clear failures
    }
  }

  await Promise.allSettled(tasks);
};
