import { readSettingsState, writeSettingsState } from './shortcuts';

export type KeyboardSettings = {
  enabledLayouts: string[];   // лише мовні лейаути, без symbols
  defaultLayout: string;      // один із enabledLayouts
};

function sanitizeKeyboardSettings(kb?: Partial<KeyboardSettings>): KeyboardSettings {
  // Гарантуємо непорожній список мов
  const raw = (Array.isArray(kb?.enabledLayouts) && kb!.enabledLayouts!.length > 0)
    ? Array.from(new Set(kb!.enabledLayouts!))
    : ['en'];

  const enabled: string[] = raw.length ? raw : ['en'];

  // Гарантуємо string, навіть якщо щось піде не так
  const def: string =
    (typeof kb?.defaultLayout === 'string' && enabled.includes(kb.defaultLayout as string))
      ? (kb!.defaultLayout as string)
      : (enabled[0] ?? 'en');

  return { enabledLayouts: enabled, defaultLayout: def };
}

export async function getKeyboardSettings(): Promise<KeyboardSettings> {
  const st = await readSettingsState();
  return sanitizeKeyboardSettings((st as any)?.keyboard);
}

export async function updateKeyboardSettings(patch: Partial<KeyboardSettings>): Promise<KeyboardSettings> {
  const st = await readSettingsState();
  const current = sanitizeKeyboardSettings((st as any)?.keyboard);
  const next = sanitizeKeyboardSettings({ ...current, ...patch });
  const nextState = { ...(st ?? {}), keyboard: next };
  await writeSettingsState(nextState);
  return next;
}
