'use strict';

import { handleWindowOpenFromContents } from './windows';
import type { WebContents } from 'electron';

export function attachLinkPolicy(contents?: WebContents) {
  if (!contents) return;
  try { contents.setMaxListeners(50); } catch {}

  try { contents.setVisualZoomLevelLimits(1, 3); } catch {}
  contents.setWindowOpenHandler(({ url }) => {
    handleWindowOpenFromContents(contents, url);
    return { action: 'deny' };
  });
}
