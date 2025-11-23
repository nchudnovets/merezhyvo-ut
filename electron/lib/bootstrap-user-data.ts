'use strict';

import path from 'path';
import { app } from 'electron';

export const ensureStableUserData = (): void => {
  try {
    const appId = process.env.APP_ID ?? '';
    const pkgName = appId.split('_')[0] || 'merezhyvo.naz.r';

    const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(app.getPath('home'), '.config');
    const xdgCache = process.env.XDG_CACHE_HOME || path.join(app.getPath('home'), '.cache');

    const userDataDir = path.join(xdgConfig, pkgName);
    const logsDir = path.join(xdgCache, pkgName);

    app.setPath('userData', userDataDir);
    try {
      app.setAppLogsPath(logsDir);
    } catch {
      // noop
    }
  } catch {
    // noop
  }
};

ensureStableUserData();
