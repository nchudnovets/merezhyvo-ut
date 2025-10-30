import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import type { Mode } from './types/models';

const mount = (): void => {
  try {
    const rootEl = document.getElementById('root');
    if (!rootEl) {
      console.error('[Merezhyvo] #root not found in DOM');
      return;
    }

    const api = window.merezhyvo;
    api?.onMode?.((mode: Mode) => {
      try {
        document.documentElement.dataset.mode = mode;
      } catch {}
    });

    try {
      const params = new URLSearchParams(window.location.search);
      const modeOverride = params.get('mode');
      if (modeOverride) {
        document.documentElement.dataset.mode = modeOverride;
      }
    } catch {}

    const root = createRoot(rootEl);
    root.render(<App />);
  } catch (err) {
    console.error('[Merezhyvo] renderer bootstrap failed:', err);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
