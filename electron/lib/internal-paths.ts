'use strict';

import os from 'os';
import path from 'path';

const getInternalAppId = (): string => {
  const appId = process.env.APP_ID ?? '';
  return appId.split('_')[0] || 'merezhyvo.naz.r';
};

export const INTERNAL_APP_ID = getInternalAppId();
export const INTERNAL_BASE_FOLDER = path.join(os.homedir(), '.local', 'share', INTERNAL_APP_ID);
export const DOWNLOADS_FOLDER = path.join(INTERNAL_BASE_FOLDER, 'mDownloads');
export const DOCUMENTS_FOLDER = path.join(INTERNAL_BASE_FOLDER, 'mDocuments');

const INTERNAL_RELATIVE_PATH = `~/.local/share/${INTERNAL_APP_ID}`;
export const DOWNLOADS_SYMLINK_COMMAND = `${`ln -s ${INTERNAL_RELATIVE_PATH}/mDownloads ~/Downloads`}`;
export const DOCUMENTS_SYMLINK_COMMAND = `${`ln -s ${INTERNAL_RELATIVE_PATH}/mDocuments ~/Documents`}`;
