// electron/main/keyboard-settings-ipc.ts
import { app, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import { sanitizeKeyboardSettings, type KeyboardSettings } from './keyboard-settings';

type MutableKeyboardSettings = Partial<KeyboardSettings> & Record<string, unknown>;
type StoredSettings = Record<string, unknown> & {
  keyboard?: MutableKeyboardSettings;
};

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toStoredSettings = (value: unknown): StoredSettings => (isRecord(value) ? { ...value } : {});

const normalizeLayouts = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const entries = value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  return entries.length > 0 ? Array.from(new Set(entries)) : undefined;
};

const sanitizePatch = (raw: unknown): Partial<KeyboardSettings> => {
  if (!isRecord(raw)) return {};
  const patch: Partial<KeyboardSettings> = {};
  const layouts = normalizeLayouts(raw.enabledLayouts);
  if (layouts) patch.enabledLayouts = layouts;
  if (typeof raw.defaultLayout === 'string') {
    patch.defaultLayout = raw.defaultLayout.trim();
  }
  return patch;
};

async function readAll(): Promise<StoredSettings> {
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    return toStoredSettings(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function writeAll(obj: StoredSettings): Promise<void> {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  const tmp = `${settingsPath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), 'utf8');
  await fs.rename(tmp, settingsPath);
}

const resolveKeyboardSettings = (value: unknown): KeyboardSettings => sanitizeKeyboardSettings(value ?? {});

async function getKB(): Promise<KeyboardSettings> {
  const all = await readAll();
  return resolveKeyboardSettings(all.keyboard);
}

async function updateKB(patch: Partial<KeyboardSettings>): Promise<KeyboardSettings> {
  const all = await readAll();
  const current = resolveKeyboardSettings(all.keyboard);
  const next = sanitizeKeyboardSettings({ ...current, ...patch });
  await writeAll({ ...all, keyboard: next });
  return next;
}

export function registerKeyboardSettingsIPC(): void {
  ipcMain.handle('mzr:kb:get', () => getKB());
  ipcMain.handle('mzr:kb:update', (_evt, patch) => updateKB(sanitizePatch(patch)));
}
