'use strict';

import crypto from 'crypto';
import psl from 'psl';
import { BrowserWindow, type IpcMain, type IpcMainInvokeEvent } from 'electron';
import {
  addOrUpdateEntry,
  blacklist,
  changeMasterPassword,
  createMasterPassword,
  getCachedSettings,
  getEntriesMeta,
  getEntrySecret,
  getSettings,
  hasVaultFile,
  isOriginBlacklisted,
  loadVault,
  lock as lockVault,
  removeEntry,
  save,
  setSettings,
  isVaultUnlocked
} from './vault';
import type { Settings } from './vault';
import {
  detectFormat as detectPasswordFormat,
  previewCSV,
  importCSV as importCsvFile,
  exportCSV as exportCsvFile,
  importEncryptedJSON as importMzrpass,
  exportEncryptedJSON as exportMzrpass
} from './import_export';

type EntryInput = {
  id?: string;
  origin: string;
  signonRealm: string;
  formAction?: string;
  username: string;
  password: string;
  notes?: string;
  tags?: string[];
};

type CapturePayload = {
  origin: string;
  signonRealm: string;
  formAction: string;
  username?: string;
  password: string;
};

const captureStore = new Map<string, CapturePayload>();
const pendingActions = new Map<string, { action: CaptureAction; entryId?: string }>();
type CaptureAction = 'save' | 'update' | 'keep-both' | 'never';
const captureActionSet: Set<CaptureAction> = new Set(['save', 'update', 'keep-both', 'never']);

const isCaptureAction = (value: string): value is CaptureAction => captureActionSet.has(value as CaptureAction);

const getCapturePayload = (captureId: string): CapturePayload | null => {
  return captureStore.get(captureId) ?? null;
};

const clearCapturePayload = (captureId: string): void => {
  captureStore.delete(captureId);
};

const applyCaptureAction = async (captureId: string, record: { action: CaptureAction; entryId?: string }) => {
  const payload = getCapturePayload(captureId);
  if (!payload) {
    return { error: 'Capture data unavailable' };
  }
  if (record.action === 'never') {
    blacklist.add(payload.origin);
    await save();
    resetAutoLock();
    clearCapturePayload(captureId);
    pendingActions.delete(captureId);
    return { ok: true };
  }
  const entryResult = addOrUpdateEntry({
    id: record.action === 'update' ? record.entryId : undefined,
    origin: payload.origin,
    signonRealm: payload.signonRealm,
    formAction: payload.formAction,
    username: payload.username ?? '',
    password: payload.password
  });
  await save();
  resetAutoLock();
  clearCapturePayload(captureId);
  pendingActions.delete(captureId);
  return { ok: true, updated: entryResult.updated };
};

const processPendingActions = async (): Promise<void> => {
  if (!isVaultUnlocked()) return;
  for (const [captureId, record] of Array.from(pendingActions.entries())) {
    try {
      await applyCaptureAction(captureId, record);
    } catch {
      // ignore errors
    }
  }
};

const getSiteName = (origin: string): string => {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
};

const broadcastToRenderers = (channel: string, payload: unknown): void => {
  for (const win of BrowserWindow.getAllWindows()) {
    try {
      win.webContents.send(channel, payload);
    } catch {
      // ignore
    }
  }
};

const registerCapture = (payload: CapturePayload, providedId?: string): string => {
  const captureId = providedId ?? crypto.randomBytes(12).toString('hex');
  captureStore.set(captureId, payload);
  return captureId;
};

const broadcastPrompt = (captureId: string, payload: CapturePayload, siteName: string, isUpdate: boolean, entryId?: string): void => {
  broadcastToRenderers('merezhyvo:pw:prompt', {
    captureId,
    origin: payload.origin,
    signonRealm: payload.signonRealm,
    formAction: payload.formAction,
    username: payload.username ?? '',
    siteName,
    isUpdate,
    entryId
  });
};

const requestUnlockDialog = (payload: { siteName?: string; origin?: string; username?: string }) => {
  broadcastToRenderers('merezhyvo:pw:unlock-required', payload);
};

export { requestUnlockDialog };

// remove broadcast unlock required per new UX

const processCapturePayload = (payload: CapturePayload, captureId?: string): void => {
  const settings = getCachedSettings();
  if (!settings.offerToSave) return;
  if (!payload.password) return;
  let parsedOrigin: URL | null = null;
  try {
    parsedOrigin = new URL(payload.origin);
  } catch {
    // ignore
  }
  if (settings.disallowHttp && parsedOrigin && parsedOrigin.protocol === 'http:') return;
  if (isOriginBlacklisted(payload.origin)) return;

  const id = registerCapture(payload, captureId);
  const siteName = getSiteName(payload.origin);

  let existingId: string | undefined;
  if (isVaultUnlocked()) {
    const entries = getEntriesMeta();
    const existing = entries.find(
      (entry) => entry.signonRealm === payload.signonRealm && entry.username === payload.username
    );
    existingId = existing?.id;
  }
  broadcastPrompt(id, payload, siteName, Boolean(existingId), existingId);
};
type FocusFieldDetail = {
  origin: string;
  signonRealm: string;
  field: 'username' | 'password';
  timestamp: number;
};

type AutofillOption = {
  id: string;
  username: string;
  siteName: string;
};

type AutofillState = {
  available: boolean;
  locked: boolean;
  options: AutofillOption[];
  siteName: string;
};

const focusFieldMap = new Map<number, FocusFieldDetail>();
const blurTimers = new Map<number, NodeJS.Timeout>();
const MAX_AUTOFILL_OPTIONS = 5;

const computeSiteName = (origin: string): string => {
  try {
    return new URL(origin).hostname || origin;
  } catch {
    return origin;
  }
};

const computeEffectiveDomain = (origin: string): string | null => {
  try {
    const hostname = new URL(origin).hostname;
    if (!hostname) return null;
    return psl.get(hostname) ?? hostname;
  } catch {
    return null;
  }
};

export const getAutofillStateForWebContents = (wcId?: number): AutofillState => {
  if (!wcId) {
    return { available: false, locked: false, options: [], siteName: '' };
  }
  const focus = focusFieldMap.get(wcId);
  if (!focus) {
    return { available: false, locked: false, options: [], siteName: '' };
  }
  const siteName = computeSiteName(focus.origin);
  if (!isVaultUnlocked()) {
    return { available: true, locked: true, options: [], siteName };
  }
  const focusEtld = computeEffectiveDomain(focus.origin);
  const entries = getEntriesMeta();
  const filtered: AutofillOption[] = [];
  for (const entry of entries) {
    if (filtered.length >= MAX_AUTOFILL_OPTIONS) break;
    if (entry.signonRealm === focus.signonRealm) {
      filtered.push({ id: entry.id, username: entry.username, siteName: computeSiteName(entry.origin) });
      continue;
    }
    if (!focusEtld) continue;
    const entryEtld = computeEffectiveDomain(entry.origin);
    if (entryEtld && entryEtld === focusEtld) {
      filtered.push({ id: entry.id, username: entry.username, siteName: computeSiteName(entry.origin) });
    }
  }
  return {
    available: true,
    locked: false,
    options: filtered,
    siteName
  };
};

const cancelFocusClear = (wcId: number): void => {
  const timer = blurTimers.get(wcId);
  if (timer) {
    clearTimeout(timer);
    blurTimers.delete(wcId);
  }
};

const scheduleFocusClear = (wcId: number): void => {
  cancelFocusClear(wcId);
  const timer = setTimeout(() => {
    focusFieldMap.delete(wcId);
    blurTimers.delete(wcId);
  }, 600);
  blurTimers.set(wcId, timer);
};

const registerFieldFocus = (wcId: number, payload: Omit<FocusFieldDetail, 'timestamp'>): void => {
  cancelFocusClear(wcId);
  focusFieldMap.set(wcId, { ...payload, timestamp: Date.now() });
};
const toString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const toTags = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const filtered = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
  return filtered.length > 0 ? Array.from(new Set(filtered)) : undefined;
};

type QueryPayload = { query?: string };

let autoLockTimer: NodeJS.Timeout | null = null;
let autoLockDurationMs: number | null = null;

const clearAutoLock = (): void => {
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
};

const scheduleAutoLock = (): void => {
  clearAutoLock();
  if (!autoLockDurationMs || autoLockDurationMs <= 0) return;
  autoLockTimer = setTimeout(() => {
    lockVault();
    clearAutoLock();
    autoLockDurationMs = null;
  }, autoLockDurationMs);
};

const resetAutoLock = (): void => {
  if (!autoLockDurationMs || autoLockDurationMs <= 0) return;
  scheduleAutoLock();
};

const buildEntryInput = (payload: unknown, requireId = false): EntryInput | null => {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const id = toString(record.id);
  if (requireId && !id) return null;
  const origin = toString(record.origin);
  const signonRealm = toString(record.signonRealm);
  const username = toString(record.username);
  const password = toString(record.password);
  if (!origin || !signonRealm || !username || !password) return null;
  return {
    id: id ?? undefined,
    origin,
    signonRealm,
    formAction: toString(record.formAction),
    username,
    password,
    notes: toString(record.notes),
    tags: toTags(record.tags)
  };
};

const ensureQueryString = (payload: unknown): string | undefined => {
  if (!payload) return undefined;
  if (typeof payload === 'string') return payload.trim();
  if (typeof payload === 'object' && payload && 'query' in payload) {
    const record = payload as QueryPayload;
    return toString(record.query);
  }
  return undefined;
};

const wrapWithReset = <T>(fn: () => T): T => {
  try {
    return fn();
  } finally {
    resetAutoLock();
  }
};

export const registerPasswordsIpc = (ipcMain: IpcMain): void => {
  ipcMain.handle('merezhyvo:pw:status', () => ({
    locked: !isVaultUnlocked(),
    hasMaster: hasVaultFile(),
    autoLockMinutes: getCachedSettings().autoLockMinutes
  }));

  ipcMain.handle('merezhyvo:pw:unlock', async (_event, master: unknown, durationMinutes?: unknown) => {
    const masterValue = typeof master === 'string' ? master.trim() : '';
    if (!masterValue) {
      return { error: 'Master password is required' };
    }
    try {
      await loadVault(masterValue);
      await processPendingActions();
    } catch (err) {
      return { error: String(err) };
    }
    const minutes =
      typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) && durationMinutes > 0
        ? durationMinutes
        : null;
    autoLockDurationMs = minutes ? minutes * 60000 : null;
    resetAutoLock();
    return { ok: true };
  });

  ipcMain.handle('merezhyvo:pw:lock', () => {
    lockVault();
    clearAutoLock();
    autoLockDurationMs = null;
    return { ok: true };
  });

  ipcMain.handle('merezhyvo:pw:create-master', async (_event, master: unknown) => {
    const masterValue = typeof master === 'string' ? master.trim() : '';
    if (!masterValue) {
      return { error: 'Master password is required' };
    }
    if (hasVaultFile()) {
      return { error: 'Master password already exists' };
    }
    try {
      await createMasterPassword(masterValue);
      resetAutoLock();
      return { ok: true };
    } catch (err) {
      return { error: String(err) };
    }
  });

  ipcMain.handle('merezhyvo:pw:change-master', async (_event, payload) => {
    if (!payload || typeof payload !== 'object') {
      return { error: 'Invalid payload' };
    }
    const record = payload as { current?: unknown; next?: unknown };
    const current = typeof record.current === 'string' ? record.current.trim() : '';
    const next = typeof record.next === 'string' ? record.next : '';
    if (!current || !next) {
      return { error: 'Current and new master passwords are required' };
    }
    try {
      await changeMasterPassword(current, next);
      resetAutoLock();
      return { ok: true };
    } catch (err) {
      return { error: String(err) };
    }
  });

  ipcMain.handle('merezhyvo:pw:list', (_event, payload) => {
    return wrapWithReset(() => {
      const query = ensureQueryString(payload);
      const entries = getEntriesMeta();
      if (!query) return entries;
      const lower = query.toLowerCase();
      return entries.filter((entry) => {
        const haystack = [
          entry.origin,
          entry.signonRealm,
          entry.username,
          entry.notes ?? '',
          ...(entry.tags ?? [])
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(lower);
      });
    });
  });

  ipcMain.handle('merezhyvo:pw:get', (_event, id) => {
    const entryId = toString(id);
    if (!entryId) return { error: 'Entry id is required' };
    return wrapWithReset(() => getEntrySecret(entryId));
  });

  ipcMain.handle('merezhyvo:pw:add', async (_event, payload) => {
    const input = buildEntryInput(payload);
    if (!input) return { error: 'Invalid entry payload' };
    const result = addOrUpdateEntry(input);
    await save();
    resetAutoLock();
    return result;
  });

  ipcMain.handle('merezhyvo:pw:update', async (_event, id, payload) => {
    const entryId = toString(id);
    if (!entryId) return { error: 'Entry id is required' };
    const updates = { ...payload, id: entryId };
    const input = buildEntryInput(updates, true);
    if (!input) return { error: 'Invalid entry payload' };
    const result = addOrUpdateEntry(input);
    await save();
    resetAutoLock();
    return result;
  });

  ipcMain.handle('merezhyvo:pw:remove', async (_event, id) => {
    const entryId = toString(id);
    if (!entryId) return { error: 'Entry id is required' };
    removeEntry(entryId);
    await save();
    resetAutoLock();
    return { ok: true };
  });

  ipcMain.handle('merezhyvo:pw:blacklist:add', async (_event, origin) => {
    const originValue = toString(origin);
    if (!originValue) return { error: 'Origin is required' };
    blacklist.add(originValue);
    await save();
    resetAutoLock();
    return { ok: true };
  });

  ipcMain.handle('merezhyvo:pw:blacklist:remove', async (_event, origin) => {
    const originValue = toString(origin);
    if (!originValue) return { error: 'Origin is required' };
    blacklist.remove(originValue);
    await save();
    resetAutoLock();
    return { ok: true };
  });

  ipcMain.handle('merezhyvo:pw:blacklist:list', () => wrapWithReset(() => blacklist.list()));

  ipcMain.handle('merezhyvo:pw:settings:get', () => wrapWithReset(() => getSettings()));

  ipcMain.handle('merezhyvo:pw:settings:set', async (_event, payload) => {
    if (!payload || typeof payload !== 'object') return { error: 'Invalid settings payload' };
    const patch = payload as Partial<Settings>;
    const result = setSettings(patch);
    await save();
    resetAutoLock();
    return result;
  });

  ipcMain.handle('merezhyvo:pw:capture:action', async (_event, payload) => {
    if (!payload || typeof payload !== 'object') {
      return { error: 'Invalid payload' };
    }
    const actionRecord = payload as { captureId?: unknown; action?: unknown; entryId?: unknown };
    const captureId = toString(actionRecord.captureId);
    const actionRaw = typeof actionRecord.action === 'string' ? actionRecord.action : '';
    const entryId = toString(actionRecord.entryId);
    if (!captureId || !actionRaw) {
      return { error: 'Capture id and action are required' };
    }
    if (!isCaptureAction(actionRaw)) {
      return { error: 'Unknown action' };
    }
    const action = actionRaw;
    const capture = getCapturePayload(captureId);
    if (!capture) {
      return { error: 'Capture data unavailable' };
    }
    const queuedEntry = { action, entryId };
    if (!isVaultUnlocked()) {
      pendingActions.set(captureId, queuedEntry);
      return { ok: true, queued: true };
    }
    return applyCaptureAction(captureId, queuedEntry);
  });

  ipcMain.handle('merezhyvo:pw:notify-field-focus', (_event, payload) => {
    if (!payload || typeof payload !== 'object') return;
    const record = payload as { wcId?: unknown; origin?: unknown; signonRealm?: unknown; field?: unknown };
    const wcId = typeof record.wcId === 'number' ? Math.floor(record.wcId) : undefined;
    const origin = toString(record.origin);
    const signonRealm = toString(record.signonRealm);
    const field = record.field === 'password' ? 'password' : record.field === 'username' ? 'username' : undefined;
    if (!wcId || !origin || !signonRealm || !field) return;
    registerFieldFocus(wcId, { origin, signonRealm, field });
  });

  ipcMain.handle('merezhyvo:pw:notify-field-blur', (_event, wcIdPayload) => {
    const wcId = typeof wcIdPayload === 'number' ? Math.floor(wcIdPayload) : undefined;
    if (!wcId) return;
    scheduleFocusClear(wcId);
  });

  ipcMain.on('merezhyvo:pw:capture', (_event, rawPayload) => {
    if (!rawPayload || typeof rawPayload !== 'object') return;
    const record = rawPayload as Record<string, unknown>;
    const origin = toString(record.origin);
    const signonRealm = toString(record.signonRealm);
    const password = toString(record.password);
    if (!origin || !signonRealm || !password) return;
    const formAction = toString(record.formAction) || origin;
    if (!formAction) return;
    const username = toString(record.username);
    processCapturePayload({ origin, signonRealm, formAction, username, password });
  });

  ipcMain.handle('merezhyvo:pw:import:detect', (_event, payload) => {
    const candidate =
      payload && typeof payload === 'object' && 'content' in payload
        ? (payload as { content?: unknown }).content ?? payload
        : payload;
    const candidateString = typeof candidate === 'string' ? candidate : '';
    return detectPasswordFormat(candidateString);
  });

  ipcMain.handle('merezhyvo:pw:import:csv:preview', (_event, payload) => {
    const text = typeof payload === 'string' ? payload : (payload as { text?: string }).text ?? '';
    return previewCSV(text);
  });

  ipcMain.handle('merezhyvo:pw:import:csv:apply', (_event, payload) => {
    const wrapped = wrapWithReset(() => {
      const text = typeof payload === 'string' ? payload : (payload as { text?: string }).text ?? '';
      const mode = (payload as { mode?: string }).mode === 'replace' ? 'replace' : 'add';
      const result = importCsvFile(text, { mode });
      void save();
      return result;
    });
    return wrapped;
  });

  ipcMain.handle('merezhyvo:pw:import:mzrpass:apply', (_event: IpcMainInvokeEvent, payload: unknown) => {
    return wrapWithReset(() => {
      const recordCandidate = typeof payload === 'object' && payload !== null ? payload : {};
      const record = recordCandidate as { content?: Buffer | string; mode?: string; password?: string };
      const content: Buffer | string =
        typeof record.content === 'string' || Buffer.isBuffer(record.content)
          ? record.content
          : '';
      const mode = record.mode === 'replace' ? 'replace' : 'add';
      const password = typeof record.password === 'string' ? record.password : undefined;
      return importMzrpass(content, { mode, password });
    });
  });

  ipcMain.handle('merezhyvo:pw:export:csv', () => wrapWithReset(() => exportCsvFile()));

  ipcMain.handle('merezhyvo:pw:export:mzrpass', (_event, payload) =>
    wrapWithReset(() => exportMzrpass((payload as { password?: string })?.password))
  );
};
