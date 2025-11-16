'use strict';

import type { IpcMain, WebContents } from 'electron';
import type { FileDialogOptions } from '../../src/types/models';
import { listDirectory, readFileContent, writeFileContent } from './file-dialog';

const pendingSelections = new Map<string, (value: string[] | null) => void>();

const makeRequestId = (): string => `fd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const waitForSelection = (requestId: string): Promise<string[] | null> =>
  new Promise((resolve) => {
    pendingSelections.set(requestId, resolve);
  });

const resolveSelection = (requestId: string, paths: string[] | null): void => {
  const resolve = pendingSelections.get(requestId);
  if (resolve) {
    resolve(paths);
    pendingSelections.delete(requestId);
  }
};

export const promptForPaths = async (target: WebContents | null, options: FileDialogOptions): Promise<string[] | null> => {
  if (!target || target.isDestroyed()) return null;
  const requestId = makeRequestId();
  try {
    target.send('merezhyvo:file-dialog:open', { requestId, options });
  } catch {
    return null;
  }
  const paths = await waitForSelection(requestId);
  return paths;
};

export const registerFileDialogIpc = (ipcMain: IpcMain): void => {
  ipcMain.handle('merezhyvo:file-dialog:list', async (_event, payload: { path?: string; filters?: string[] }) => {
    const result = await listDirectory(payload?.path, payload?.filters ?? undefined);
    return result;
  });

  ipcMain.handle('merezhyvo:file-dialog:read', async (_event, payload: { path?: string }) => {
    if (!payload?.path) {
      throw new Error('File path is required');
    }
    return await readFileContent(payload.path);
  });

  ipcMain.handle('merezhyvo:file-dialog:selection', async (_event, payload: { requestId?: string; paths?: string[] | null }) => {
    if (!payload?.requestId) return { ok: false };
    resolveSelection(payload.requestId, payload.paths ?? null);
    return { ok: true };
  });

  ipcMain.handle('merezhyvo:file-dialog:write', async (_event, payload: { path?: string; data?: string; encoding?: BufferEncoding }) => {
    if (!payload?.path || typeof payload.data !== 'string') {
      throw new Error('Path and data are required');
    }
    await writeFileContent(payload.path, payload.data, payload.encoding ?? 'utf8');
    return { ok: true };
  });
};
