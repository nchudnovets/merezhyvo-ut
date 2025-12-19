import fs from 'fs';
import path from 'path';
import { session as electronSession, app, webContents, type Session } from 'electron';
import type { HttpsMode } from './shortcuts';

export type TrackerSettings = {
  enabled: boolean;
  exceptions: string[];
};

export type TrackerStatus = {
  enabledGlobal: boolean;
  siteHost: string | null;
  siteAllowed: boolean;
  blockedCount: number;
};

type TabStats = {
  siteHost: string | null;
  blockedCount: number;
};

type InitOptions = {
  sessions?: Session[];
  getSettings?: () =>
    | Promise<{ privacy?: { trackers?: Partial<TrackerSettings> }; httpsMode?: HttpsMode }>
    | { privacy?: { trackers?: Partial<TrackerSettings> }; httpsMode?: HttpsMode };
  onSettingsUpdated?: (settings: TrackerSettings) => void;
};

const BLOCKLIST_CANDIDATES = [
  path.join(__dirname, '..', 'assets', 'blocklists', 'trackers.txt'),
  path.join(process.resourcesPath ?? '', 'assets', 'blocklists', 'trackers.txt'),
  path.join(process.cwd(), 'assets', 'blocklists', 'trackers.txt')
];

const DEFAULT_TRACKER_SETTINGS: TrackerSettings = {
  enabled: true,
  exceptions: []
};

const statsByWcId = new Map<number, TabStats>();
const blocklist = new Set<string>();
let trackerSettings: TrackerSettings = { ...DEFAULT_TRACKER_SETTINGS };
let initializedSessions = new WeakSet<Session>();

const normalizeHost = (value: string | null | undefined): string | null => {
  if (!value || typeof value !== 'string') return null;
  try {
    const host = new URL(value).hostname;
    return host ? host.toLowerCase() : null;
  } catch {
    return (value || '').toLowerCase() || null;
  }
};

const loadBlocklist = (): void => {
  for (const candidate of BLOCKLIST_CANDIDATES) {
    try {
      const raw = fs.readFileSync(candidate, 'utf8');
      const entries = raw
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter((line) => line && !line.startsWith('#'));
      for (const entry of entries) {
        blocklist.add(entry);
      }
      if (blocklist.size > 0) return;
    } catch {
      // try next candidate
    }
  }
};

const domainMatches = (host: string | null | undefined): boolean => {
  if (!host) return false;
  const lower = host.toLowerCase();
  if (blocklist.has(lower)) return true;
  for (const blocked of blocklist) {
    if (lower === blocked) return true;
    if (lower.endsWith(`.${blocked}`)) return true;
  }
  return false;
};

const getTabStats = (wcId: number): TabStats => {
  let stats = statsByWcId.get(wcId);
  if (!stats) {
    stats = { siteHost: null, blockedCount: 0 };
    statsByWcId.set(wcId, stats);
  }
  return stats;
};

const resetStatsForNavigation = (wcId: number, url: string | null | undefined, isInPlace: boolean) => {
  if (!url || isInPlace) return;
  const host = normalizeHost(url);
  if (!host) return;
  const stats = getTabStats(wcId);
  if (stats.siteHost !== host) {
    stats.siteHost = host;
    stats.blockedCount = 0;
  }
};

const notifyRenderer = (wcId: number): void => {
  const target = webContents.fromId(wcId);
  if (!target) return;
  const stats = statsByWcId.get(wcId);
  const siteHost = stats?.siteHost ?? null;
  const siteAllowed = siteHost ? trackerSettings.exceptions.includes(siteHost) : false;
  const payload: TrackerStatus = {
    enabledGlobal: trackerSettings.enabled,
    siteHost,
    siteAllowed,
    blockedCount: stats?.blockedCount ?? 0
  };
  try {
    target.send('trackers:statsChanged', payload);
  } catch {
    // ignore
  }
};

const handleBeforeRequest = (details: Electron.OnBeforeRequestListenerDetails, callback: (response: Electron.CallbackResponse) => void) => {
  try {
    if (!trackerSettings.enabled) return callback({});
    const wcId = details.webContentsId;
    if (!wcId) return callback({});
    if (details.resourceType === 'mainFrame') return callback({});
    const url = details.url || '';
    const host = normalizeHost(url);
    if (!host) return callback({});
    const protocol = url.split(':')[0]?.toLowerCase();
    if (protocol !== 'http' && protocol !== 'https') return callback({});

    const stats = getTabStats(wcId);
    const siteHost = stats.siteHost;
    if (!siteHost) return callback({});
    if (siteHost && trackerSettings.exceptions.includes(siteHost)) {
      return callback({});
    }

    if (domainMatches(host)) {
      stats.blockedCount += 1;
      notifyRenderer(wcId);
      return callback({ cancel: true });
    }
  } catch {
    // fall through
  }
  return callback({});
};

const attachNavigationListeners = (contents: Electron.WebContents) => {
  contents.on('did-start-navigation', (_event, url, isInPlace, isMainFrame) => {
    if (!isMainFrame) return;
    resetStatsForNavigation(contents.id, url, Boolean(isInPlace));
    notifyRenderer(contents.id);
  });
};

const initSession = (sess: Session) => {
  if (initializedSessions.has(sess)) return;
  initializedSessions.add(sess);
  try {
    sess.webRequest.onBeforeRequest(handleBeforeRequest);
  } catch {
    // ignore
  }
};

export const initTrackerBlocker = async (options: InitOptions = {}) => {
  loadBlocklist();
  const settingsRaw = await options.getSettings?.();
  const trackersRaw = settingsRaw?.privacy?.trackers ?? {};
  trackerSettings = {
    enabled: typeof trackersRaw.enabled === 'boolean' ? trackersRaw.enabled : DEFAULT_TRACKER_SETTINGS.enabled,
    exceptions: Array.isArray(trackersRaw.exceptions)
      ? Array.from(new Set(trackersRaw.exceptions.map((h) => String(h).toLowerCase().trim()).filter(Boolean)))
      : []
  };

  const sessions = options.sessions && options.sessions.length
    ? options.sessions
    : [electronSession.defaultSession];
  sessions.forEach(initSession);

  app.on('web-contents-created', (_event, contents) => {
    attachNavigationListeners(contents);
  });
};

export const getTrackerStatus = (wcId: number | null | undefined): TrackerStatus => {
  const stats = wcId ? statsByWcId.get(wcId) : null;
  const siteHost = stats?.siteHost ?? null;
  const siteAllowed = siteHost ? trackerSettings.exceptions.includes(siteHost) : false;
  return {
    enabledGlobal: trackerSettings.enabled,
    siteHost,
    siteAllowed,
    blockedCount: stats?.blockedCount ?? 0
  };
};

export const setTrackersEnabledGlobal = (enabled: boolean): TrackerSettings => {
  trackerSettings.enabled = Boolean(enabled);
  statsByWcId.forEach((_v, wcId) => notifyRenderer(wcId));
  return trackerSettings;
};

export const setTrackersSiteAllowed = (siteHost: string, allowed: boolean): TrackerSettings => {
  const normalized = siteHost?.toLowerCase().trim();
  if (!normalized) return trackerSettings;
  const next = new Set(trackerSettings.exceptions);
  if (allowed) {
    next.add(normalized);
  } else {
    next.delete(normalized);
  }
  trackerSettings.exceptions = Array.from(next);
  statsByWcId.forEach((_v, wcId) => notifyRenderer(wcId));
  return trackerSettings;
};

export const clearTrackerExceptions = (): TrackerSettings => {
  trackerSettings.exceptions = [];
  statsByWcId.forEach((_v, wcId) => notifyRenderer(wcId));
  return trackerSettings;
};
