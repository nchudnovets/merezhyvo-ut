'use strict';

import { sanitizeTorConfig, type TorConfig, readSettingsState, writeSettingsState } from './shortcuts';

export async function readTorConfig(): Promise<TorConfig> {
  const state = await readSettingsState();
  return sanitizeTorConfig(state.tor);
}

export async function writeTorConfig(config: unknown): Promise<TorConfig> {
  const state = await readSettingsState();
  const sanitized = sanitizeTorConfig(config);
  await writeSettingsState({ ...state, tor: sanitized });
  return sanitized;
}

export async function updateTorConfig(partial: Partial<TorConfig> | null | undefined): Promise<TorConfig> {
  const current = await readTorConfig();
  return writeTorConfig({ ...current, ...(partial ?? {}) });
}
