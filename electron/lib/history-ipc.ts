'use strict';

import type { IpcMain } from 'electron';
import { clearAll, query, remove, topSites } from './history';
import type { HistoryQueryOptions, TopSitesOptions, HistoryRemoveOptions } from './history';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const toString = (value: unknown): string | undefined => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined);
const toNumber = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

const buildQueryOptions = (payload: unknown): HistoryQueryOptions => {
  if (!isRecord(payload)) return {};
  const opts: HistoryQueryOptions = {};
  const q = toString(payload.q);
  if (q) opts.q = q;
  const fromTs = toNumber(payload.fromTs);
  if (fromTs !== undefined) opts.fromTs = fromTs;
  const toTs = toNumber(payload.toTs);
  if (toTs !== undefined) opts.toTs = toTs;
  const origin = toString(payload.origin);
  if (origin) opts.origin = origin;
  const limit = toNumber(payload.limit);
  if (limit !== undefined) opts.limit = limit;
  const cursor = toNumber(payload.cursor);
  if (cursor !== undefined) opts.cursor = cursor;
  return opts;
};

const buildTopSitesOptions = (payload: unknown): TopSitesOptions => {
  if (!isRecord(payload)) return {};
  const opts: TopSitesOptions = {};
  const days = toNumber(payload.days);
  if (days !== undefined) opts.days = days;
  const limit = toNumber(payload.limit);
  if (limit !== undefined) opts.limit = limit;
  return opts;
};

const buildRemoveOptions = (payload: unknown): HistoryRemoveOptions => {
  if (!isRecord(payload)) return {};
  const opts: HistoryRemoveOptions = {};
  const url = toString(payload.url);
  if (url) opts.url = url;
  const origin = toString(payload.origin);
  if (origin) opts.origin = origin;
  const beforeTs = toNumber(payload.beforeTs);
  if (beforeTs !== undefined) opts.beforeTs = beforeTs;
  return opts;
};

export const registerHistoryIpc = (ipcMain: IpcMain): void => {
  ipcMain.handle('merezhyvo:history:query', async (_event, payload) => {
    const opts = buildQueryOptions(payload);
    return query(opts);
  });

  ipcMain.handle('merezhyvo:history:top-sites', async (_event, payload) => {
    const opts = buildTopSitesOptions(payload);
    return topSites(opts);
  });

  ipcMain.handle('merezhyvo:history:remove', async (_event, payload) => {
    const opts = buildRemoveOptions(payload);
    const removed = await remove(opts);
    return { removed };
  });

  ipcMain.handle('merezhyvo:history:clear-all', async () => {
    await clearAll();
    return { ok: true };
  });
};
