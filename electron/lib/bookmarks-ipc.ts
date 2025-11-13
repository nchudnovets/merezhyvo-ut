'use strict';

import type { IpcMain } from 'electron';
import {
  add,
  exportJson,
  importJson,
  isBookmarked,
  list,
  move,
  remove,
  update
} from './bookmarks';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const ensureString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
const ensureTags = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const filtered = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
  return filtered.length > 0 ? Array.from(new Set(filtered)) : undefined;
};

export const registerBookmarksIpc = (ipcMain: IpcMain): void => {
  ipcMain.handle('merezhyvo:bookmarks:list', async () => list());

  ipcMain.handle('merezhyvo:bookmarks:isBookmarked', async (_event, payload) => {
    const url = ensureString(payload);
    if (!url) return { yes: false };
    return isBookmarked(url);
  });

  ipcMain.handle('merezhyvo:bookmarks:add', async (_event, payload) => {
    if (!isRecord(payload)) return { ok: false, error: 'Invalid payload' };
    const nodeType = payload.type === 'folder' ? 'folder' : 'bookmark';
    const title = typeof payload.title === 'string' ? payload.title : undefined;
    const parentId = ensureString(payload.parentId);
    const tags = ensureTags(payload.tags);
    if (nodeType === 'bookmark') {
      const url = ensureString(payload.url);
      if (!url) return { ok: false, error: 'URL is required' };
      try {
        const nodeId = await add({ type: 'bookmark', url, title, parentId, tags });
        return { ok: true, nodeId };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    }
    const folderTitle = title || 'New Folder';
    try {
      const nodeId = await add({ type: 'folder', title: folderTitle, parentId });
      return { ok: true, nodeId };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('merezhyvo:bookmarks:update', async (_event, payload) => {
    if (!isRecord(payload)) return { ok: false };
    const id = ensureString(payload.id);
    if (!id) return { ok: false };
    const title = payload.title === undefined ? undefined : (typeof payload.title === 'string' ? payload.title : undefined);
    const url = payload.url === undefined ? undefined : (typeof payload.url === 'string' ? payload.url : undefined);
    const tags = payload.tags === undefined ? undefined : ensureTags(payload.tags);
    const result = await update({ id, title, url, tags });
    return { ok: result };
  });

  ipcMain.handle('merezhyvo:bookmarks:move', async (_event, payload) => {
    if (!isRecord(payload)) return { ok: false };
    const id = ensureString(payload.id);
    const newParentId = ensureString(payload.newParentId);
    if (!id || !newParentId) return { ok: false };
    const index = typeof payload.index === 'number' && Number.isFinite(payload.index) ? payload.index : undefined;
    const result = await move({ id, newParentId, index });
    return { ok: result };
  });

  ipcMain.handle('merezhyvo:bookmarks:remove', async (_event, payload) => {
    const id = ensureString(payload);
    if (!id) return { ok: false };
    const result = await remove({ id });
    return { ok: result };
  });

  ipcMain.handle('merezhyvo:bookmarks:export', async () => exportJson());

  ipcMain.handle('merezhyvo:bookmarks:import', async (_event, payload) => {
    if (!isRecord(payload)) return { ok: false };
    const result = await importJson(payload);
    return { ok: result };
  });
};
