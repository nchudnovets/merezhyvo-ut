import fs from 'fs';
import path from 'path';
import { session as electronSession, app, webContents, type Session } from 'electron';
import type { HttpsMode, BlockingMode } from './shortcuts';
import { getSiteKey, safeHostnameFromUrl } from './site-key';

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
  blockingMode: BlockingMode;
  blockingActive: boolean;
  siteHost: string | null;
  trackersAllowedForSite: boolean;
  adsAllowedForSite: boolean;
  blockedTotal: number;
  blockedAds: number;
  blockedTrackers: number;
};

type TabStats = {
  siteKey: string | null;
  blockedAds: number;
  blockedTrackers: number;
};

type InitOptions = {
  sessions?: Session[];
  getSettings?: () =>
    | Promise<{ privacy?: { trackers?: Partial<TrackerSettings>; ads?: Partial<AdsSettings>; blockingMode?: BlockingMode | 'off' }; httpsMode?: HttpsMode }>
    | { privacy?: { trackers?: Partial<TrackerSettings>; ads?: Partial<AdsSettings>; blockingMode?: BlockingMode | 'off' }; httpsMode?: HttpsMode };
  onSettingsUpdated?: (settings: { trackers: TrackerSettings; ads: AdsSettings; blockingMode: BlockingMode }) => void;
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
const initializedSessions = new WeakSet<Session>();
let blockingMode: BlockingMode = 'basic';

const normalizeHost = (value: string | null | undefined): string | null => {
  return (safeHostnameFromUrl(value ?? '') ?? (value ?? '').trim().toLowerCase()) || null;
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
    stats = { siteKey: null, blockedAds: 0, blockedTrackers: 0 };
    statsByWcId.set(wcId, stats);
  }
  return stats;
};

const resetStatsForNavigation = (wcId: number, url: string | null | undefined, isInPlace: boolean) => {
  if (!url || isInPlace) return;
  const siteKey = getSiteKey(url);
  if (!siteKey) return;
  const stats = getTabStats(wcId);
  if (stats.siteKey !== siteKey) {
    stats.siteKey = siteKey;
    stats.blockedAds = 0;
    stats.blockedTrackers = 0;
  }
};

const notifyRenderer = (wcId: number): void => {
  const target = webContents.fromId(wcId);
  if (!target) return;
  const stats = statsByWcId.get(wcId);
  const siteHost = stats?.siteKey ?? null;
  const blockingActive = trackerSettings.enabled || adsSettings.enabled;
  const trackersAllowedForSite = siteHost ? trackerSettings.exceptions.includes(siteHost) : false;
  const adsAllowedForSite = siteHost ? adsSettings.exceptions.includes(siteHost) : false;
  const blockedAds = blockingActive ? stats?.blockedAds ?? 0 : 0;
  const blockedTrackers = blockingActive ? stats?.blockedTrackers ?? 0 : 0;
  const payload: TrackerStatus = {
    trackersEnabledGlobal: trackerSettings.enabled,
    adsEnabledGlobal: adsSettings.enabled,
    blockingMode,
    blockingActive,
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

const ensureTopSiteKey = (wcId: number): string | null => {
  const stats = getTabStats(wcId);
  const wc = webContents.fromId(wcId);
  const currentUrl = wc?.getURL?.() ?? null;
  const siteKey = currentUrl ? getSiteKey(currentUrl) : null;
  if (siteKey && stats.siteKey !== siteKey) {
    stats.siteKey = siteKey;
    stats.blockedAds = 0;
    stats.blockedTrackers = 0;
  }
  return stats.siteKey;
};

const handleBeforeRequest = (details: Electron.OnBeforeRequestListenerDetails, callback: (response: Electron.CallbackResponse) => void) => {
  try {
    const wcId = details.webContentsId;
    if (!wcId) return callback({});
    const protocol = details.url.split(':')[0]?.toLowerCase();
    if (protocol !== 'http' && protocol !== 'https' && protocol !== 'ws' && protocol !== 'wss') return callback({});
    const blockingActive = trackerSettings.enabled || adsSettings.enabled;
    if (!blockingActive) return callback({});
    if (details.resourceType === 'mainFrame') return callback({});

    const topSiteKey = ensureTopSiteKey(wcId);
    if (!topSiteKey) return callback({});

    const host = normalizeHost(details.url || '');
    if (!host) return callback({});
    const requestSiteKey = getSiteKey(host) ?? host;
    const thirdParty = requestSiteKey !== topSiteKey;
    const stats = getTabStats(wcId);
    const category = domainCategory(host);
    if (category === 'none') return callback({});

    const catEnabled = category === 'ads' ? adsSettings.enabled : trackerSettings.enabled;
    const siteExceptionAllowed =
      category === 'ads'
        ? adsSettings.exceptions.includes(topSiteKey)
        : trackerSettings.exceptions.includes(topSiteKey);
    if (!catEnabled || siteExceptionAllowed) return callback({});

    const shouldBlock =
      blockingMode === 'strict'
        ? true
        : blockingMode === 'basic'
          ? thirdParty
          : false;

    if (!shouldBlock) return callback({});

    if (category === 'ads') {
      stats.blockedAds += 1;
    } else if (category === 'trackers') {
      stats.blockedTrackers += 1;
    }
    notifyRenderer(wcId);
    return callback({ cancel: true });
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
  const blockingModeRaw = settingsRaw?.privacy?.blockingMode as BlockingMode | 'off' | undefined;
  const normalizedBlockingMode: BlockingMode = blockingModeRaw === 'strict' || blockingModeRaw === 'basic' ? blockingModeRaw : 'basic';
  const shouldPersistBlockingMode = blockingModeRaw === 'off' || blockingModeRaw === undefined || blockingModeRaw === null || blockingModeRaw !== normalizedBlockingMode;
  blockingMode = normalizedBlockingMode;
  trackerSettings = {
    enabled: typeof trackersRaw.enabled === 'boolean' ? trackersRaw.enabled : DEFAULT_TRACKER_SETTINGS.enabled,
    exceptions: Array.isArray(trackersRaw.exceptions)
      ? Array.from(new Set(trackersRaw.exceptions.map((h) => getSiteKey(String(h)) ?? String(h).toLowerCase().trim()).filter(Boolean)))
      : []
  };
  adsSettings = {
    enabled: typeof adsRaw.enabled === 'boolean' ? adsRaw.enabled : DEFAULT_ADS_SETTINGS.enabled,
    exceptions: Array.isArray(adsRaw.exceptions)
      ? Array.from(new Set(adsRaw.exceptions.map((h) => getSiteKey(String(h)) ?? String(h).toLowerCase().trim()).filter(Boolean)))
      : []
  };
  if (shouldPersistBlockingMode && options.onSettingsUpdated) {
    try {
      options.onSettingsUpdated({
        trackers: trackerSettings,
        ads: adsSettings,
        blockingMode
      });
    } catch {
      // ignore
    }
  }

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
  const siteHost = stats?.siteKey ?? null;
  const blockingActive = trackerSettings.enabled || adsSettings.enabled;
  const trackersAllowedForSite = siteHost ? trackerSettings.exceptions.includes(siteHost) : false;
  const adsAllowedForSite = siteHost ? adsSettings.exceptions.includes(siteHost) : false;
  const blockedAds = blockingActive ? stats?.blockedAds ?? 0 : 0;
  const blockedTrackers = blockingActive ? stats?.blockedTrackers ?? 0 : 0;
  return {
    trackersEnabledGlobal: trackerSettings.enabled,
    adsEnabledGlobal: adsSettings.enabled,
    blockingMode,
    blockingActive,
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
  if (!trackerSettings.enabled && !adsSettings.enabled) {
    statsByWcId.forEach((stats) => {
      stats.blockedAds = 0;
      stats.blockedTrackers = 0;
    });
  }
  statsByWcId.forEach((_v, wcId) => notifyRenderer(wcId));
  return { trackers: trackerSettings, ads: adsSettings };
};

export const setAdsEnabledGlobal = (enabled: boolean): { trackers: TrackerSettings; ads: AdsSettings } => {
  adsSettings.enabled = Boolean(enabled);
  if (!trackerSettings.enabled && !adsSettings.enabled) {
    statsByWcId.forEach((stats) => {
      stats.blockedAds = 0;
      stats.blockedTrackers = 0;
    });
  }
  statsByWcId.forEach((_v, wcId) => notifyRenderer(wcId));
  return { trackers: trackerSettings, ads: adsSettings };
};

export const setTrackersSiteAllowed = (siteHost: string, allowed: boolean): { trackers: TrackerSettings; ads: AdsSettings } => {
  const normalized = siteHost?.toLowerCase().trim();
  if (!normalized) return { trackers: trackerSettings, ads: adsSettings };
  const siteKey = getSiteKey(normalized) ?? normalized;
  const next = new Set(trackerSettings.exceptions);
  if (allowed) next.add(siteKey); else next.delete(siteKey);
  trackerSettings.exceptions = Array.from(next);
  statsByWcId.forEach((_v, wcId) => notifyRenderer(wcId));
  return { trackers: trackerSettings, ads: adsSettings };
};

export const setAdsSiteAllowed = (siteHost: string, allowed: boolean): { trackers: TrackerSettings; ads: AdsSettings } => {
  const normalized = siteHost?.toLowerCase().trim();
  if (!normalized) return { trackers: trackerSettings, ads: adsSettings };
  const siteKey = getSiteKey(normalized) ?? normalized;
  const next = new Set(adsSettings.exceptions);
  if (allowed) next.add(siteKey); else next.delete(siteKey);
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

export const setBlockingMode = (mode: BlockingMode): BlockingMode => {
  if (mode === 'basic' || mode === 'strict') {
    blockingMode = mode;
    statsByWcId.forEach((_v, wcId) => notifyRenderer(wcId));
  }
  return blockingMode;
};

export const getBlockingMode = (): BlockingMode => blockingMode;
