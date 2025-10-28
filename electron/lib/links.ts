'use strict';

const windows = require('./windows.ts');
import type { WebContents } from 'electron';

function attachLinkPolicy(contents?: WebContents) {
  if (!contents) return;

  try { contents.setVisualZoomLevelLimits(1, 3); } catch {}
  const applyBaseZoom = () => {
    try {
      contents.setZoomFactor(windows.baseZoomFor(windows.getCurrentMode()));
    } catch {}
  };

  contents.setWindowOpenHandler(({ url }) => {
    windows.handleWindowOpenFromContents(contents, url);
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

module.exports = {
  attachLinkPolicy
};
