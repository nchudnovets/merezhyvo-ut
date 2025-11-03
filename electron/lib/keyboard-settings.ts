import {
  readSettingsState,
  writeSettingsState,
  sanitizeKeyboardSettings,
  type KeyboardSettings
} from './shortcuts';

export async function getKeyboardSettings(): Promise<KeyboardSettings> {
  const st = await readSettingsState();
  return sanitizeKeyboardSettings(st.keyboard);
}

export async function updateKeyboardSettings(patch: Partial<KeyboardSettings>): Promise<KeyboardSettings> {
  const st = await readSettingsState();
  const current = sanitizeKeyboardSettings(st.keyboard);
  const next = sanitizeKeyboardSettings({ ...current, ...patch });
  const nextState = { ...st, keyboard: next };
  await writeSettingsState(nextState);
  return next;
}
