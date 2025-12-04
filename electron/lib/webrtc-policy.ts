'use strict';

import fs from 'fs';
import { BrowserWindow, webContents } from 'electron';
import {
  readSettingsState,
  writeSettingsState,
  getSettingsFilePath,
  sanitizeSettingsPayload,
  type WebrtcMode
} from './shortcuts';
import { getTorState } from './tor';

export type WebrtcPolicyPayload = {
  mode: WebrtcMode;
  torEnabled: boolean;
  enabled: boolean;
};

export const computeEffectivePolicy = async (): Promise<WebrtcPolicyPayload> => {
  const settings = await readSettingsState();
  const mode = settings.webrtcMode ?? 'always_on';
  const torEnabled = getTorState()?.enabled ?? false;
  const enabled =
    mode === 'always_off' ? false : mode === 'off_with_tor' ? !torEnabled : true;
  return { mode, torEnabled, enabled };
};

export const broadcastWebrtcPolicy = async (): Promise<void> => {
  try {
    const payload = await computeEffectivePolicy();
    for (const wc of webContents.getAllWebContents()) {
      try {
        wc.send?.('merezhyvo:webrtc:updatePolicy', payload);
      } catch {
        // ignore
      }
    }
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        win.webContents.send('merezhyvo:webrtc:updatePolicy', payload);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore broadcast failures
  }
};

export const setWebrtcMode = async (mode: WebrtcMode): Promise<WebrtcMode> => {
  const normalized: WebrtcMode =
    mode === 'always_off' || mode === 'off_with_tor' ? mode : 'always_on';
  const next = await writeSettingsState({ webrtcMode: normalized });
  await broadcastWebrtcPolicy();
  return next.webrtcMode ?? normalized;
};

export const getEffectiveWebrtcPolicy = async (): Promise<WebrtcPolicyPayload> => {
  try {
    return await computeEffectivePolicy();
  } catch {
    return { mode: 'always_on', torEnabled: false, enabled: true };
  }
};

export const getEffectiveWebrtcPolicySync = (): WebrtcPolicyPayload => {
  try {
    const file = getSettingsFilePath();
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const state = sanitizeSettingsPayload(parsed);
    const mode = state.webrtcMode ?? 'always_on';
    const torEnabled = getTorState()?.enabled ?? false;
    const enabled =
      mode === 'always_off' ? false : mode === 'off_with_tor' ? !torEnabled : true;
    return { mode, torEnabled, enabled };
  } catch {
    const torEnabled = getTorState()?.enabled ?? false;
    return { mode: 'always_on', torEnabled, enabled: true };
  }
};
