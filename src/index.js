import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

/**
 * Minimal bootstrap:
 * - keeps Electron-specific imports out of the renderer bundle
 * - logs helpful errors if something goes wrong
 */

function mount() {
  try {
    const rootEl = document.getElementById('root');
    if (!rootEl) {
      console.error('[Merezhyvo] #root not found in DOM');
      return;
    }

    // React to mode changes (desktop/mobile) sent from the main process
    if (window.merezhyvo?.onMode) {
      window.merezhyvo.onMode((mode) => {
        try {
          document.documentElement.dataset.mode = mode || 'desktop';
        } catch {}
      });
    }

    // Allow overriding the mode via ?mode=...
    try {
      const params = new URLSearchParams(location.search);
      const mode = params.get('mode');
      if (mode) {
        document.documentElement.dataset.mode = mode;
      }
    } catch {}

    const root = createRoot(rootEl);
    root.render(<App />);
  } catch (err) {
    console.error('[Merezhyvo] renderer bootstrap failed:', err);
  }
}

// Wait for DOM readiness (important on Ubuntu Touch)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
