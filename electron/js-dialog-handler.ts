import { app, ipcMain, webContents, type WebContents } from 'electron';

type PendingDialog = {
  callback: (accept: boolean, promptText?: string) => void;
  webContentsId: number;
};

type RunDialogDetails = {
  dialogType?: 'alert' | 'confirm' | 'prompt' | 'beforeunload';
  messageText?: string;
  defaultPrompt?: string;
  frame?: { url?: string };
};

const hostByGuestId = new Map<number, number>();
const pendingById = new Map<string, PendingDialog>();

const makeId = (): string => `jsd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const getHostWebContents = (contents: WebContents): WebContents | null => {
  const host = (contents as { hostWebContents?: WebContents | null }).hostWebContents;
  if (host) return host;
  const hostId = hostByGuestId.get(contents.id);
  return hostId ? webContents.fromId(hostId) ?? null : null;
};

const handleDialog = (
  contents: WebContents,
  details: RunDialogDetails,
  callback: (accept: boolean, promptText?: string) => void
) => {
  const webPrefs =
    (contents as { getLastWebPreferences?: () => { disableDialogs?: boolean } }).getLastWebPreferences?.() ?? {};
  if (webPrefs.disableDialogs) {
    callback(false, '');
    return;
  }

  const type = details?.dialogType ?? 'alert';
  if (type === 'prompt') {
    callback(false, '');
    return;
  }
  const host = getHostWebContents(contents);
  if (!host) {
    callback(false, '');
    return;
  }

  const requestId = makeId();
  pendingById.set(requestId, { callback, webContentsId: contents.id });
  host.send('mzr:js-dialog:open', {
    requestId,
    webContentsId: contents.id,
    type,
    message: details?.messageText ?? ''
  });
};

app.on('web-contents-created', (_event, contents) => {
  const type = contents.getType?.();
  if (type && type !== 'webview') return;

  const hostId = (contents as { hostWebContents?: WebContents | null }).hostWebContents?.id;
  if (hostId) {
    hostByGuestId.set(contents.id, hostId);
  }

  try {
    const webContentsAny = contents as unknown as {
      removeAllListeners: (event: string) => void;
      on: (event: string, listener: (details: RunDialogDetails, callback: (accept: boolean, promptText?: string) => void) => void) => void;
    };
    webContentsAny.removeAllListeners('-run-dialog');
    webContentsAny.on('-run-dialog', (details, callback) => handleDialog(contents, details, callback));
  } catch {
    // noop
  }

  contents.once('destroyed', () => {
    for (const [id, entry] of pendingById.entries()) {
      if (entry.webContentsId === contents.id) {
        pendingById.delete(id);
      }
    }
    hostByGuestId.delete(contents.id);
  });
});

ipcMain.on('mzr:js-dialog:attach', (event, payload) => {
  const wcId: number | null =
    typeof payload === 'number'
      ? payload
      : payload && typeof payload.webContentsId === 'number'
        ? payload.webContentsId
        : payload && typeof payload.wcId === 'number'
          ? payload.wcId
          : null;

  if (!wcId) return;

  hostByGuestId.set(wcId, event.sender.id);
});

ipcMain.on('mzr:js-dialog:respond', (_event, rawPayload) => {
  const payload = rawPayload as { requestId?: string; accept?: boolean; promptText?: string };
  const requestId = payload?.requestId;
  if (typeof requestId !== 'string') return;

  const pending = pendingById.get(requestId);
  if (!pending?.callback) return;

  const accept = payload?.accept !== false;
  const promptText = typeof payload?.promptText === 'string' ? payload.promptText : '';
  try {
    pending.callback(accept, promptText);
  } catch (err) {
    console.warn('[mzr-js-dialog] failed to handle dialog', err);
  } finally {
    pendingById.delete(requestId);
  }
});
