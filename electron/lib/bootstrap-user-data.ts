'use strict';

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { DOCUMENTS_FOLDER, DOWNLOADS_FOLDER, INTERNAL_APP_ID, INTERNAL_BASE_FOLDER } from './internal-paths';

export const ensureStableUserData = (): void => {
  try {
    const pkgName = INTERNAL_APP_ID;

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

    fs.mkdirSync(INTERNAL_BASE_FOLDER, { recursive: true });
    fs.mkdirSync(DOWNLOADS_FOLDER, { recursive: true });
    fs.mkdirSync(DOCUMENTS_FOLDER, { recursive: true });
  } catch {
    // noop
  }
};

ensureStableUserData();
