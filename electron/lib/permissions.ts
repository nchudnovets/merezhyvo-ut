import {
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
  type PermissionsState
} from './permissions-settings';

type RendererDecision = {
  id: string;
  allow: boolean;
  remember: boolean;
  persist?: Partial<Record<PermissionType, 'allow' | 'deny'>>;
};

type PendingResolver = (v: RendererDecision) => void;

let promptTarget: WebContents | null = null;
const pending = new Map<string, PendingResolver>();

export function connectPermissionPromptTarget(host: WebContents): void {
  promptTarget = host;
}

type ChromiumMediaType = 'audio' | 'video';

function safeMediaTypes(val: unknown): ChromiumMediaType[] {
  if (!Array.isArray(val)) return [];
  return (val as unknown[]).filter(
    (x): x is ChromiumMediaType => x === 'audio' || x === 'video'
  );
}

export function installPermissionHandlers(): void {
  const ses = session.defaultSession;

  // Store API
  ipcMain.handle('mzr:perms:get', async () => {
    const st = await getPermissionsState();
    return st;
  });
  ipcMain.handle(
    'mzr:perms:updateSite',
    async (_e: ElectronEvent, payload: { origin: string; patch: Partial<Record<PermissionType, 'allow' | 'deny'>> }) => {
      await updatePermissionsState(payload.origin, payload.patch);
      return true;
    }
  );
  ipcMain.handle('mzr:perms:resetSite', async (_e: ElectronEvent, origin: string) => {
    await resetSite(origin);
    return true;
  });
  ipcMain.handle('mzr:perms:resetAll', async () => {
    await resetAllPermissions();
    return true;
  });

  // Decision from renderer
  ipcMain.on('merezhyvo:permission:decide', (_e: ElectronEvent, decision: RendererDecision) => {
    const res = pending.get(decision.id);
    if (res) {
      pending.delete(decision.id);
      res(decision);
    }
  });

  // Main permission gate
  ses.setPermissionRequestHandler(async (wc, permission, callback, details) => {
    // Map chromium permission -> our PermissionType[]
    const types: PermissionType[] =
  permission === 'media'
    ? safeMediaTypes((details as { mediaTypes?: unknown }).mediaTypes)
        .map((mt) => (mt === 'video' ? 'camera' : 'microphone'))
    : permission === 'geolocation'
    ? ['geolocation']
    : permission === 'notifications'
    ? ['notifications']
    : [];

    if (types.length === 0) {
      callback(false);
      return;
    }

    const origin = safeOrigin(details.requestingUrl);
    const store = await getPermissionsState();
    const site = store.sites[origin] ?? {};

    // If saved decision exists for all requested types -> apply immediately
    const savedForAll = types.every((t) => site[t] === 'allow' || site[t] === 'deny');
    if (savedForAll) {
      const allow = types.every((t) => site[t] === 'allow');
      callback(allow);
      return;
    }

    // Otherwise ask renderer (modal)
    const id = randomId();
    const payload = {
      id,
      webContentsId: wc.id,
      origin,
      types
    };

    if (promptTarget) {
      promptTarget.send('merezhyvo:permission:prompt', payload);
    }

    try {
      const decide = await waitForRendererDecision(id, 30000);
      if (decide.remember) {
        const persist = decide.persist ?? buildPersist(types, decide.allow);
        await updatePermissionsState(origin, persist);
      }
      callback(decide.allow);
    } catch {
      // Timeout or cancel -> deny
      callback(false);
    }
  });
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

function safeOrigin(url: string): string {
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return 'null';
  }
}

function randomId(): string {
  // lightweight, crypto-free unique-ish id is sufficient here
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

// Optional: helper to re-sanitize if needed elsewhere
export function ensurePermissionsInState(st: unknown): PermissionsState {
  if (isPermissionsState(st)) return st;
  return defaultPermissionsState();
}
