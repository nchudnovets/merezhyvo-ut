import { readSettingsState, writeSettingsState } from './shortcuts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const entries = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  if (entries.length === 0) return undefined;
  return Array.from(new Set(entries));
};

export type KeyboardSettings = {
  enabledLayouts: string[];   // лише мовні лейаути, без symbols
  defaultLayout: string;      // один із enabledLayouts
};

export function sanitizeKeyboardSettings(kb?: unknown): KeyboardSettings {
  const source = isRecord(kb) ? kb : {};
  const enabled = toStringArray(source.enabledLayouts) ?? ['en'];

  const defaultCandidate = typeof source.defaultLayout === 'string' ? source.defaultLayout : undefined;
  const defaultLayout = (defaultCandidate && enabled.includes(defaultCandidate))
    ? defaultCandidate
    : enabled[0] ?? 'en';

  return { enabledLayouts: enabled, defaultLayout };
}

export async function getKeyboardSettings(): Promise<KeyboardSettings> {
  const st = await readSettingsState();
  const record = st as Record<string, unknown>;
  return sanitizeKeyboardSettings(record.keyboard);
}

export async function updateKeyboardSettings(patch: Partial<KeyboardSettings>): Promise<KeyboardSettings> {
  const st = await readSettingsState();
  const record = st as Record<string, unknown>;
  const current = sanitizeKeyboardSettings(record.keyboard);
  const next = sanitizeKeyboardSettings({ ...current, ...patch });
  const nextState = { ...record, keyboard: next };
  await writeSettingsState(nextState);
  return next;
}
