'use strict';

import path from 'path';
import fs from 'fs';
const fsp: typeof fs.promises = fs.promises;
import { getProfileDir, ensureDir } from './shortcuts';

export const TOR_SETTINGS_FILE: string = path.join(getProfileDir(), 'tor-settings.json');

type TorConfig = {
  containerId: string;
};

/** Extract errno-like code from unknown error. */
function getErrnoCode(err: unknown): string | undefined {
  return (err as NodeJS.ErrnoException)?.code;
}

/** Normalize raw config into a safe TorConfig shape. */
export function sanitizeTorConfig(raw: unknown): TorConfig {
  const containerId =
    typeof raw === 'object' && raw !== null && typeof (raw as any).containerId === 'string'
      ? (raw as any).containerId.trim()
      : '';
  return { containerId };
}

export async function readTorConfig(): Promise<TorConfig> {
  try {
    const raw = await fsp.readFile(TOR_SETTINGS_FILE, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return sanitizeTorConfig(parsed);
  } catch (err) {
    const code = getErrnoCode(err);
    if (code !== 'ENOENT') {
      console.warn('[merezhyvo] tor config read failed, falling back', err);
    }
    return sanitizeTorConfig(null);
  }
}

export async function writeTorConfig(config: unknown): Promise<TorConfig> {
  const sanitized = sanitizeTorConfig(config);
  try {
    ensureDir(path.dirname(TOR_SETTINGS_FILE));
    await fsp.writeFile(TOR_SETTINGS_FILE, JSON.stringify(sanitized, null, 2), 'utf8');
  } catch (err) {
    console.error('[merezhyvo] tor config write failed', err);
    throw err;
  }
  return sanitized;
}

export async function updateTorConfig(partial: Partial<TorConfig> | null | undefined): Promise<TorConfig> {
  const current = await readTorConfig();
  return writeTorConfig({ ...current, ...(partial || {}) });
}