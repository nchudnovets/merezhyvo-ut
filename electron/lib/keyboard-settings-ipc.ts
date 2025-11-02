// electron/main/keyboard-settings-ipc.ts
import { app, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';

type KeyboardSettings = { enabledLayouts: string[]; defaultLayout: string };
const DEFAULTS: KeyboardSettings = { enabledLayouts: ['en'], defaultLayout: 'en' };

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

async function readAll(): Promise<any> {
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeAll(obj: any): Promise<void> {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  const tmp = settingsPath + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(obj, null, 2), 'utf8');
  await fs.rename(tmp, settingsPath);
}

async function getKB(): Promise<KeyboardSettings> {
  const all = await readAll();
  const kb = all.keyboard ?? {};
  const enabled = Array.isArray(kb.enabledLayouts) && kb.enabledLayouts.length
    ? kb.enabledLayouts
    : DEFAULTS.enabledLayouts;

  const def = (typeof kb.defaultLayout === 'string' && enabled.includes(kb.defaultLayout))
    ? kb.defaultLayout
    : enabled[0];

  return { enabledLayouts: enabled, defaultLayout: def };
}

async function updateKB(patch: Partial<KeyboardSettings>): Promise<KeyboardSettings> {
  const all = await readAll();
  const current = await getKB();

  const next: KeyboardSettings = {
    enabledLayouts: (patch.enabledLayouts && patch.enabledLayouts.length)
      ? patch.enabledLayouts
      : current.enabledLayouts,
    defaultLayout: patch.defaultLayout ?? current.defaultLayout
  };

  if (!next.enabledLayouts.includes(next.defaultLayout)) {
    next.defaultLayout = next.enabledLayouts[0] ?? 'en';
  }

  all.keyboard = next;
  await writeAll(all);
  return next;
}

export function registerKeyboardSettingsIPC(): void {
  ipcMain.handle('mzr:kb:get', () => getKB());
  ipcMain.handle('mzr:kb:update', (_evt, patch: Partial<KeyboardSettings>) => updateKB(patch ?? {}));
}
