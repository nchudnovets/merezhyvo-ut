import fs from 'fs';
import path from 'path';
import { net, session } from 'electron';
import type { ClientRequest, IncomingMessage, Session } from 'electron';
import { DOWNLOADS_FOLDER } from './internal-paths';

type DownloadState = 'queued' | 'downloading' | 'completed' | 'failed';

type DownloadEntry = {
  id: string;
  url: string;
  filename: string;
  referer?: string;
  originalReferer?: string;
  session?: Session;
  state: DownloadState;
  received: number;
  total: number;
  startedAt?: number;
  finishedAt?: number;
  tempPath?: string;
  finalPath?: string;
  retriedWithOrigin?: boolean;
  retriedWithoutReferer?: boolean;
  error?: string;
  request?: ClientRequest;
  stream?: fs.WriteStream;
  streamErrorHandler?: (error: Error) => void;
  cleanup?: () => void;
};

export type ManualDownloadHandle = {
  id: string;
  updateProgress: (received: number, total?: number) => void;
  finalize: (success: boolean, error?: string) => void;
};

const DOWNLOAD_SETTINGS = {
  defaultDir: DOWNLOADS_FOLDER,
  concurrent: 2
};

const entries = new Map<string, DownloadEntry>();
const queue: string[] = [];
const activeIds = new Set<string>();
const stateListeners: Array<(entry: DownloadEntry) => void> = [];
const progressListeners: Array<(entry: DownloadEntry) => void> = [];

const toOrigin = (value?: string): string | undefined => {
  if (!value) return undefined;
  try {
    const u = new URL(value);
    return `${u.protocol}//${u.host}`;
  } catch {
    return undefined;
  }
};

const normalizeReferer = (ref?: string): string | undefined => toOrigin(ref);

const createEntryId = (): string =>
  `dl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeConcurrent = (value: number): number => Math.min(3, Math.max(1, Math.round(value)));

export const sanitizeFilename = (raw: string): string => {
  const name = raw.replace(/\s+/g, ' ').trim() || 'download';
  const illegal = /[\\/?%*:|"<>]/g;
  return name.replace(illegal, '_').replace(/\.+$/, '') || 'download';
};

const extractFilename = (urlStr: string, disposition?: string): string => {
  if (disposition) {
    const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(disposition);
    if (match && match[1]) {
      try {
        const decoded = decodeURIComponent(match[1]);
        return sanitizeFilename(decoded);
      } catch {
        return sanitizeFilename(match[1]);
      }
    }
  }
  try {
    const parsed = new URL(urlStr);
    if (parsed.pathname) {
      return sanitizeFilename(path.basename(parsed.pathname)) || 'download';
    }
  } catch {
    // noop
  }
  const fallback = urlStr.split('/').pop() || 'download';
  return sanitizeFilename(fallback);
};

const ensureUniqueFilename = async (dir: string, base: string): Promise<string> => {
  const ext = path.extname(base);
  const name = path.basename(base, ext);
  let candidate = base;
  let idx = 1;
  while (true) {
    const exists = await fs.promises
      .access(path.join(dir, candidate))
      .then(() => true)
      .catch(() => false);
    if (!exists) return candidate;
    idx += 1;
    candidate = `${name} (${idx})${ext}`;
  }
};

const emitState = (entry: DownloadEntry): void => {
  for (const listener of stateListeners) {
    try {
      listener(entry);
    } catch {
      // noop
    }
  }
};

const emitProgress = (entry: DownloadEntry): void => {
  for (const listener of progressListeners) {
    try {
      listener(entry);
    } catch {
      // noop
    }
  }
};

const tryStartNext = (): void => {
  if (activeIds.size >= DOWNLOAD_SETTINGS.concurrent) return;
  const nextId = queue.shift();
  if (!nextId) return;
  const entry = entries.get(nextId);
  if (!entry || entry.state !== 'queued') return;
  void startEntry(entry);
};

const finalizeEntry = (entry: DownloadEntry, success: boolean, errorMessage?: string): void => {
  if (entry.state === 'completed' || entry.state === 'failed') return;
  activeIds.delete(entry.id);
  entry.state = success ? 'completed' : 'failed';
  entry.finishedAt = Date.now();
  if (!success && errorMessage) {
    entry.error = errorMessage;
  }
  entry.cleanup?.();
  entry.cleanup = undefined;
  const stream = entry.stream;
  const streamErrorHandler = entry.streamErrorHandler;
  entry.stream = undefined;
  entry.streamErrorHandler = undefined;
  if (stream) {
    if (!success && !stream.destroyed) {
      try {
        stream.destroy();
      } catch {
        // ignore destroy errors
      }
    }
    if (streamErrorHandler) {
      try {
        stream.off('error', streamErrorHandler);
      } catch {
        // noop
      }
    }
  }
  if (entry.request) {
    entry.request.abort();
    entry.request = undefined;
  }
  emitState(entry);
  tryStartNext();
};

const issueRequest = (entry: DownloadEntry, dir: string): void => {
  if (entry.state !== 'downloading') return;
  const requestSession = entry.session ?? session.defaultSession;
  const request = net.request({ url: entry.url, session: requestSession });
  entry.request = request;

  if (entry.referer) {
    try {
      request.setHeader('Referer', entry.referer);
    } catch {
      // noop
    }
  }

  request.on('error', (err) => {
    const message = typeof err === 'object' ? String((err as Error).message ?? err) : String(err);
    const lower = message.toLowerCase();
    const invalidRef = lower.includes('referrer');
    const shouldRetry =
      entry.referer &&
      !entry.retriedWithoutReferer &&
      (message.includes('ERR_BLOCKED_BY_CLIENT') || invalidRef);
    if (shouldRetry) {
      entry.referer = undefined;
      entry.retriedWithoutReferer = true;
      entry.request = undefined;
      issueRequest(entry, dir);
      return;
    }
    finalizeEntry(entry, false, String(err));
  });

  request.on('response', (response: IncomingMessage) => {
    const contentType = response.headers['content-type'] ?? '';
    const isHtmlLike =
      typeof contentType === 'string' &&
      (contentType.includes('text/html') || contentType.includes('application/php'));
    const shouldRetryWithOrigin =
      isHtmlLike &&
      entry.originalReferer &&
      !entry.retriedWithOrigin &&
      entry.referer !== entry.originalReferer;
    if (shouldRetryWithOrigin) {
      // Retry once with origin referrer if we stripped it earlier and got an HTML/php response
      entry.referer = entry.originalReferer;
      entry.retriedWithOrigin = true;
      entry.request = undefined;
      try {
        const destroyFn: ((error?: Error) => void) | undefined =
          (response as { destroy?: (error?: Error) => void }).destroy;
        destroyFn?.call(response as IncomingMessage);
      } catch {
        // ignore
      }
      issueRequest(entry, dir);
      return;
    }

    handleResponse(entry, response, dir).catch((err) => {
      finalizeEntry(entry, false, String(err));
    });
  });

  request.end();
};

const startEntry = async (entry: DownloadEntry): Promise<void> => {
  if (entry.state !== 'queued') return;
  entry.state = 'downloading';
  entry.startedAt = Date.now();
  emitState(entry);
  activeIds.add(entry.id);

  const dir = DOWNLOAD_SETTINGS.defaultDir;
  try {
    await fs.promises.mkdir(dir, { recursive: true });
  } catch {
    // noop
  }
  issueRequest(entry, dir);
};

  const handleResponse = async (
    entry: DownloadEntry,
    response: IncomingMessage,
    dir: string
  ): Promise<void> => {
    const status = response.statusCode ?? 0;
    if (status >= 400) {
      console.error(`[downloads] bad status ${entry.id} ${status}`);
      finalizeEntry(entry, false, `http status ${status}`);
      return;
    }
  const disposition = response.headers['content-disposition'];
  const suggested = extractFilename(entry.url, Array.isArray(disposition) ? disposition[0] : disposition);
  const filename = await ensureUniqueFilename(dir, suggested);
  entry.filename = filename;
  entry.total = Number(response.headers['content-length'] ?? 0);
  const tempPath = path.join(dir, `${filename}.part`);
  const finalPath = path.join(dir, filename);
  entry.tempPath = tempPath;
  entry.finalPath = finalPath;

  const stream = fs.createWriteStream(tempPath);
  entry.stream = stream;
  const onStreamError = () => {
    // ignore
  };
  stream.on('error', onStreamError);
  entry.streamErrorHandler = onStreamError;

  const cleanup = () => {
    response.off('data', onData);
    response.off('end', onEnd);
    response.off('error', onErr);
  };
  entry.cleanup = cleanup;

  const onData = (chunk: Buffer) => {
    entry.received += chunk.length;
    emitProgress(entry);
    if (entry.state !== 'downloading') return;
    if (!stream.destroyed) {
      try {
        stream.write(chunk);
      } catch {
        // ignore writes after stream destroyed
      }
    }
  };

  const onEnd = async () => {
    cleanup();
    stream.end();
    try {
      await fs.promises.rename(tempPath, finalPath);
      finalizeEntry(entry, true);
    } catch (err: unknown) {
      await fs.promises.unlink(tempPath).catch(() => {});
      finalizeEntry(entry, false, String(err));
    }
  };

  const onErr = async (err: unknown) => {
    cleanup();
    if (!stream.destroyed) {
      try {
        stream.destroy();
      } catch {
        // ignore destroy errors
      }
    }
    console.error(`[downloads] response error ${entry.id}`, err);
    finalizeEntry(entry, false, String(err));
  };

  response.on('data', onData);
  response.once('end', onEnd);
  response.once('error', onErr);
};

export const enqueue = (url: string, referer?: string, sessionToUse?: Session): string => {
  const id = createEntryId();
  const filename = sanitizeFilename(path.basename(url) || 'download');
  const entry: DownloadEntry = {
    id,
    url,
    filename,
    referer: normalizeReferer(referer),
    originalReferer: normalizeReferer(referer),
    session: sessionToUse,
    state: 'queued',
    received: 0,
    total: 0
  };
  entries.set(id, entry);
  queue.push(id);
  emitState(entry);
  tryStartNext();
  return id;
};

export const activeCount = (): number => activeIds.size;

export const onState = (cb: (entry: DownloadEntry) => void): (() => void) => {
  stateListeners.push(cb);
  return () => {
    const index = stateListeners.indexOf(cb);
    if (index !== -1) stateListeners.splice(index, 1);
  };
};

export const onProgress = (cb: (entry: DownloadEntry) => void): (() => void) => {
  progressListeners.push(cb);
  return () => {
    const index = progressListeners.indexOf(cb);
    if (index !== -1) progressListeners.splice(index, 1);
  };
};

export const setDefaultDir = (value: string): void => {
  if (!value || typeof value !== 'string') return;
  DOWNLOAD_SETTINGS.defaultDir = value;
};

export const getDefaultDir = (): string => DOWNLOAD_SETTINGS.defaultDir;

export const setConcurrent = (value: number): void => {
  DOWNLOAD_SETTINGS.concurrent = normalizeConcurrent(value);
  tryStartNext();
};

const normalizeBytes = (value?: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
};

export const beginManualDownload = (meta: {
  url: string;
  filename: string;
  total?: number;
}): ManualDownloadHandle => {
  const id = createEntryId();
  const entry: DownloadEntry = {
    id,
    url: meta.url,
    filename: sanitizeFilename(meta.filename || 'download'),
    state: 'downloading',
    received: 0,
    total: normalizeBytes(meta.total),
    startedAt: Date.now()
  };
  entries.set(id, entry);
  activeIds.add(id);
  emitState(entry);

  const updateProgress = (received: number, total?: number) => {
    if (entry.state !== 'downloading') return;
    if (typeof received === 'number' && Number.isFinite(received) && received >= 0) {
      entry.received = received;
    }
    if (typeof total === 'number' && Number.isFinite(total) && total >= 0) {
      entry.total = total;
    }
    emitProgress(entry);
  };

  const finalize = (success: boolean, error?: string) => {
    finalizeEntry(entry, success, error);
  };

  return { id, updateProgress, finalize };
};
