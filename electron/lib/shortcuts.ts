'use strict';

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const https = require('https');
const http = require('http');
const { app } = require('electron');

const BUNDLED_ICON_PATH = path.resolve(__dirname, '..', 'merezhyvo_256.png');
const SETTINGS_SCHEMA = 1;

const slugify = (value) =>
  (value || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'merezhyvo';

const ensureDir = (dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
};

const getProfileDir = () => {
  const dir = path.join(app.getPath('userData'), 'profiles', 'default');
  ensureDir(dir);
  return dir;
};

const getSessionFilePath = () => path.join(getProfileDir(), 'session.json');
const getSettingsFilePath = () => path.join(getProfileDir(), 'settings.json');

const createDefaultSettingsState = () => ({
  schema: SETTINGS_SCHEMA,
  installedApps: []
});

const normalizeInstalledAppUrl = (value) => {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
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

const sanitizeInstalledAppEntry = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id.trim().length ? raw.id.trim() : null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const desktopFilePath = typeof raw.desktopFilePath === 'string' ? raw.desktopFilePath.trim() : '';
  const iconPath = typeof raw.iconPath === 'string' ? raw.iconPath.trim() : '';
  const single = !!raw.single;
  const normalizedUrl = normalizeInstalledAppUrl(raw.url);
  if (!id || !title || !desktopFilePath || !normalizedUrl) return null;
  const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
  const updatedAt = typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt;
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

const sanitizeSettingsPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || payload.schema !== SETTINGS_SCHEMA) {
    return createDefaultSettingsState();
  }
  const source = Array.isArray(payload.installedApps) ? payload.installedApps : [];
  const installedApps = [];
  for (const raw of source) {
    const sanitized = sanitizeInstalledAppEntry(raw);
    if (sanitized) installedApps.push(sanitized);
  }
  return {
    schema: SETTINGS_SCHEMA,
    installedApps
  };
};

async function readSettingsState() {
  const file = getSettingsFilePath();
  let parsed = null;
  try {
    const raw = await fsp.readFile(file, 'utf8');
    parsed = JSON.parse(raw);
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
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

async function writeSettingsState(state) {
  const sanitized = sanitizeSettingsPayload(state);
  const file = getSettingsFilePath();
  await fsp.writeFile(file, JSON.stringify(sanitized, null, 2), 'utf8');
  return sanitized;
}

function downloadBinary(url, { timeoutMs = 6000 } = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadBinary(new URL(res.headers.location, url).toString(), { timeoutMs }));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = (res.headers['content-type'] || '').toLowerCase();
        resolve({ buffer, contentType });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      try { req.destroy(); } catch {}
      reject(new Error('timeout'));
    });
  });
}

async function tryFetchFaviconFor(hostname) {
  if (!hostname) return null;

  const s2 = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`;
  try {
    const { buffer, contentType } = await downloadBinary(s2);
    if ((contentType || '').toLowerCase().startsWith('image/')) {
      return {
        buffer,
        ext: contentType.includes('png') ? 'png'
          : contentType.includes('jpeg') ? 'jpg'
          : contentType.includes('svg') ? 'svg'
          : contentType.includes('ico') ? 'ico'
          : 'img'
      };
    }
  } catch {}

  try {
    const icoUrl = `https://${hostname}/favicon.ico`;
    const { buffer, contentType } = await downloadBinary(icoUrl);
    if ((contentType || '').toLowerCase().startsWith('image/')) {
      return {
        buffer,
        ext: contentType.includes('png') ? 'png'
          : contentType.includes('jpeg') ? 'jpg'
          : contentType.includes('svg') ? 'svg'
          : 'ico'
      };
    }
  } catch {}

  try {
    const pngUrl = `https://${hostname}/favicon.png`;
    const { buffer, contentType } = await downloadBinary(pngUrl);
    if ((contentType || '').toLowerCase().startsWith('image/')) {
      return {
        buffer,
        ext: contentType.includes('png') ? 'png'
          : contentType.includes('jpeg') ? 'jpg'
          : 'img'
      };
    }
  } catch {}

  return null;
}

async function upsertInstalledApp(entry) {
  const sanitizedEntry = sanitizeInstalledAppEntry(entry);
  if (!sanitizedEntry) {
    throw new Error('Invalid shortcut entry.');
  }
  const current = await readSettingsState();
  const now = Date.now();
  const nextApps = [...current.installedApps];
  const index = nextApps.findIndex((app) => app.id === sanitizedEntry.id || app.desktopFilePath === sanitizedEntry.desktopFilePath);
  if (index >= 0) {
    const existing = nextApps[index];
    nextApps[index] = {
      ...existing,
      ...sanitizedEntry,
      createdAt: typeof existing.createdAt === 'number' ? existing.createdAt : sanitizedEntry.createdAt,
      updatedAt: now
    };
  } else {
    nextApps.push({
      ...sanitizedEntry,
      createdAt: sanitizedEntry.createdAt ?? now,
      updatedAt: now
    });
  }
  const nextState = await writeSettingsState({ schema: SETTINGS_SCHEMA, installedApps: nextApps });
  return nextState.installedApps.find((app) => app.id === sanitizedEntry.id) || sanitizedEntry;
}

async function removeInstalledApp({ id, desktopFilePath }) {
  const current = await readSettingsState();
  const apps = [...current.installedApps];
  const targetIndex = apps.findIndex((app) => (id && app.id === id) || (desktopFilePath && app.desktopFilePath === desktopFilePath));
  if (targetIndex === -1) {
    return { ok: false, error: 'Installed app not found.' };
  }
  const [entry] = apps.splice(targetIndex, 1);
  try {
    if (entry.desktopFilePath) {
      await fsp.unlink(entry.desktopFilePath);
    }
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      apps.splice(targetIndex, 0, entry);
      await writeSettingsState({ schema: SETTINGS_SCHEMA, installedApps: apps });
      return { ok: false, error: 'Failed to remove shortcut file: ' + String(err) };
    }
  }
  if (entry.iconPath && entry.iconPath !== BUNDLED_ICON_PATH) {
    try {
      await fsp.unlink(entry.iconPath);
    } catch (err) {
      if (err && err.code !== 'ENOENT') {
        console.warn('[merezhyvo] removeInstalledApp: icon unlink failed', err);
      }
    }
  }
  const nextState = await writeSettingsState({ schema: SETTINGS_SCHEMA, installedApps: apps });
  return { ok: true, removed: entry, installedApps: nextState.installedApps };
}

async function handleCreateShortcut(payload) {
  const rawTitle = typeof payload?.title === 'string' ? payload.title.trim() : '';
  const normalizedUrl = normalizeInstalledAppUrl(payload?.url);
  const single = !!payload?.single;
  if (!rawTitle || !normalizedUrl) {
    return { ok: false, error: 'Title and URL are required.' };
  }

  const home = app.getPath('home');
  const appsDir = path.join(home, '.local/share/applications');
  const iconsDir = path.join(home, '.local/share/icons');
  ensureDir(appsDir);
  ensureDir(iconsDir);

  let hostname = '';
  try { hostname = new URL(normalizedUrl).hostname.replace(/^www\./, ''); } catch {}

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

  const desktopContent = `
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
    try { await fsp.unlink(desktopFilePath); } catch {}
    if (iconPath && iconPath !== BUNDLED_ICON_PATH) {
      try { await fsp.unlink(iconPath); } catch {}
    }
    return { ok: false, error: 'Shortcut created, but saving settings failed: ' + String(err) };
  }
}

function registerShortcutHandler(ipcMain) {
  ipcMain.handle('merezhyvo:createShortcut', async (_event, payload) => handleCreateShortcut(payload));
}

export {
  BUNDLED_ICON_PATH,
  SETTINGS_SCHEMA,
  slugify,
  ensureDir,
  getProfileDir,
  getSessionFilePath,
  getSettingsFilePath,
  normalizeInstalledAppUrl,
  sanitizeInstalledAppEntry,
  sanitizeSettingsPayload,
  createDefaultSettingsState,
  readSettingsState,
  writeSettingsState,
  upsertInstalledApp,
  removeInstalledApp,
  tryFetchFaviconFor,
  registerShortcutHandler,
  handleCreateShortcut
};
