'use strict';

import type { IpcMain } from 'electron';
import { getPath } from './favicons';

const ensureString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

export const registerFaviconsIpc = (ipcMain: IpcMain): void => {
  ipcMain.handle('merezhyvo:favicons:get-path', async (_event, payload) => {
    const faviconId = ensureString(payload);
    if (!faviconId) return null;
    try {
      return await getPath(faviconId);
    } catch {
      return null;
    }
  });
};
