import React, {
  CSSProperties,
  ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef
} from 'react';

type StatusState = 'loading' | 'ready' | 'error';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // Minimal typing to let TSX render the Electron webview tag.
      webview: React.DetailedHTMLProps<React.HTMLAttributes<any>, any> & {
        allowpopups?: string;
      };
    }
  }
}

export type WebViewHandle = {
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  loadURL: (url: string) => void;
  focus: () => void;
  getURL: () => string | null;
  getWebView: () => any;
};

export type WebViewHostProps = {
  initialUrl: string;
  mode: 'mobile' | 'desktop';
  zoom: number;
  onCanGo: (state: { back: boolean; forward: boolean }) => void;
  onStatus: (state: StatusState) => void;
  onUrlChange: (url: string) => void;
  onDomReady?: () => void;
  className?: string;
  style?: CSSProperties;
};

type WebviewTag = any;

const noopState = { back: false, forward: false };

const WebViewHost = forwardRef(function WebViewHost(
  {
    initialUrl,
    mode,
    zoom,
    onCanGo,
    onStatus,
    onUrlChange,
    onDomReady,
    className,
    style
  }: WebViewHostProps,
  ref: ForwardedRef<WebViewHandle>
) {
  const webviewRef = useRef<WebviewTag | null>(null);
  const callbacksRef = useRef({
    onCanGo,
    onStatus,
    onUrlChange,
    onDomReady
  });
  const initialUrlAppliedRef = useRef(false);
  const zoomRef = useRef(zoom);

  useEffect(() => {
    callbacksRef.current = { onCanGo, onStatus, onUrlChange, onDomReady };
  }, [onCanGo, onStatus, onUrlChange, onDomReady]);

  const emitNavigationState = useCallback(() => {
    const node = webviewRef.current;
    const cb = callbacksRef.current.onCanGo;
    if (!cb) return;
    if (!node) {
      cb({ ...noopState });
      return;
    }
    try {
      const back = typeof node.canGoBack === 'function' ? node.canGoBack() : false;
      const forward = typeof node.canGoForward === 'function' ? node.canGoForward() : false;
      cb({ back, forward });
    } catch {
      cb({ ...noopState });
    }
  }, []);

  const applyZoomPolicy = useCallback(() => {
    const node = webviewRef.current;
    if (!node) return;
    try {
      if (typeof node.setVisualZoomLevelLimits === 'function') {
        node.setVisualZoomLevelLimits(1, 3);
      }
      if (typeof node.setZoomFactor === 'function') {
        node.setZoomFactor(zoomRef.current);
      }
    } catch {}
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
    const node = webviewRef.current;
    if (!node) return;
    try {
      if (typeof node.setZoomFactor === 'function') {
        node.setZoomFactor(zoom);
      }
    } catch {}
  }, [zoom]);

  useEffect(() => {
    applyZoomPolicy();
  }, [applyZoomPolicy, mode]);

  useEffect(() => {
    const node = webviewRef.current;
    if (!node || initialUrlAppliedRef.current) return;
    initialUrlAppliedRef.current = true;
    const target = (initialUrl || '').trim();
    if (!target) return;
    try {
      const maybe = node.loadURL(target);
      if (maybe && typeof maybe.catch === 'function') {
        maybe.catch(() => {});
      }
    } catch {
      try {
        node.setAttribute('src', target);
      } catch {}
    }
  }, [initialUrl]);

  useEffect(() => {
    const node = webviewRef.current;
    if (!node) return undefined;

    try {
      const contents = typeof node.getWebContents === 'function' ? node.getWebContents() : null;
      if (contents && typeof contents.setMaxListeners === 'function') {
        const current = typeof contents.getMaxListeners === 'function' ? contents.getMaxListeners() : null;
        if (current == null || current < 50) {
          contents.setMaxListeners(50);
        }
      } else if (typeof (node as any).setMaxListeners === 'function') {
        const current = typeof (node as any).getMaxListeners === 'function'
          ? (node as any).getMaxListeners()
          : null;
        if (current == null || current < 50) {
          (node as any).setMaxListeners(50);
        }
      }
    } catch {
      // best-effort only
    }
    let observed = false;
    const observer = new MutationObserver(() => {
      applyShadowStyles();
    });
    const ensureObserver = () => {
      const root = (node as any).shadowRoot;
      if (!root || observed) return;
      try {
        observer.observe(root, { childList: true, subtree: true });
        observed = true;
      } catch {}
    };

    function applyShadowStyles() {
      try {
        const root = (node as any).shadowRoot;
        if (!root) return;
        const styleId = 'mzr-webview-host-style';
        if (!root.querySelector(`#${styleId}`)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = `
            :host { display: flex !important; height: 100% !important; width: 100% !important; }
            iframe { flex: 1 1 auto !important; width: 100% !important; height: 100% !important; min-height: 100% !important; }
          `;
          root.appendChild(style);
        }
        ensureObserver();
      } catch {}
    }

    applyShadowStyles();
    (node as any).addEventListener('dom-ready', applyShadowStyles);
    ensureObserver();

    const handleDidNavigate = (event: any) => {
      if (event?.url && callbacksRef.current.onUrlChange) {
        callbacksRef.current.onUrlChange(event.url);
      }
      emitNavigationState();
    };

    const handleDidStart = () => {
      callbacksRef.current.onStatus?.('loading');
    };

    const handleDidStop = () => {
      callbacksRef.current.onStatus?.('ready');
      emitNavigationState();
      try {
        const currentUrl = (node as any).getURL?.();
        if (currentUrl && callbacksRef.current.onUrlChange) {
          callbacksRef.current.onUrlChange(currentUrl);
        }
      } catch {}
    };

    const handleDidFail = () => {
      callbacksRef.current.onStatus?.('error');
    };

    const handleDomReady = () => {
      callbacksRef.current.onStatus?.('ready');
      applyZoomPolicy();
      emitNavigationState();
      callbacksRef.current.onDomReady?.();

      // —— MOBILE-ONLY: suppress default long-press callout
      // Keep selection enabled; block the small bubble menu.
      try {
        if (mode === 'mobile' && typeof (node as any).insertCSS === 'function') {
          (node as any).insertCSS(`
            html, body, * {
              -webkit-touch-callout: none !important;
            }
          `);
        }
      } catch {}
      try {
        const currentUrl = (node as any).getURL?.();
        if (currentUrl && callbacksRef.current.onUrlChange) {
          callbacksRef.current.onUrlChange(currentUrl);
        }
      } catch {}
    };

    const handleZoomChanged = () => {
      const desired = zoomRef.current;
      try {
        if (typeof (node as any).setZoomFactor === 'function') {
          (node as any).setZoomFactor(desired);
        }
      } catch {}
    };

    (node as any).addEventListener('did-navigate', handleDidNavigate);
    (node as any).addEventListener('did-navigate-in-page', handleDidNavigate);
    (node as any).addEventListener('did-start-loading', handleDidStart);
    (node as any).addEventListener('did-stop-loading', handleDidStop);
    (node as any).addEventListener('did-fail-load', handleDidFail);
    (node as any).addEventListener('dom-ready', handleDomReady);
    (node as any).addEventListener('zoom-changed', handleZoomChanged);

    return () => {
      (node as any).removeEventListener('dom-ready', applyShadowStyles);
      observer.disconnect();
      (node as any).removeEventListener('did-navigate', handleDidNavigate);
      (node as any).removeEventListener('did-navigate-in-page', handleDidNavigate);
      (node as any).removeEventListener('did-start-loading', handleDidStart);
      (node as any).removeEventListener('did-stop-loading', handleDidStop);
      (node as any).removeEventListener('did-fail-load', handleDidFail);
      (node as any).removeEventListener('dom-ready', handleDomReady);
      (node as any).removeEventListener('zoom-changed', handleZoomChanged);
    };
  }, [applyZoomPolicy, emitNavigationState, mode]);

  useEffect(() => {
    emitNavigationState();
  }, [emitNavigationState]);

  useImperativeHandle(ref, (): WebViewHandle => ({
    goBack: () => {
      const node = webviewRef.current;
      if (!node) return;
      try {
        if (typeof (node as any).goBack === 'function') {
          (node as any).goBack();
        }
      } catch {}
    },
    goForward: () => {
      const node = webviewRef.current;
      if (!node) return;
      try {
        if (typeof (node as any).goForward === 'function') {
          (node as any).goForward();
        }
      } catch {}
    },
    reload: () => {
      const node = webviewRef.current;
      if (!node) return;
      try {
        if (typeof (node as any).reload === 'function') {
          (node as any).reload();
        }
      } catch {}
    },
    loadURL: (url: string) => {
      const node = webviewRef.current;
      if (!node) return;
      const target = (url || '').trim();
      if (!target) return;
      try {
        const maybe = (node as any).loadURL(target);
        if (maybe && typeof (maybe as any).catch === 'function') {
          (maybe as any).catch(() => {});
        }
      } catch {
        try {
          (node as any).setAttribute('src', target);
        } catch {}
      }
    },
    focus: () => {
      const node = webviewRef.current;
      if (!node) return;
      try {
        (node as any).focus();
      } catch {}
    },
    getURL: () => {
      const node = webviewRef.current;
      if (!node) return null;
      try {
        if (typeof (node as any).getURL === 'function') {
          const current = (node as any).getURL();
          return typeof current === 'string' ? current : (node as any).src || null;
        }
        return (node as any).src || null;
      } catch {
        return null;
      }
    },
    getWebView: () => webviewRef.current
  }));

  const composedStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    height: '100%',
    border: 'none',
    ...style
  };

  return (
    // eslint-disable-next-line react/no-unknown-property
    <webview
      ref={webviewRef}
      className={className}
      style={composedStyle}
      //@ts-ignore
      allowpopups="true"
    />
  );
});

export default WebViewHost;
