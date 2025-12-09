import { ipcMain } from 'electron';
import {
  clearThirdPartyExceptions,
  getCookiePrivacyState,
  listThirdPartyExceptions,
  setBlockThirdParty,
  setThirdPartyException
} from './cookie-settings';

export const registerCookieSettingsIPC = (): void => {
  ipcMain.handle('merezhyvo:settings:cookies:get', async () => {
    return getCookiePrivacyState();
  });
  ipcMain.handle('merezhyvo:settings:cookies:set-block', async (_event, payload: unknown) => {
    const enabled = typeof (payload as { blockThirdParty?: unknown })?.blockThirdParty === 'boolean'
      ? (payload as { blockThirdParty: boolean }).blockThirdParty
      : false;
    return setBlockThirdParty(enabled);
  });
  ipcMain.handle('merezhyvo:settings:cookies:set-exception', async (_event, payload: unknown) => {
    const host = (payload as { host?: unknown })?.host;
    const allow = typeof (payload as { allow?: unknown })?.allow === 'boolean'
      ? (payload as { allow: boolean }).allow
      : true;
    return setThirdPartyException(typeof host === 'string' ? host : null, allow);
  });
  ipcMain.handle('merezhyvo:settings:cookies:list-exceptions', async () => {
    return listThirdPartyExceptions();
  });
  ipcMain.handle('merezhyvo:settings:cookies:clear-exceptions', async () => {
    return clearThirdPartyExceptions();
  });
};
