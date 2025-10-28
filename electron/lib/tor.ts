'use strict';

import { spawn } from 'child_process';
import net from 'net';
import { session, BrowserWindow } from 'electron';
import {
  getMainWindow,
  getOrCreateMainWindow
} from './windows';
import { readTorConfig } from './tor-settings';

import type { BrowserWindow as TBrowserWindow, IpcMain, IpcMainInvokeEvent, Session } from 'electron';
import type { ChildProcess } from 'child_process';

const TOR_HOST = '127.0.0.1';
const TOR_PORT = 9050;

type TorState = {
  enabled: boolean;
  starting: boolean;
  reason: string | null;
};

type StartOptions = {
  containerId?: string;
};

let torChild: ChildProcess | null = null;
let torState: TorState = { enabled: false, starting: false, reason: null };

/** Send current tor state to a window (or main window if not provided). */
export function sendTorState(win?: TBrowserWindow | null): void {
  const target: TBrowserWindow | null | undefined = win || getMainWindow?.();
  if (target && !target.isDestroyed?.()) {
    try {
      target.webContents.send('tor:state', { enabled: torState.enabled, reason: torState.reason ?? null });
    } catch {
      // noop
    }
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
        try { sock.destroy(); } catch {}
        resolve(true);
      });
      sock.on('error', () => {
        try { sock.destroy(); } catch {}
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

/** Start tor (in Libertine) if needed and enable proxy. */
export async function startTorAndProxy(
  winForFeedback?: TBrowserWindow | null,
  options: StartOptions = {}
): Promise<void> {
  if (torState.enabled || torState.starting) return;

  let containerId =
    typeof options === 'object' && options && typeof options.containerId === 'string'
      ? options.containerId.trim()
      : '';

  if (!containerId) {
    try {
      const stored = await readTorConfig();
      containerId = stored?.containerId?.trim?.() || '';
    } catch {
      // ignore config read errors
    }
  }

  if (!containerId) {
    torState = { enabled: false, starting: false, reason: 'Libertine container identifier missing' };
    sendTorState(winForFeedback ?? null);
    return;
  }

  torState = { enabled: false, starting: true, reason: null };
  sendTorState(winForFeedback ?? null);

  // Quick check if tor is already up
  const alreadyUp = await new Promise<boolean>((resolve) => {
    const socket = net.connect({ host: TOR_HOST, port: TOR_PORT }, () => {
      try { socket.destroy(); } catch {}
      resolve(true);
    });
    socket.on('error', () => {
      try { socket.destroy(); } catch {}
      resolve(false);
    });
  });

  if (!alreadyUp) {
    try {
      torChild = spawn('libertine-launch', ['-i', containerId, 'tor'], {
        stdio: 'ignore',
        detached: true
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
  ipcMain.handle('tor:toggle', async (event: IpcMainInvokeEvent, payload: unknown) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) || getMainWindow?.();

    if (torState.enabled || torState.starting) {
      await stopTorAndProxy(win);
    } else {
      const containerId =
        typeof payload === 'object' && payload && typeof (payload as any).containerId === 'string'
          ? (payload as any).containerId.trim()
          : '';
      await startTorAndProxy(win, { containerId });
    }

    // return a shallow copy to avoid accidental mutation on the receiver side
    return { ...torState };
  });

  ipcMain.handle('tor:get-state', (event: IpcMainInvokeEvent) => {
    const win =
      BrowserWindow.fromWebContents(event.sender) || getMainWindow?.();
    sendTorState(win);
    return { ...torState };
  });
}