'use strict';

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ensureDir, getProfileDir } from './shortcuts';

const fsp = fs.promises;
const HISTORY_FILE = path.join(getProfileDir(), 'history.ndjson');
const HISTORY_TEMP_SUFFIX = '.tmp';
const DEFAULT_QUERY_LIMIT = 128;

export type VisitRecord = {
  id: string;
  ts: number;
  url: string;
  title?: string | null;
  origin?: string | null;
  transition?: string | null;
  referrer?: string | null;
  wcId?: number | null;
  faviconId?: string | null;
};

export type AddVisitOptions = {
  ts?: number;
  url: string;
  title?: string | null;
  origin?: string | null;
  transition?: string | null;
  referrer?: string | null;
  wcId?: number | null;
  faviconId?: string | null;
};

export type HistoryQueryOptions = {
  q?: string;
  fromTs?: number;
  toTs?: number;
  origin?: string | null;
  limit?: number;
  cursor?: number;
};

export type HistoryQueryResult = {
  items: VisitRecord[];
  nextCursor?: number;
};

export type TopSitesOptions = {
  days?: number;
  limit?: number;
};

export type TopSite = {
  origin: string;
  urlSample: string;
  titleSample?: string | null;
  visits: number;
  lastTs: number;
  faviconId?: string | null;
};

export type HistoryRemoveOptions = {
  url?: string;
  origin?: string | null;
  beforeTs?: number;
};

const THREAD_SAFE_DIR = path.dirname(HISTORY_FILE);

const makeVisitId = (): string => `h_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

const normalizeHostname = (value: string): string => {
  const host = value.trim().toLowerCase();
  if (!host) return host;
  const withoutWww = host.startsWith('www.') ? host.slice(4) : host;
  return withoutWww;
};

const normalizeOrigin = (value?: string | null): string | null => {
  if (!value || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return null;
    }
    const hostname = normalizeHostname(parsed.hostname);
    const hostWithPort = parsed.port ? `${hostname}:${parsed.port}` : hostname;
    return `${protocol}//${hostWithPort}`;
  } catch {
    return null;
  }
};

const normalizeUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    const idx = trimmed.indexOf('#');
    return idx === -1 ? trimmed : trimmed.slice(0, idx);
  }
};

const asNullableString = (value: unknown): string | null =>
  value === null ? null : typeof value === 'string' ? value : null;

const asSafeNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const tryParseVisitLine = (line: string): VisitRecord | null => {
  try {
    const raw = JSON.parse(line);
    if (!raw || typeof raw !== 'object') return null;
    const record = raw as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : '';
    const url = typeof record.url === 'string' ? record.url : '';
    const ts = asSafeNumber(record.ts);
    if (!id || !url || ts === null) return null;
    return {
      id,
      ts,
      url,
      title: asNullableString(record.title),
      origin: asNullableString(record.origin),
      transition: asNullableString(record.transition),
      referrer: asNullableString(record.referrer),
      wcId: typeof record.wcId === 'number' ? record.wcId : null,
      faviconId: asNullableString(record.faviconId)
    };
  } catch {
    return null;
  }
};

const ensureHistoryDir = (): void => {
  ensureDir(THREAD_SAFE_DIR);
};

const createAtomicPath = (target: string): string => {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${target}.${unique}${HISTORY_TEMP_SUFFIX}`;
};

const writeAtomic = async (target: string, payload: string | Buffer): Promise<void> => {
  ensureHistoryDir();
  const tempPath = createAtomicPath(target);
  await fsp.writeFile(tempPath, payload);
  await fsp.rename(tempPath, target);
};

const appendLine = async (line: string): Promise<void> => {
  ensureHistoryDir();
  await fsp.appendFile(HISTORY_FILE, `${line}\n`, 'utf8');
};

const loadEntries = async (): Promise<VisitRecord[]> => {
  try {
    const raw = await fsp.readFile(HISTORY_FILE, 'utf8');
    if (!raw) return [];
    return raw
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => tryParseVisitLine(line))
      .filter((entry): entry is VisitRecord => entry !== null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
};

const writeEntries = async (entries: VisitRecord[]): Promise<void> => {
  const payload = entries.map((entry) => JSON.stringify(entry)).join('\n');
  const content = payload ? `${payload}\n` : '';
  await writeAtomic(HISTORY_FILE, content);
};

const matchTarget = (entry: VisitRecord, target: string): boolean => {
  if (entry.id === target) return true;
  const normalized = normalizeUrl(target);
  return entry.url === normalized;
};

export const addVisit = async (options: AddVisitOptions): Promise<VisitRecord> => {
  if (!options.url?.trim()) {
    throw new Error('URL is required to add a history visit.');
  }
  const normalizedUrl = normalizeUrl(options.url);
  const originValue = normalizeOrigin(options.origin ?? normalizedUrl);
  const trimmedTitle = options.title?.trim();
  const trimmedTransition = options.transition?.trim();
  const visit: VisitRecord = {
    id: makeVisitId(),
    ts: typeof options.ts === 'number' ? options.ts : Date.now(),
    url: normalizedUrl,
    title: trimmedTitle && trimmedTitle.length > 0 ? trimmedTitle : null,
    origin: originValue,
    transition: trimmedTransition && trimmedTransition.length > 0 ? trimmedTransition : null,
    referrer: options.referrer ? normalizeUrl(options.referrer) : null,
    wcId: typeof options.wcId === 'number' ? options.wcId : null,
    faviconId: options.faviconId ?? null
  };
  await appendLine(JSON.stringify(visit));
  return visit;
};

const updateEntries = async (matcher: (entry: VisitRecord) => boolean, modifier: (entry: VisitRecord) => void): Promise<boolean> => {
  const entries = await loadEntries();
  let touched = false;
  for (const entry of entries) {
    if (matcher(entry)) {
      modifier(entry);
      touched = true;
    }
  }
  if (touched) {
    await writeEntries(entries);
  }
  return touched;
};

export const updateTitle = async (visitIdOrUrl: string, title: string | null): Promise<boolean> => {
  if (!visitIdOrUrl.trim()) return false;
  const normalizedTitle = title === null ? null : title.trim();
  const value = normalizedTitle && normalizedTitle.length > 0 ? normalizedTitle : null;
  return updateEntries(
    (entry) => matchTarget(entry, visitIdOrUrl),
    (entry) => {
      entry.title = value;
    }
  );
};

export const updateFavicon = async (visitIdOrUrl: string, faviconId: string | null): Promise<boolean> => {
  if (!visitIdOrUrl.trim()) return false;
  return updateEntries(
    (entry) => matchTarget(entry, visitIdOrUrl),
    (entry) => {
      entry.faviconId = faviconId;
    }
  );
};

const matchesFilters = (entry: VisitRecord, options: HistoryQueryOptions): boolean => {
  if (options.fromTs && entry.ts < options.fromTs) return false;
  if (options.toTs && entry.ts > options.toTs) return false;
  if (options.origin) {
    const normalizedOrigin = normalizeOrigin(options.origin);
    if (normalizedOrigin && entry.origin !== normalizedOrigin) {
      return false;
    }
  }
  if (options.q) {
    const needle = options.q.toLowerCase();
    const haystack = `${entry.url} ${entry.title ?? ''}`.toLowerCase();
    if (!haystack.includes(needle)) {
      return false;
    }
  }
  return true;
};

export const query = async (options: HistoryQueryOptions = {}): Promise<HistoryQueryResult> => {
  try {
    const buffer = await fsp.readFile(HISTORY_FILE);
    const start = Math.max(Math.min(buffer.length, options.cursor ?? 0), 0);
    const slice = buffer.subarray(start);
    const text = slice.toString('utf8');
    if (!text) return { items: [] };
    const lines = text.split('\n');
    const result: VisitRecord[] = [];
    let cursorOffset = start;
    let sliceConsumed = 0;
    const limit = Math.max(1, Math.min(1024, options.limit ?? DEFAULT_QUERY_LIMIT));
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const hasMoreAfter = index < lines.length - 1;
      if (!line.trim()) {
        sliceConsumed += Buffer.byteLength(line, 'utf8') + (hasMoreAfter ? 1 : 0);
        cursorOffset = start + sliceConsumed;
        continue;
      }
      const entry = tryParseVisitLine(line);
      sliceConsumed += Buffer.byteLength(line, 'utf8') + (hasMoreAfter ? 1 : 0);
      cursorOffset = start + sliceConsumed;
      if (!entry) continue;
      if (!matchesFilters(entry, options)) continue;
      result.push(entry);
      if (result.length >= limit) {
        return { items: result, nextCursor: cursorOffset < buffer.length ? cursorOffset : undefined };
      }
    }
    return { items: result, nextCursor: cursorOffset < buffer.length ? cursorOffset : undefined };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { items: [] };
    }
    throw err;
  }
};

export const clearAll = async (): Promise<void> => {
  await writeAtomic(HISTORY_FILE, '');
};

export const remove = async (options: HistoryRemoveOptions): Promise<number> => {
  const hasOrigin = typeof options.origin === 'string' && options.origin.trim().length > 0;
  const hasUrl = typeof options.url === 'string' && options.url.trim().length > 0;
  const hasTs = typeof options.beforeTs === 'number';
  if (!hasOrigin && !hasUrl && !hasTs) {
    return 0;
  }
  const entries = await loadEntries();
  const normalizedOriginFilter = hasOrigin ? normalizeOrigin(options.origin ?? '') : null;
  const normalizedUrlFilter = hasUrl ? normalizeUrl(options.url ?? '') : null;
  const beforeTsValue = hasTs ? options.beforeTs ?? null : null;
  const filtered = entries.filter((entry) => {
    const matchesOrigin = normalizedOriginFilter ? entry.origin === normalizedOriginFilter : false;
    const matchesUrl = normalizedUrlFilter ? entry.url === normalizedUrlFilter : false;
    const matchesTs = beforeTsValue !== null ? entry.ts < beforeTsValue : false;
    return !(matchesOrigin || matchesUrl || matchesTs);
  });
  const removed = entries.length - filtered.length;
  if (removed > 0) {
    await writeEntries(filtered);
  }
  return removed;
};

export const topSites = async (options: TopSitesOptions = {}): Promise<TopSite[]> => {
  const entries = await loadEntries();
  const days = Math.max(1, Math.min(60, options.days ?? 7));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const limit = Math.max(1, Math.min(64, options.limit ?? 12));
  const stats: Record<string, TopSite> = {};
  for (const entry of entries) {
    if (entry.ts < since) continue;
    if (!entry.origin) continue;
    const bucket = stats[entry.origin] ?? {
      origin: entry.origin,
      urlSample: entry.url,
      titleSample: entry.title ?? null,
      visits: 0,
      lastTs: entry.ts,
      faviconId: entry.faviconId ?? null
    };
    bucket.visits += 1;
    if (entry.ts > bucket.lastTs) {
      bucket.lastTs = entry.ts;
      bucket.urlSample = entry.url;
      bucket.titleSample = entry.title ?? null;
      bucket.faviconId = entry.faviconId ?? null;
    }
    stats[entry.origin] = bucket;
  }
  const sorted = Object.values(stats).sort((a, b) => b.visits - a.visits || b.lastTs - a.lastTs);
  return sorted.slice(0, limit);
};

/*
 * Example smoke usage (can be wired into a small CLI script for manual testing):
 *   (async () => {
 *     await addVisit({ url: 'https://example.com', ts: Date.now(), title: 'Example' });
 *     const result = await query({ limit: 5 });
 *     console.log(result);
 *   })();
 */

// TODO: Implement compaction limit to keep history.ndjson size under control.
