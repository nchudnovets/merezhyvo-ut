import {
  app,
  ipcMain,
  session,
  type WebContents,
  type Event as ElectronEvent
} from 'electron';
import {
  type PermissionType,
  getPermissionsState,
  updatePermissionsState,
  resetSite,
  resetAllPermissions,
  defaultPermissionsState,
  isPermissionsState,
  type PermissionsState,
  updateDefaultPermissions
} from './permissions-settings';
import fs from 'fs';
import path from 'path';

/**
 * NOTE:
 * This module owns ONLY permission storage and Chromium gates.
 * Geolocation IPC ('mzr:geo:*') is implemented in electron/lib/geo-ipc.ts.
 */

let _permInstalled = false;
let promptTarget: WebContents | null = null;

function geoIpcLog(_msg: string): void {
  try {
    // const file = path.join(app.getPath('userData'), 'geo.log');
    // fs.appendFileSync(file, `[${new Date().toISOString()}] ${msg}\n`, 'utf8');
  } catch {
    // ignore
  }
}
// geoIpcLog('permissions module init');

type RendererDecision = {
  id: string;
  allow: boolean;
  remember: boolean;
  persist?: Partial<Record<PermissionType, 'allow' | 'deny'>>;
};

type PendingResolver = (v: RendererDecision) => void;
const pending = new Map<string, PendingResolver>();

function resolveRendererDecision(decide: RendererDecision): boolean {
  const fn = pending.get(decide.id);
  if (!fn) {
    geoIpcLog(`renderer:decide unknown id=${decide.id} allow=${decide.allow} remember=${decide.remember}`);
    return false;
  }
  pending.delete(decide.id);
  try {
    fn(decide);
    return true;
  } catch (e) {
    geoIpcLog(`renderer:decide handler error for id=${decide.id}: ${String(e)}`);
    return false;
  }
}

/**
 * Accept decisions from renderer UI.
 * We support both 'send' (on) and 'invoke' (handle) styles.
 * Renderer should send: { id, allow, remember, persist? }
 */
ipcMain.on('merezhyvo:permission:decide', (_e, decide: RendererDecision) => {
  const ok = resolveRendererDecision(decide);
  if (!ok) {
    // no-op: late/duplicate or unknown id
  }
});

handleOnce('merezhyvo:permission:decide', async (_e, decide: RendererDecision) => {
  const ok = resolveRendererDecision(decide);
  return ok;
});

export function connectPermissionPromptTarget(host: WebContents): void {
  promptTarget = host;
}

function handleOnce(channel: string, handler: (...args: any[]) => any): void {
  try { ipcMain.removeHandler(channel); } catch {}
  ipcMain.handle(channel, handler);
}

function waitForRendererDecision(id: string, timeoutMs: number): Promise<RendererDecision> {
  return new Promise<RendererDecision>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('permission prompt timeout'));
    }, timeoutMs);
    pending.set(id, (v) => {
      clearTimeout(timer);
      resolve(v);
    });
  });
}

function buildPersist(
  types: PermissionType[],
  allow: boolean
): Partial<Record<PermissionType, 'allow' | 'deny'>> {
  const out: Partial<Record<PermissionType, 'allow' | 'deny'>> = {};
  for (const t of types) out[t] = allow ? 'allow' : 'deny';
  return out;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

// Optional: helper to re-sanitize if needed elsewhere
export function ensurePermissionsInState(st: unknown): PermissionsState {
  if (isPermissionsState(st)) return st;
  return defaultPermissionsState();
}

export function installPermissionHandlers(): void {
  if (_permInstalled) return;
  _permInstalled = true;

  const ses = session.defaultSession;

  // Store API
  handleOnce('mzr:perms:get', async () => {
    const st = await getPermissionsState();
    return st;
  });

  handleOnce(
    'mzr:perms:updateSite',
    async (_e: ElectronEvent, payload: { origin: string; patch: Partial<Record<PermissionType, 'allow' | 'deny'>> }) => {
      await updatePermissionsState(payload.origin, payload.patch);
      return true;
    }
  );

  handleOnce('mzr:perms:resetSite', async (_e: ElectronEvent, origin: string) => {
    await resetSite(origin);
    return true;
  });

  handleOnce('mzr:perms:resetAll', async () => {
    await resetAllPermissions();
    return true;
  });

  handleOnce(
    'mzr:perms:updateDefaults',
    async (_e, patch: Partial<Record<PermissionType, 'allow' | 'deny' | 'prompt'>>) => {
      await updateDefaultPermissions(patch);
      return true;
    }
  );

  // Soft permission request (used by geolocation shim in preload)
  handleOnce(
    'mzr:perms:softRequest',
    async (_e, payload: { origin: string; types: PermissionType[] }) => {
      geoIpcLog(`softRequest origin=${payload.origin} types=${payload.types.join(',')}`);
      const { origin, types } = payload;
      const store = await getPermissionsState();
      const site = store.sites[origin] ?? {};

      // Per-site saved decision?
      const savedForAll = types.every((t) => site[t] === 'allow' || site[t] === 'deny');
      if (savedForAll) {
        const ok = types.every((t) => site[t] === 'allow');
        geoIpcLog(`softRequest: site saved -> ${ok ? 'allow' : 'deny'} origin=${origin}`);
        return ok;
      }

      // Global defaults homogeneous?
      const allDefaultAllow = types.every((t) => store.defaults[t] === 'allow');
      const allDefaultDeny  = types.every((t) => store.defaults[t] === 'deny');
      if (allDefaultAllow) {
        geoIpcLog(`softRequest: defaults allow origin=${origin}`);
        return true;
      }
      if (allDefaultDeny) {
        geoIpcLog(`softRequest: defaults deny origin=${origin}`);
        return false;
      }

      // Ask user via existing permissions prompt UI
      const id = randomId();
      if (promptTarget) {
        try {
          promptTarget.send('merezhyvo:permission:prompt', { id, webContentsId: 0, origin, types });
        } catch {}
      }
      try {
        const decide = await waitForRendererDecision(id, 30000);
        if (decide.remember) {
          const persist = decide.persist ?? buildPersist(types, decide.allow);
          await updatePermissionsState(origin, persist);
        }
        geoIpcLog(`softRequest: renderer -> ${decide.allow ? 'allow' : 'deny'} remember=${decide.remember} origin=${origin}`);
        return decide.allow;
      } catch {
        geoIpcLog(`softRequest: renderer timeout -> deny origin=${origin}`);
        return false;
      }
    }
  );

  // Chromium permission gates
  ses.setPermissionRequestHandler(async (wc, permission, callback) => {
    // temporary    
    return void callback(false);

    // const types: PermissionType[] =
    //   permission === 'media'
    //     ? safeMediaTypes((details as { mediaTypes?: unknown }).mediaTypes)
    //         .map((mt) => (mt === 'video' ? 'camera' : 'microphone'))
    //     : permission === 'geolocation'
    //     ? ['geolocation']
    //     : permission === 'notifications'
    //     ? ['notifications']
    //     : [];

    // if (types.length === 0) {
    //   geoIpcLog(`request: unknown permission=${permission} origin=${safeOrigin((details as any)?.requestingUrl || '')} -> deny`);
    //   callback(false);
    //   return;
    // }

    // const origin = safeOrigin((details as any)?.requestingUrl || '');
    // geoIpcLog(`request: permission=${permission} types=${types.join(',')} origin=${origin}`);

    // try {
    //   const store = await getPermissionsState();
    //   const site = store.sites[origin] ?? {};

    //   // Per-site saved decision?
    //   const savedForAll = types.every((t) => site[t] === 'allow' || site[t] === 'deny');
    //   if (savedForAll) {
    //     const allow = types.every((t) => site[t] === 'allow');
    //     geoIpcLog(`decision: savedForAll allow=${allow} origin=${origin}`);
    //     callback(allow);
    //     return;
    //   }

    //   // Homogeneous global defaults?
    //   const allDefaultAllow = types.every((t) => store.defaults[t] === 'allow');
    //   const allDefaultDeny  = types.every((t) => store.defaults[t] === 'deny');

    //   if (allDefaultAllow) {
    //     geoIpcLog(`decision: defaults allow origin=${origin}`);
    //     callback(true);
    //     return;
    //   }
    //   if (allDefaultDeny) {
    //     geoIpcLog(`decision: defaults deny origin=${origin}`);
    //     callback(false);
    //     return;
    //   }

    //   // Mixed defaults or 'prompt' present -> ask renderer (modal)
    //   const id = randomId();
    //   const payload = { id, webContentsId: wc.id, origin, types };

    //   if (promptTarget) {
    //     try {
    //       promptTarget.send('merezhyvo:permission:prompt', payload);
    //     } catch {}
    //   }

    //   try {
    //     const decide = await waitForRendererDecision(id, 30000);
    //     if (decide.remember) {
    //       const persist = decide.persist ?? buildPersist(types, decide.allow);
    //       await updatePermissionsState(origin, persist);
    //     }
    //     geoIpcLog(`decision: renderer allow=${decide.allow} remember=${decide.remember} origin=${origin}`);
    //     callback(decide.allow);
    //   } catch {
    //     geoIpcLog(`decision: renderer timeout/cancel -> deny origin=${origin}`);
    //     callback(false);
    //   }
    // } catch (e) {
    //   geoIpcLog(`decision: internal error -> deny origin=${origin} err=${String(e)}`);
    //   callback(false);
    // }
  });

  // Helps navigator.permissions.query reflect stored decisions
  if (typeof ses.setPermissionCheckHandler === 'function') {
    ses.setPermissionCheckHandler((_wc, permission, requestingOrigin, _details) => {
      const origin = requestingOrigin || 'null';
      const map: Partial<Record<string, PermissionType | PermissionType[]>> = {
        geolocation: 'geolocation',
        notifications: 'notifications',
        media: ['camera', 'microphone']
      };
      const types = map[permission];
      if (!types) return false;

      try {
        const pfile = path.join(app.getPath('userData'), 'permissions.json');
        const st = (fs.existsSync(pfile)
          ? JSON.parse(fs.readFileSync(pfile, 'utf8'))
          : null) as unknown;

        const ps = isPermissionsState(st) ? st : defaultPermissionsState();
        const site = ps.sites[origin] ?? {};
        const arr: PermissionType[] = Array.isArray(types) ? types : [types];

        const savedForAll = arr.every((t) => site[t] === 'allow' || site[t] === 'deny');
        if (savedForAll) return arr.every((t) => site[t] === 'allow');

        const allDefaultAllow = arr.every((t) => ps.defaults[t] === 'allow');
        return allDefaultAllow;
      } catch {
        return false;
      }
    });
  }
}
