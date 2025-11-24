'use strict';

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import net from 'net';
import { session, BrowserWindow } from 'electron';
import {
  getMainWindow,
  getOrCreateMainWindow
} from './windows';

import type { BrowserWindow as TBrowserWindow, IpcMain, IpcMainInvokeEvent, Session } from 'electron';
import type { ChildProcess } from 'child_process';

const TOR_HOST = '127.0.0.1';
const TOR_PORT = 9050;
const APP_ID = 'merezhyvo.naz.r';

type TorState = {
  enabled: boolean;
  starting: boolean;
  reason: string | null;
};

type StartOptions = {
  // Kept for API compatibility; currently unused.
  containerId?: string;
};

let torChild: ChildProcess | null = null;
let torState: TorState = { enabled: false, starting: false, reason: null };

/** Send current tor state to a window (or main window if not provided). */
export function sendTorState(win?: TBrowserWindow | null): void {
  const target: TBrowserWindow | null | undefined = win || getMainWindow?.();
  if (target && !target.isDestroyed?.()) {
    try {
      target.webContents.send('tor:state', {
        enabled: torState.enabled,
        reason: torState.reason ?? null
      });
    } catch {
      // noop
    }
  }
}

/** Detect if we are running inside Ubuntu Touch confined environment. */
function isUbuntuTouchSandbox(): boolean {
  try {
    const home = os.homedir();
    return process.platform === 'linux' && (home === '/home/phablet' || home.endsWith('/phablet'));
  } catch {
    return false;
  }
}

/** Try to resolve bundled tor binary inside the click package. */
function resolveBundledTorBinary(): string | null {
  const appId =
    process.env.CLICK_APP_ID && process.env.CLICK_APP_ID.trim().length
      ? process.env.CLICK_APP_ID.trim()
      : APP_ID;

  const candidates: string[] = [];

  if (isUbuntuTouchSandbox()) {
    // Path inside click package on device, e.g.
    // /opt/click.ubuntu.com/merezhyvo.naz.r/current/app/resources/tor/tor
    candidates.push(`/opt/click.ubuntu.com/${appId}/current/app/resources/tor/tor`);
  }

  // Development / fallback candidates (when running from repo)
  const cwd = process.cwd();
  candidates.push(
    path.join(cwd, 'app', 'resources', 'tor', 'tor'),
    path.join(cwd, 'resources', 'tor', 'tor')
  );

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/** Resolve which tor command to run (env override → bundled → system). */
function resolveTorCommand(): string | null {
  const override = process.env.MZ_TOR_BIN;
  if (override && override.trim().length) {
    return override.trim();
  }

  const bundled = resolveBundledTorBinary();
  if (bundled) {
    return bundled;
  }

  // Last resort: rely on system tor from PATH (mostly for desktop development).
  return 'tor';
}

/** Ensure tor data directory exists and return its path. */
function ensureTorDataDir(): string {
  try {
    const home = os.homedir();
    const dataHome =
      process.env.XDG_DATA_HOME && process.env.XDG_DATA_HOME.trim().length
        ? process.env.XDG_DATA_HOME.trim()
        : path.join(home, '.local', 'share');

    const base = path.join(dataHome, APP_ID);
    const dir = path.join(base, 'tor-data');

    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch {
    // As a last resort, let tor decide; but this may fail under confinement.
    return '.';
  }
}

/** Poll a TCP port until it opens or times out. */
function waitForPort(
  host: string,
  port: number,
  timeoutMs = 30_000,
  intervalMs = 250
): Promise<boolean> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const sock = net.connect({ host, port }, () => {
        try {
          sock.destroy();
        } catch {}
        resolve(true);
      });
      sock.on('error', () => {
        try {
          sock.destroy();
        } catch {}
        if (Date.now() - started > timeoutMs) reject(new Error('timeout'));
        else setTimeout(check, intervalMs);
      });
    };
    check();
  });
}

/** Apply or clear Electron proxy to route traffic via tor SOCKS5. */
async function applyProxy(enabled: boolean): Promise<void> {
  const rules = enabled ? `socks5://${TOR_HOST}:${TOR_PORT}` : '';
  const targetSession: Session = session.defaultSession;
  await targetSession.setProxy({
    proxyRules: rules,
    proxyBypassRules: 'localhost,127.0.0.1'
  });
}

/** Start tor (embedded or system) if needed and enable proxy. */
export async function startTorAndProxy(
  winForFeedback?: TBrowserWindow | null,
  _options: StartOptions = {}
): Promise<void> {
  if (torState.enabled || torState.starting) return;

  const cmd = resolveTorCommand();
  if (!cmd) {
    torState = {
      enabled: false,
      starting: false,
      reason: 'Tor binary not found (embedded tor is missing).'
    };
    sendTorState(winForFeedback ?? null);
    return;
  }

  const dataDir = ensureTorDataDir();

  torState = { enabled: false, starting: true, reason: null };
  sendTorState(winForFeedback ?? null);

  // Quick check if tor is already up
  const alreadyUp = await new Promise<boolean>((resolve) => {
    const socket = net.connect({ host: TOR_HOST, port: TOR_PORT }, () => {
      try {
        socket.destroy();
      } catch {}
      resolve(true);
    });
    socket.on('error', () => {
      try {
        socket.destroy();
      } catch {}
      resolve(false);
    });
  });

  if (!alreadyUp) {
    const args: string[] = [
      '--SOCKSPort',
      `${TOR_HOST}:${TOR_PORT}`,
      '--DataDirectory',
      dataDir,
      '--ClientOnly',
      '1',
      '--RunAsDaemon',
      '0'
    ];

    try {
      torChild = spawn(cmd, args, {
        stdio: 'ignore'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      torState = { enabled: false, starting: false, reason: `Failed to spawn tor: ${msg}` };
      sendTorState(winForFeedback ?? null);
      return;
    }

    try {
      await waitForPort(TOR_HOST, TOR_PORT, 30_000, 250);
    } catch {
      try {
        if (torChild?.pid) process.kill(torChild.pid);
      } catch {
        // noop
      }
      torChild = null;
      torState = { enabled: false, starting: false, reason: 'Tor did not open 9050 in time' };
      sendTorState(winForFeedback ?? null);
      return;
    }
  }

  try {
    await applyProxy(true);
    torState = { enabled: true, starting: false, reason: null };
    sendTorState(winForFeedback ?? null);

    const target: TBrowserWindow | null =
      getMainWindow?.() || (await getOrCreateMainWindow?.({ activate: true }));
    if (target && !target.isDestroyed?.()) {
      target.webContents.send('mzr:open-url', { url: 'https://check.torproject.org', activate: true });
      target.focus?.();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    torState = { enabled: false, starting: false, reason: `Proxy error: ${msg}` };
    sendTorState(winForFeedback ?? null);
  }
}

/** Stop tor proxy and kill tor process (if we spawned it). */
export async function stopTorAndProxy(winForFeedback?: TBrowserWindow | null): Promise<void> {
  torState.starting = false;
  try {
    await applyProxy(false);
  } catch {
    // ignore
  }
  if (torChild) {
    try {
      if (torChild.pid) process.kill(torChild.pid);
    } catch {
      // ignore
    }
    torChild = null;
  }
  torState = { enabled: false, starting: false, reason: null };
  sendTorState(winForFeedback ?? null);
}

/** Wire IPC handlers for tor controls. */
export function registerTorHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('tor:toggle', async (event: IpcMainInvokeEvent, _payload: unknown) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) || getMainWindow?.();

    if (torState.enabled || torState.starting) {
      await stopTorAndProxy(win);
    } else {
      await startTorAndProxy(win);
    }
    return { ...torState };
  });

  ipcMain.handle('tor:get-state', (event: IpcMainInvokeEvent) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) || getMainWindow?.();
    sendTorState(win);
    return { ...torState };
  });
}
