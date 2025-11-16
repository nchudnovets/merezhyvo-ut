'use strict';

import type { IpcMain } from 'electron';
import { listDirectory, readFileContent } from './file-dialog';

type FileDialogListPayload = {
  path?: string;
  filters?: string[];
};

type FileDialogReadPayload = {
  path?: string;
};

type FileDialogSelectionPayload = {
  requestId?: string;
  paths?: string[] | null;
};

const pendingSelections = new Map<string, (value: string[] | null) => void>();

export const waitForSelection = (requestId: string): Promise<string[] | null> =>
  new Promise((resolve) => {
    pendingSelections.set(requestId, resolve);
  });

export const resolveSelection = (requestId: string, paths: string[] | null): void => {
  const resolve = pendingSelections.get(requestId);
  if (resolve) {
    resolve(paths);
    pendingSelections.delete(requestId);
  }
};

export const registerFileDialogIpc = (ipcMain: IpcMain): void => {
  ipcMain.handle('merezhyvo:file-dialog:list', async (_event, payload: FileDialogListPayload) => {
    const result = await listDirectory(payload?.path, payload?.filters ?? undefined);
    return result;
  });

  ipcMain.handle('merezhyvo:file-dialog:read', async (_event, payload: FileDialogReadPayload) => {
    if (!payload?.path) {
      throw new Error('File path is required');
    }
    return await readFileContent(payload.path);
  });

  ipcMain.handle('merezhyvo:file-dialog:selection', async (_event, payload: FileDialogSelectionPayload) => {
    if (!payload?.requestId) return { ok: false };
    resolveSelection(payload.requestId, payload.paths ?? null);
    return { ok: true };
  });
};
