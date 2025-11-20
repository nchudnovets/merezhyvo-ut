'use strict';

import type { BrowserWindow, IpcMain, WebContents } from 'electron';
import type { FileDialogOptions } from '../../src/types/models';
import { listDirectory, readFileAsBase64, readFileContent, writeFileContent } from './file-dialog';

const pendingSelections = new Map<string, (value: string[] | null) => void>();

const guestHostMap = new Map<number, WebContents>();

export const linkGuestWebContentsToHost = (guest: WebContents, host: WebContents): void => {
  if (!guest || typeof guest.id !== 'number') return;
  guestHostMap.set(guest.id, host);
};

export const unlinkGuestWebContents = (guest: WebContents | null): void => {
  if (!guest || typeof guest.id !== 'number') return;
  guestHostMap.delete(guest.id);
};

const makeRequestId = (): string => `fd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

type WebContentsWithHost = WebContents & {
  hostWebContents?: WebContents | null;
  getOwnerBrowserWindow?: () => BrowserWindow | null;
};

const resolveDispatchTarget = (target: WebContents | null): WebContents | null => {
  if (!target || typeof target.isDestroyed !== 'function' || target.isDestroyed()) return null;
  const trackedHost = guestHostMap.get(target.id);
  if (trackedHost && typeof trackedHost.isDestroyed === 'function' && !trackedHost.isDestroyed()) {
    return trackedHost;
  }
  const host = (target as WebContentsWithHost).hostWebContents;
  if (host && typeof host.isDestroyed === 'function' && !host.isDestroyed()) {
    return host;
  }
  const targetWithOwner = target as WebContentsWithHost;
  const ownerWindow =
    typeof targetWithOwner.getOwnerBrowserWindow === 'function'
      ? targetWithOwner.getOwnerBrowserWindow()
      : null;
  const ownerContents = ownerWindow?.webContents;
  if (
    ownerContents &&
    typeof ownerContents.isDestroyed === 'function' &&
    !ownerContents.isDestroyed()
  ) {
    return ownerContents;
  }
  return target;
};

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
  const dispatchTarget = resolveDispatchTarget(target);
  if (!dispatchTarget) return null;
  const requestId = makeRequestId();
  try {
    dispatchTarget.send('merezhyvo:file-dialog:open', { requestId, options });
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

  ipcMain.handle('merezhyvo:file-dialog:read-binary', async (_event, payload: { path?: string }) => {
    if (!payload?.path) {
      throw new Error('File path is required');
    }
    const data = await readFileAsBase64(payload.path);
    return { data };
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
