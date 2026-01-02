import type { IpcMain } from 'electron';

import { getTorState } from './tor-state';
import { getSecureDnsSettings, updateSecureDnsSettings } from './secure-dns';

export const registerSecureDnsIpc = (ipcMain: IpcMain): void => {
  ipcMain.handle('merezhyvo:settings:secure-dns:get', async () => {
    return getSecureDnsSettings();
  });

  ipcMain.handle('merezhyvo:settings:secure-dns:update', async (_event, payload: unknown) => {
    const torEnabled = getTorState().enabled;
    return updateSecureDnsSettings(payload as Record<string, unknown>, torEnabled);
  });
};
