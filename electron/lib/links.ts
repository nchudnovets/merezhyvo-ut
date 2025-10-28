'use strict';

import { baseZoomFor, getCurrentMode, handleWindowOpenFromContents } from './windows';
import type { WebContents } from 'electron';

export function attachLinkPolicy(contents?: WebContents) {
  if (!contents) return;
  try { contents.setMaxListeners(50); } catch {}

  try { contents.setVisualZoomLevelLimits(1, 3); } catch {}
  const applyBaseZoom = () => {
    try {
      contents.setZoomFactor(baseZoomFor(getCurrentMode()));
    } catch {}
  };

  contents.setWindowOpenHandler(({ url }) => {
    handleWindowOpenFromContents(contents, url);
    return { action: 'deny' };
  });

  // contents.on('new-window', (event, url) => {
  //   event.preventDefault();
  //   windows.handleWindowOpenFromContents(contents, url);
  // });

  contents.on('dom-ready', applyBaseZoom);
  contents.on('did-navigate', applyBaseZoom);
  contents.on('did-navigate-in-page', applyBaseZoom);
}
