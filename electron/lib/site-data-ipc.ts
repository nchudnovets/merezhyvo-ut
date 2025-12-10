import { ipcMain } from 'electron';
import { clearCookiesForHost, clearHistoryForHost, clearSiteDataGlobal, clearSiteStorageForHost, listSiteDataEntries } from './site-data';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const registerSiteDataIpc = (): void => {
  ipcMain.handle('merezhyvo:siteData:list', async () => {
    return listSiteDataEntries();
  });

  ipcMain.handle('merezhyvo:siteData:clearCookiesForSite', async (_event, payload: unknown) => {
    const host =
      typeof payload === 'string'
        ? payload
        : isRecord(payload) && typeof payload.host === 'string'
        ? payload.host
        : '';
    if (!host?.trim()) {
      return { ok: false, error: 'Invalid host' };
    }
    try {
      await clearCookiesForHost(host);
      return { ok: true };
    } catch (err) {
      console.error('[merezhyvo] site cookies clear failed', err);
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('merezhyvo:siteData:clearStorageForSite', async (_event, payload: unknown) => {
    const host =
      typeof payload === 'string'
        ? payload
        : isRecord(payload) && typeof payload.host === 'string'
        ? payload.host
        : '';
    if (!host?.trim()) {
      return { ok: false, error: 'Invalid host' };
    }
    try {
      await clearSiteStorageForHost(host);
      return { ok: true };
    } catch (err) {
      console.error('[merezhyvo] site storage clear failed', err);
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('merezhyvo:siteData:clearGlobal', async (_event, payload: unknown) => {
    const cookiesAndSiteData =
      isRecord(payload) && typeof payload.cookiesAndSiteData === 'boolean'
        ? payload.cookiesAndSiteData
        : false;
    const cache = isRecord(payload) && typeof payload.cache === 'boolean' ? payload.cache : false;
    const history = isRecord(payload) && typeof payload.history === 'boolean' ? payload.history : false;
    if (!cookiesAndSiteData && !cache && !history) {
      return { ok: false, error: 'Nothing selected' };
    }
    try {
      await clearSiteDataGlobal({ cookiesAndSiteData, cache, history });
      return { ok: true };
    } catch (err) {
      console.error('[merezhyvo] global site data clear failed', err);
      return { ok: false, error: String(err) };
    }
  });

  ipcMain.handle('merezhyvo:siteData:clearHistoryForSite', async (_event, payload: unknown) => {
    const host =
      typeof payload === 'string'
        ? payload
        : isRecord(payload) && typeof payload.host === 'string'
        ? payload.host
        : '';
    if (!host?.trim()) {
      return { ok: false, error: 'Invalid host' };
    }
    try {
      await clearHistoryForHost(host);
      return { ok: true };
    } catch (err) {
      console.error('[merezhyvo] site history clear failed', err);
      return { ok: false, error: String(err) };
    }
  });
};
