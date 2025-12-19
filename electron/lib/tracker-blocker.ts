import fs from 'fs';
import path from 'path';
import { session as electronSession, app, webContents, type Session } from 'electron';
import type { HttpsMode } from './shortcuts';

export type TrackerSettings = {
  enabled: boolean;
  exceptions: string[];
};

export type AdsSettings = {
  enabled: boolean;
  exceptions: string[];
};

export type TrackerStatus = {
  trackersEnabledGlobal: boolean;
  adsEnabledGlobal: boolean;
  siteHost: string | null;
  trackersAllowedForSite: boolean;
  adsAllowedForSite: boolean;
  blockedTotal: number;
  blockedAds: number;
  blockedTrackers: number;
};

type TabStats = {
  siteHost: string | null;
  blockedAds: number;
  blockedTrackers: number;
};

type InitOptions = {
  sessions?: Session[];
  getSettings?: () =>
    | Promise<{ privacy?: { trackers?: Partial<TrackerSettings>; ads?: Partial<AdsSettings> }; httpsMode?: HttpsMode }>
    | { privacy?: { trackers?: Partial<TrackerSettings>; ads?: Partial<AdsSettings> }; httpsMode?: HttpsMode };
  onSettingsUpdated?: (settings: { trackers: TrackerSettings; ads: AdsSettings }) => void;
};

const BLOCKLIST_BASES = [
  path.join(__dirname, '..', 'assets', 'blocklists'),
  path.join(process.resourcesPath ?? '', 'assets', 'blocklists'),
  path.join(process.cwd(), 'assets', 'blocklists')
];

const DEFAULT_TRACKER_SETTINGS: TrackerSettings = {
  enabled: false,
  exceptions: []
};
const DEFAULT_ADS_SETTINGS: AdsSettings = {
  enabled: false,
  exceptions: []
};

const statsByWcId = new Map<number, TabStats>();
const trackerBlocklist = new Set<string>();
const adsBlocklist = new Set<string>();
const hostCategoryCache = new Map<string, 'ads' | 'trackers' | 'none'>();
const CACHE_LIMIT = 20000;
let trackerSettings: TrackerSettings = { ...DEFAULT_TRACKER_SETTINGS };
let adsSettings: AdsSettings = { ...DEFAULT_ADS_SETTINGS };
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

const trimCache = () => {
  if (hostCategoryCache.size <= CACHE_LIMIT) return;
  const overflow = hostCategoryCache.size - CACHE_LIMIT;
  const keys = hostCategoryCache.keys();
  for (let i = 0; i < overflow; i++) {
    const k = keys.next();
    if (k.done) break;
    hostCategoryCache.delete(k.value);
  }
};

const loadBlocklist = (target: Set<string>, filename: string): void => {
  for (const base of BLOCKLIST_BASES) {
    const filePath = path.join(base, filename);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const entries = raw
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter((line) => line && !line.startsWith('#'));
      for (const entry of entries) target.add(entry);
      if (target.size > 0) return;
    } catch {
      // try next
    }
  }
};

const domainCategory = (host: string | null | undefined): 'ads' | 'trackers' | 'none' => {
  if (!host) return 'none';
  const lower = host.toLowerCase();
  if (hostCategoryCache.has(lower)) return hostCategoryCache.get(lower) ?? 'none';

  const match = (set: Set<string>): boolean => {
    let candidate = lower;
    while (candidate) {
      if (set.has(candidate)) return true;
      const dot = candidate.indexOf('.');
      if (dot === -1) break;
      candidate = candidate.slice(dot + 1);
    }
    return false;
  };

  let result: 'ads' | 'trackers' | 'none' = 'none';
  if (match(trackerBlocklist)) {
    result = 'trackers';
  } else if (match(adsBlocklist)) {
    result = 'ads';
  }
  hostCategoryCache.set(lower, result);
  trimCache();
  return result;
};

const getTabStats = (wcId: number): TabStats => {
  let stats = statsByWcId.get(wcId);
  if (!stats) {
    stats = { siteHost: null, blockedAds: 0, blockedTrackers: 0 };
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
    stats.blockedAds = 0;
    stats.blockedTrackers = 0;
  }
};

const notifyRenderer = (wcId: number): void => {
  const target = webContents.fromId(wcId);
  if (!target) return;
  const stats = statsByWcId.get(wcId);
  const siteHost = stats?.siteHost ?? null;
  const trackersAllowedForSite = siteHost ? trackerSettings.exceptions.includes(siteHost) : false;
  const adsAllowedForSite = siteHost ? adsSettings.exceptions.includes(siteHost) : false;
  const blockedAds = stats?.blockedAds ?? 0;
  const blockedTrackers = stats?.blockedTrackers ?? 0;
  const payload: TrackerStatus = {
    trackersEnabledGlobal: trackerSettings.enabled,
    adsEnabledGlobal: adsSettings.enabled,
    siteHost,
    trackersAllowedForSite,
    adsAllowedForSite,
    blockedTotal: blockedAds + blockedTrackers,
    blockedAds,
    blockedTrackers
  };
  try {
    target.send('trackers:statsChanged', payload);
  } catch {
    // ignore
  }
};

const handleBeforeRequest = (details: Electron.OnBeforeRequestListenerDetails, callback: (response: Electron.CallbackResponse) => void) => {
  try {
    if (!trackerSettings.enabled && !adsSettings.enabled) return callback({});
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

    const category = domainCategory(host);
    if (category === 'ads') {
      if (!adsSettings.enabled || adsSettings.exceptions.includes(siteHost)) return callback({});
      stats.blockedAds += 1;
      notifyRenderer(wcId);
      return callback({ cancel: true });
    }
    if (category === 'trackers') {
      if (!trackerSettings.enabled || trackerSettings.exceptions.includes(siteHost)) return callback({});
      stats.blockedTrackers += 1;
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
  loadBlocklist(trackerBlocklist, 'trackers.txt');
  loadBlocklist(adsBlocklist, 'ads.txt');
  const settingsRaw = await options.getSettings?.();
  const trackersRaw = settingsRaw?.privacy?.trackers ?? {};
  const adsRaw = settingsRaw?.privacy?.ads ?? {};
  trackerSettings = {
    enabled: typeof trackersRaw.enabled === 'boolean' ? trackersRaw.enabled : DEFAULT_TRACKER_SETTINGS.enabled,
    exceptions: Array.isArray(trackersRaw.exceptions)
      ? Array.from(new Set(trackersRaw.exceptions.map((h) => String(h).toLowerCase().trim()).filter(Boolean)))
      : []
  };
  adsSettings = {
    enabled: typeof adsRaw.enabled === 'boolean' ? adsRaw.enabled : DEFAULT_ADS_SETTINGS.enabled,
    exceptions: Array.isArray(adsRaw.exceptions)
      ? Array.from(new Set(adsRaw.exceptions.map((h) => String(h).toLowerCase().trim()).filter(Boolean)))
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
  const trackersAllowedForSite = siteHost ? trackerSettings.exceptions.includes(siteHost) : false;
  const adsAllowedForSite = siteHost ? adsSettings.exceptions.includes(siteHost) : false;
  const blockedAds = stats?.blockedAds ?? 0;
  const blockedTrackers = stats?.blockedTrackers ?? 0;
  return {
    trackersEnabledGlobal: trackerSettings.enabled,
    adsEnabledGlobal: adsSettings.enabled,
    siteHost,
    trackersAllowedForSite,
    adsAllowedForSite,
    blockedTotal: blockedAds + blockedTrackers,
    blockedAds,
    blockedTrackers
  };
};

export const setTrackersEnabledGlobal = (enabled: boolean): { trackers: TrackerSettings; ads: AdsSettings } => {
  trackerSettings.enabled = Boolean(enabled);
  statsByWcId.forEach((_v, wcId) => notifyRenderer(wcId));
  return { trackers: trackerSettings, ads: adsSettings };
};

export const setAdsEnabledGlobal = (enabled: boolean): { trackers: TrackerSettings; ads: AdsSettings } => {
  adsSettings.enabled = Boolean(enabled);
  statsByWcId.forEach((_v, wcId) => notifyRenderer(wcId));
  return { trackers: trackerSettings, ads: adsSettings };
};

export const setTrackersSiteAllowed = (siteHost: string, allowed: boolean): { trackers: TrackerSettings; ads: AdsSettings } => {
  const normalized = siteHost?.toLowerCase().trim();
  if (!normalized) return { trackers: trackerSettings, ads: adsSettings };
  const next = new Set(trackerSettings.exceptions);
  if (allowed) next.add(normalized); else next.delete(normalized);
  trackerSettings.exceptions = Array.from(next);
  statsByWcId.forEach((_v, wcId) => notifyRenderer(wcId));
  return { trackers: trackerSettings, ads: adsSettings };
};

export const setAdsSiteAllowed = (siteHost: string, allowed: boolean): { trackers: TrackerSettings; ads: AdsSettings } => {
  const normalized = siteHost?.toLowerCase().trim();
  if (!normalized) return { trackers: trackerSettings, ads: adsSettings };
  const next = new Set(adsSettings.exceptions);
  if (allowed) next.add(normalized); else next.delete(normalized);
  adsSettings.exceptions = Array.from(next);
  statsByWcId.forEach((_v, wcId) => notifyRenderer(wcId));
  return { trackers: trackerSettings, ads: adsSettings };
};

export const clearTrackerExceptions = (): { trackers: TrackerSettings; ads: AdsSettings } => {
  trackerSettings.exceptions = [];
  statsByWcId.forEach((_v, wcId) => notifyRenderer(wcId));
  return { trackers: trackerSettings, ads: adsSettings };
};

export const clearAdsExceptions = (): { trackers: TrackerSettings; ads: AdsSettings } => {
  adsSettings.exceptions = [];
  statsByWcId.forEach((_v, wcId) => notifyRenderer(wcId));
  return { trackers: trackerSettings, ads: adsSettings };
};
