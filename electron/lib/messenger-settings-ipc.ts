import { ipcMain } from 'electron';
import { getMessengerSettings, updateMessengerSettings } from './messenger-settings';
import { sanitizeMessengerOrder } from '../../src/shared/messengers';

export function registerMessengerSettingsIPC(): void {
  ipcMain.handle('merezhyvo:settings:messenger:get', () => getMessengerSettings());
  ipcMain.handle('merezhyvo:settings:messenger:update', async (_event, payload: unknown) => {
    if (Array.isArray(payload)) {
      const order = sanitizeMessengerOrder(payload);
      return updateMessengerSettings({ order });
    }
    if (payload && typeof payload === 'object') {
      const orderRaw = (payload as { order?: unknown }).order;
      const hideToolbarRaw = (payload as { hideToolbar?: unknown }).hideToolbar;
      return updateMessengerSettings({
        order: Array.isArray(orderRaw) ? sanitizeMessengerOrder(orderRaw) : undefined,
        hideToolbar: typeof hideToolbarRaw === 'boolean' ? hideToolbarRaw : undefined
      });
    }
    return updateMessengerSettings({});
  });
}
