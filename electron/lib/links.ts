'use strict';

import { handleWindowOpenFromContents } from './windows';
import type { WebContents } from 'electron';

export function attachLinkPolicy(contents?: WebContents) {
  if (!contents) return;
  try { contents.setMaxListeners(50); } catch {}

  try { contents.setVisualZoomLevelLimits(1, 3); } catch {}
  const handleOpen = (url: string) => {
    if (!url) return;
    handleWindowOpenFromContents(contents, url);
  };
  contents.setWindowOpenHandler(({ url }) => {
    handleOpen(url);
    return { action: 'deny' };
  });
  contents.on('new-window', (event, url: string) => {
    try {
      event.preventDefault();
    } catch {}
    handleOpen(typeof url === 'string' ? url : '');
  });
}
