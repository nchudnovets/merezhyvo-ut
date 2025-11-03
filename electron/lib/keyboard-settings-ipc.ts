// electron/main/keyboard-settings-ipc.ts
import { ipcMain } from 'electron';
import {
  sanitizeKeyboardSettings,
  type KeyboardSettings
} from './shortcuts';
import { getKeyboardSettings, updateKeyboardSettings } from './keyboard-settings';

const sanitizePatch = (raw: unknown): Partial<KeyboardSettings> => {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const base = sanitizeKeyboardSettings(source);
  const patch: Partial<KeyboardSettings> = {};
  if (Array.isArray(source.enabledLayouts)) {
    patch.enabledLayouts = base.enabledLayouts;
  }
  if (typeof source.defaultLayout === 'string') {
    patch.defaultLayout = base.defaultLayout;
  }
  return patch;
};

export function registerKeyboardSettingsIPC(): void {
  ipcMain.handle('mzr:kb:get', () => getKeyboardSettings());
  ipcMain.handle('mzr:kb:update', async (_evt, patch) => updateKeyboardSettings(sanitizePatch(patch)));
}
