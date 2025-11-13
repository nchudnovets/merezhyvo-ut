'use strict';

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ensureDir, getProfileDir } from './shortcuts';

const fsp = fs.promises;
const FAVICONS_DIR = path.join(getProfileDir(), 'favicons');
const TEMP_SUFFIX = '.tmp';
const KNOWN_EXTENSIONS = ['png', 'ico', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'bin'];
const CONTENT_TYPE_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp'
};

const ensureDirReady = (): void => {
  ensureDir(FAVICONS_DIR);
};

const createAtomicPath = (target: string): string => {
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return `${target}.${unique}${TEMP_SUFFIX}`;
};

const writeAtomic = async (target: string, payload: Buffer): Promise<void> => {
  ensureDirReady();
  const tempPath = createAtomicPath(target);
  await fsp.writeFile(tempPath, payload);
  await fsp.rename(tempPath, target);
};

const resolveExtension = (contentType?: string | null, faviconUrl?: string | null): string => {
  if (contentType) {
    const normalized = contentType.split(';')[0].trim().toLowerCase();
    const mapped = CONTENT_TYPE_MAP[normalized];
    if (mapped) {
      return mapped;
    }
  }

  if (faviconUrl) {
    try {
      const parsed = new URL(faviconUrl);
      const ext = path.extname(parsed.pathname || '').toLowerCase().replace(/\./g, '');
      if (ext && KNOWN_EXTENSIONS.includes(ext)) {
        return ext;
      }
    } catch {
      // ignore
    }
  }

  return 'bin';
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

export const saveFromBuffer = async (
  buffer: Buffer | Uint8Array,
  contentType?: string | null,
  faviconUrl?: string | null
): Promise<string> => {
  const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (source.length === 0) {
    throw new Error('Favicon buffer cannot be empty.');
  }
  const id = crypto.createHash('sha1').update(source).digest('hex');
  const ext = resolveExtension(contentType, faviconUrl);
  const target = path.join(FAVICONS_DIR, `${id}.${ext}`);
  await writeAtomic(target, source);
  return id;
};

export const getPath = async (faviconId: string): Promise<string | null> => {
  if (!faviconId?.trim()) return null;
  for (const ext of KNOWN_EXTENSIONS) {
    const candidate = path.join(FAVICONS_DIR, `${faviconId}.${ext}`);
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  return null;
};

/*
 * Simple smoke usage:
 *   (async () => {
 *     const id = await saveFromBuffer(Buffer.from([0, 1, 2]), 'image/png');
 *     console.log('stored favicon', id);
 *   })();
 */
