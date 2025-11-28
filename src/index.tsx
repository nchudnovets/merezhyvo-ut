import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import type { Mode } from './types/models';
import { I18nProvider } from './i18n/I18nProvider';
import { DEFAULT_LOCALE } from './i18n/locales';
import { ipc } from './services/ipc/ipc';

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

    const bootstrap = async () => {
      let initialLanguage = DEFAULT_LOCALE;
      try {
        const lang = await ipc.ui.getLanguage();
        if (lang && typeof lang === 'string') {
          initialLanguage = lang;
        }
      } catch {
        // noop
      }
      root.render(
        <I18nProvider
          initialLanguage={initialLanguage}
          fallback={<div style={{ color: '#fff' }}>Loading…</div>}
        >
          <App />
        </I18nProvider>
      );
    };

    void bootstrap();
  } catch (err) {
    console.error('[Merezhyvo] renderer bootstrap failed:', err);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
