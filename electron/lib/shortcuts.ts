'use strict';

import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { app, type IpcMain } from 'electron';

type Nullable<T> = T | null;

export const BUNDLED_ICON_PATH = path.resolve(__dirname, '..', 'merezhyvo_256.png');
export const SETTINGS_SCHEMA = 1;

export type InstalledApp = {
  id: string;
  title: string;
  url: string;
  desktopFilePath: string;
  iconPath: string;
  single: boolean;
  createdAt: number;
  updatedAt: number;
};

export type SettingsState = {
  schema: typeof SETTINGS_SCHEMA;
  installedApps: InstalledApp[];
};

type SettingsLike = {
  schema?: unknown;
  installedApps?: unknown;
};

type InstalledAppLike = {
  id?: unknown;
  title?: unknown;
  url?: unknown;
  desktopFilePath?: unknown;
  iconPath?: unknown;
  single?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type DownloadOptions = {
  timeoutMs?: number;
};

type DownloadResult = {
  buffer: Buffer;
  contentType?: string;
};

type FaviconAsset = {
  buffer: Buffer;
  ext: string;
};

type RemoveInstalledAppParams = {
  id?: string | null;
  desktopFilePath?: string | null;
};

type RemoveInstalledAppResult =
  | { ok: false; error: string }
  | { ok: true; removed: InstalledApp; installedApps: InstalledApp[] };

type CreateShortcutPayload = {
  title?: unknown;
  url?: unknown;
  single?: unknown;
};

type CreateShortcutResult =
  | { ok: false; error: string }
  | {
      ok: true;
      desktopFilePath: string;
      iconPath: string;
      installedApp: InstalledApp;
    };

const fsp = fs.promises;

export const slugify = (value: unknown): string =>
  (value ?? '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'merezhyvo';

export const ensureDir = (dir: string): void => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // noop
  }
};

export const getProfileDir = (): string => {
  const dir = path.join(app.getPath('userData'), 'profiles', 'default');
  ensureDir(dir);
  return dir;
};

export const getSessionFilePath = (): string => path.join(getProfileDir(), 'session.json');
export const getSettingsFilePath = (): string => path.join(getProfileDir(), 'settings.json');

export const createDefaultSettingsState = (): SettingsState => ({
  schema: SETTINGS_SCHEMA,
  installedApps: []
});

export const normalizeInstalledAppUrl = (value: unknown): Nullable<string> => {
  const raw = typeof value === 'string' ? value : null;
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') return null;
    const lowerHref = parsed.href.toLowerCase();
    if (lowerHref === 'https://mail.google.com' || lowerHref.startsWith('https://mail.google.com/')) {
      return 'https://mail.google.com';
    }
    return parsed.href;
  } catch {
    return null;
  }
};

export const sanitizeInstalledAppEntry = (raw: unknown): Nullable<InstalledApp> => {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as InstalledAppLike;
  const id =
    typeof source.id === 'string' && source.id.trim().length ? source.id.trim() : null;
  const title = typeof source.title === 'string' ? source.title.trim() : '';
  const desktopFilePath =
    typeof source.desktopFilePath === 'string' ? source.desktopFilePath.trim() : '';
  const iconPath = typeof source.iconPath === 'string' ? source.iconPath.trim() : '';
  const single = Boolean(source.single);
  const normalizedUrl = normalizeInstalledAppUrl(source.url);
  if (!id || !title || !desktopFilePath || !normalizedUrl) return null;
  const createdAt =
    typeof source.createdAt === 'number' && Number.isFinite(source.createdAt)
      ? source.createdAt
      : Date.now();
  const updatedAt =
    typeof source.updatedAt === 'number' && Number.isFinite(source.updatedAt)
      ? source.updatedAt
      : createdAt;
  return {
    id,
    title,
    url: normalizedUrl,
    desktopFilePath,
    iconPath,
    single,
    createdAt,
    updatedAt
  };
};

export const sanitizeSettingsPayload = (payload: unknown): SettingsState => {
  if (!payload || typeof payload !== 'object' || (payload as SettingsLike).schema !== SETTINGS_SCHEMA) {
    return createDefaultSettingsState();
  }
  const source = (Array.isArray((payload as SettingsLike).installedApps)
    ? (payload as SettingsLike).installedApps
    : []) as unknown[];
  const installedApps: InstalledApp[] = [];
  for (const raw of source) {
    const sanitized = sanitizeInstalledAppEntry(raw);
    if (sanitized) installedApps.push(sanitized);
  }
  return {
    schema: SETTINGS_SCHEMA,
    installedApps
  };
};

export async function readSettingsState(): Promise<SettingsState> {
  const file = getSettingsFilePath();
  let parsed: unknown = null;
  try {
    const raw = await fsp.readFile(file, 'utf8');
    parsed = JSON.parse(raw) as unknown;
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') {
      console.warn('[merezhyvo] settings read failed, falling back', err);
    }
    if (!parsed) {
      const defaults = createDefaultSettingsState();
      try {
        await fsp.writeFile(file, JSON.stringify(defaults, null, 2), 'utf8');
      } catch (writeErr) {
        console.error('[merezhyvo] settings init failed', writeErr);
      }
      return defaults;
    }
  }
  const sanitized = sanitizeSettingsPayload(parsed);
  try {
    await fsp.writeFile(file, JSON.stringify(sanitized, null, 2), 'utf8');
  } catch (err) {
    console.error('[merezhyvo] settings sanitize write failed', err);
  }
  return sanitized;
}

export async function writeSettingsState(state: unknown): Promise<SettingsState> {
  const sanitized = sanitizeSettingsPayload(state);
  const file = getSettingsFilePath();
  await fsp.writeFile(file, JSON.stringify(sanitized, null, 2), 'utf8');
  return sanitized;
}

export function downloadBinary(url: string, { timeoutMs = 6000 }: DownloadOptions = {}): Promise<DownloadResult> {
  return new Promise<DownloadResult>((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadBinary(new URL(res.headers.location, url).toString(), { timeoutMs }));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = (res.headers['content-type'] || '').toLowerCase();
        resolve({ buffer, contentType });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      try {
        req.destroy();
      } catch {
        // noop
      }
      reject(new Error('timeout'));
    });
  });
}

export async function tryFetchFaviconFor(hostname: string): Promise<Nullable<FaviconAsset>> {
  if (!hostname) return null;

  const s2 = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
  try {
    const { buffer, contentType } = await downloadBinary(s2);
    if ((contentType || '').toLowerCase().startsWith('image/')) {
      return {
        buffer,
        ext: contentType?.includes('png')
          ? 'png'
          : contentType?.includes('jpeg')
          ? 'jpg'
          : contentType?.includes('svg')
          ? 'svg'
          : contentType?.includes('ico')
          ? 'ico'
          : 'img'
      };
    }
  } catch {
    // noop
  }

  try {
    const icoUrl = `https://${hostname}/favicon.ico`;
    const { buffer, contentType } = await downloadBinary(icoUrl);
    if ((contentType || '').toLowerCase().startsWith('image/')) {
      return {
        buffer,
        ext: contentType?.includes('png')
          ? 'png'
          : contentType?.includes('jpeg')
          ? 'jpg'
          : contentType?.includes('svg')
          ? 'svg'
          : 'ico'
      };
    }
  } catch {
    // noop
  }

  try {
    const pngUrl = `https://${hostname}/favicon.png`;
    const { buffer, contentType } = await downloadBinary(pngUrl);
    if ((contentType || '').toLowerCase().startsWith('image/')) {
      return {
        buffer,
        ext: contentType?.includes('png')
          ? 'png'
          : contentType?.includes('jpeg')
          ? 'jpg'
          : 'img'
      };
    }
  } catch {
    // noop
  }

  return null;
}

export async function upsertInstalledApp(entry: unknown): Promise<InstalledApp> {
  const sanitizedEntry = sanitizeInstalledAppEntry(entry);
  if (!sanitizedEntry) {
    throw new Error('Invalid shortcut entry.');
  }
  const current = await readSettingsState();
  const now = Date.now();
  const nextApps = [...current.installedApps];
  const index = nextApps.findIndex(
    (app) => app.id === sanitizedEntry.id || app.desktopFilePath === sanitizedEntry.desktopFilePath
  );
  if (index >= 0) {
    const existing = nextApps[index];
    if (existing) {
      nextApps[index] = {
        ...existing,
        ...sanitizedEntry,
        createdAt:
          typeof existing.createdAt === 'number' ? existing.createdAt : sanitizedEntry.createdAt ?? now,
        updatedAt: now
      };
    } else {
      nextApps[index] = {
        ...sanitizedEntry,
        createdAt: sanitizedEntry.createdAt ?? now,
        updatedAt: now
      };
    }
  } else {
    nextApps.push({
      ...sanitizedEntry,
      createdAt: sanitizedEntry.createdAt ?? now,
      updatedAt: now
    });
  }
  const nextState = await writeSettingsState({ schema: SETTINGS_SCHEMA, installedApps: nextApps });
  return nextState.installedApps.find((app) => app.id === sanitizedEntry.id) ?? sanitizedEntry;
}

export async function removeInstalledApp({ id, desktopFilePath }: RemoveInstalledAppParams): Promise<RemoveInstalledAppResult> {
  const current = await readSettingsState();
  const apps = [...current.installedApps];
  const targetIndex = apps.findIndex(
    (app) => (id && app.id === id) || (desktopFilePath && app.desktopFilePath === desktopFilePath)
  );
  if (targetIndex === -1) {
    return { ok: false, error: 'Installed app not found.' };
  }
  const [entry] = apps.splice(targetIndex, 1);
  if (!entry) {
    return { ok: false, error: 'Installed app not found.' };
  }
  try {
    if (entry.desktopFilePath) {
      await fsp.unlink(entry.desktopFilePath);
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== 'ENOENT') {
      apps.splice(targetIndex, 0, entry);
      await writeSettingsState({ schema: SETTINGS_SCHEMA, installedApps: apps });
      return { ok: false, error: 'Failed to remove shortcut file: ' + String(err) };
    }
  }
  if (entry.iconPath && entry.iconPath !== BUNDLED_ICON_PATH) {
    try {
      await fsp.unlink(entry.iconPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        console.warn('[merezhyvo] removeInstalledApp: icon unlink failed', err);
      }
    }
  }
  const nextState = await writeSettingsState({ schema: SETTINGS_SCHEMA, installedApps: apps });
  return { ok: true, removed: entry, installedApps: nextState.installedApps };
}

export async function handleCreateShortcut(payload: CreateShortcutPayload): Promise<CreateShortcutResult> {
  const rawTitle = typeof payload?.title === 'string' ? payload.title.trim() : '';
  const normalizedUrl = normalizeInstalledAppUrl(payload?.url);
  const single = Boolean(payload?.single);
  if (!rawTitle || !normalizedUrl) {
    return { ok: false, error: 'Title and URL are required.' };
  }

  const home = app.getPath('home');
  const appsDir = path.join(home, '.local/share/applications');
  const iconsDir = path.join(home, '.local/share/icons');
  ensureDir(appsDir);
  ensureDir(iconsDir);

  let hostname = '';
  try {
    hostname = new URL(normalizedUrl).hostname.replace(/^www\./, '');
  } catch {
    // noop
  }

  let iconPath = BUNDLED_ICON_PATH;

  try {
    const fav = await tryFetchFaviconFor(hostname);
    if (fav && fav.buffer?.length) {
      const fileName = `${slugify(rawTitle)}.${fav.ext}`;
      iconPath = path.join(iconsDir, fileName);
      fs.writeFileSync(iconPath, fav.buffer);
    }
  } catch {
    iconPath = BUNDLED_ICON_PATH;
  }

  const clickBinary = '/opt/click.ubuntu.com/merezhyvo.naz.r/current/app/merezhyvo';
  const localFallback = path.resolve(__dirname, '..', '..', 'app', 'merezhyvo');
  const execPath = fs.existsSync(clickBinary) ? clickBinary : localFallback;

  const singleFlag = single ? ' --single' : '';
  const appIdSlug = slugify(rawTitle);
  const desktopFilePath = path.join(appsDir, `merezhyvo-${appIdSlug}.desktop`);

  const desktopContent =
    `
[Desktop Entry]
Name=${rawTitle}
Comment=Site shortcut (${rawTitle}) via Merezhyvo
Exec=env OZONE_PLATFORM=wayland XCURSOR_SIZE=14 ${execPath} --fullscreen${singleFlag} "${normalizedUrl}"
Icon=${iconPath}
Terminal=false
Type=Application
Categories=Network;WebBrowser;
X-Ubuntu-Touch=true
StartupWMClass=Merezhyvo
`.trim() + '\n';

  try {
    fs.writeFileSync(desktopFilePath, desktopContent, { mode: 0o644 });
  } catch (err) {
    return { ok: false, error: 'Failed to write .desktop: ' + String(err) };
  }

  try {
    const installedApp = await upsertInstalledApp({
      id: appIdSlug,
      title: rawTitle,
      url: normalizedUrl,
      desktopFilePath,
      iconPath,
      single,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    return { ok: true, desktopFilePath, iconPath, installedApp };
  } catch (err) {
    console.error('[merezhyvo] installed app persistence failed', err);
    try {
      await fsp.unlink(desktopFilePath);
    } catch {
      // noop
    }
    if (iconPath && iconPath !== BUNDLED_ICON_PATH) {
      try {
        await fsp.unlink(iconPath);
      } catch {
        // noop
      }
    }
    return { ok: false, error: 'Shortcut created, but saving settings failed: ' + String(err) };
  }
}

export function registerShortcutHandler(ipcMain: IpcMain): void {
  ipcMain.handle('merezhyvo:createShortcut', async (_event, payload) => handleCreateShortcut(payload));
}
