import { ipcMain } from 'electron';
import { getMessengerSettings, updateMessengerOrder } from './messenger-settings';
import { sanitizeMessengerOrder } from '../../src/shared/messengers';

export function registerMessengerSettingsIPC(): void {
  ipcMain.handle('merezhyvo:settings:messenger:get', () => getMessengerSettings());
  ipcMain.handle('merezhyvo:settings:messenger:update', async (_event, payload: unknown) => {
    const order = sanitizeMessengerOrder(payload);
    return updateMessengerOrder(order);
  });
}
