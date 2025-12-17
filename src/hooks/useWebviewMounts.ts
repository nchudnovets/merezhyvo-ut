import { useCallback } from 'react';
import type { WebviewTag } from 'electron';

export const useWebviewMounts = (
  webviewHostRef: React.RefObject<HTMLDivElement | null>,
  backgroundHostRef: React.RefObject<HTMLDivElement | null>
) => {
  const mountInActiveHost = useCallback((node: HTMLDivElement | null | undefined) => {
    const host = webviewHostRef.current;
    if (!host || !node) return;
    for (const child of Array.from(host.children)) {
      if (child !== node) {
        try { host.removeChild(child); } catch {}
      }
    }
    if (node.parentElement !== host) {
      try { host.appendChild(node); } catch {}
    }
  }, [webviewHostRef]);

  const mountInBackgroundHost = useCallback((node: HTMLDivElement | null | undefined) => {
    const host = backgroundHostRef.current;
    if (!host || !node) return;
    for (const child of Array.from(host.children)) {
      if (child !== node) {
        try { host.removeChild(child); } catch {}
      }
    }
    if (node.parentElement !== host) {
      try { host.appendChild(node); } catch {}
    }
  }, [backgroundHostRef]);

  const applyActiveStyles = useCallback((container: HTMLDivElement, view: WebviewTag) => {
    if (!container || !view) return;
    mountInActiveHost(container);
    Object.assign(container.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'auto',
      opacity: '1'
    });
    Object.assign(view.style, {
      display: 'block',
      opacity: '1',
      pointerEvents: 'auto'
    });
  }, [mountInActiveHost]);

  const installShadowStyles = useCallback((view: WebviewTag | null) => {
    if (!view) return () => {};

    const applyShadowStyles = () => {
      try {
        const root = view.shadowRoot;
        if (!root) return;
        if (!root.querySelector('#mzr-webview-host-style')) {
          const style = document.createElement('style');
          style.id = 'mzr-webview-host-style';
          style.textContent = `
            :host { display: flex !important; height: 100% !important; }
            iframe { flex: 1 1 auto !important; width: 100% !important; height: 100% !important; min-height: 100% !important; }
          `;
          root.appendChild(style);
        }
      } catch {}
    };

    applyShadowStyles();
    view.addEventListener('dom-ready', applyShadowStyles);

    const observer = new MutationObserver(applyShadowStyles);
    if (view.shadowRoot) {
      try {
        observer.observe(view.shadowRoot, { childList: true, subtree: true });
      } catch {}
    }

    return () => {
      view.removeEventListener('dom-ready', applyShadowStyles);
      observer.disconnect();
    };
  }, []);

  return {
    mountInActiveHost,
    mountInBackgroundHost,
    applyActiveStyles,
    installShadowStyles
  };
};
