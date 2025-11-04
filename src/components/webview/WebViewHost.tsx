import React, {
  type CSSProperties,
  type ForwardedRef,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef
} from 'react';
import type { WebviewTag, WebContents } from 'electron';
import { isCtxtExcludedSite } from '../../helpers/websiteCtxtExclusions';

export type StatusState = 'loading' | 'ready' | 'error';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // Minimal typing to let TSX render the Electron webview tag.
      webview: React.DetailedHTMLProps<React.HTMLAttributes<WebviewTag>, WebviewTag> & {
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
  getWebView: () => WebviewTag | null;
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

type Callbacks = {
  onCanGo: WebViewHostProps['onCanGo'];
  onStatus: WebViewHostProps['onStatus'];
  onUrlChange: WebViewHostProps['onUrlChange'];
  onDomReady?: WebViewHostProps['onDomReady'];
};

type ListenerCapable = {
  getMaxListeners?: () => number | undefined;
  setMaxListeners?: (count: number) => void;
};

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
  const callbacksRef = useRef<Callbacks>({
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
      const contents = (node as unknown as { getWebContents?: () => WebContents | null }).getWebContents?.() ?? null;
      if (contents && typeof contents.setMaxListeners === 'function') {
        const current = contents.getMaxListeners?.() ?? null;
        if (current == null || current < 50) {
          contents.setMaxListeners(50);
        }
      } else {
        const emitter = node as unknown as ListenerCapable;
        const current = emitter.getMaxListeners?.() ?? null;
        if (current == null || current < 50) {
          emitter.setMaxListeners?.(50);
        }
      }
    } catch {
      // best-effort only
    }

    let observed = false;
    const observer = new MutationObserver(() => {
      applyShadowStylesInner();
    });

    const ensureObserver = () => {
      const root = node.shadowRoot;
      if (!root || observed) return;
      try {
        observer.observe(root, { childList: true, subtree: true });
        observed = true;
      } catch {}
    };

    const applyShadowStylesInner = () => {
      try {
        const root = node.shadowRoot;
        if (!root) return;
        const styleId = 'mzr-webview-host-style';
        if (!root.querySelector(`#${styleId}`)) {
          const styleEl = document.createElement('style');
          styleEl.id = styleId;
          styleEl.textContent = `
            :host { display: flex !important; height: 100% !important; width: 100% !important; }
            iframe { flex: 1 1 auto !important; width: 100% !important; height: 100% !important; min-height: 100% !important; }
          `;
          root.appendChild(styleEl);
        }
        ensureObserver();
      } catch {}
    };

    const shadowStylesListener: EventListener = () => {
      applyShadowStylesInner();
    };

    applyShadowStylesInner();
    node.addEventListener('dom-ready', shadowStylesListener);
    ensureObserver();

    const handleDidNavigate: EventListener = (event) => {
      const navigationEvent = event as Electron.DidNavigateEvent | Electron.DidNavigateInPageEvent;
      if (navigationEvent?.url) {
        callbacksRef.current.onUrlChange(navigationEvent.url);
      }
      emitNavigationState();
    };

    const handleDidStartNavigation: EventListener = (event) => {
      const nav = event as unknown as Electron.DidStartNavigationEvent;
      if (nav?.isMainFrame && !nav.isInPlace) {
        callbacksRef.current.onStatus('loading');
      }
    };

    const handleDidStop: EventListener = () => {
      callbacksRef.current.onStatus('ready');
      emitNavigationState();
      try {
        const currentUrl = node.getURL?.();
        if (currentUrl) {
          callbacksRef.current.onUrlChange(currentUrl);
        }
      } catch {}
    };

    const handleDidFail: EventListener = () => {
      callbacksRef.current.onStatus('error');
    };

    const handleDomReady: EventListener = () => {
      callbacksRef.current.onStatus('ready');
      applyZoomPolicy();
      emitNavigationState();
      callbacksRef.current.onDomReady?.();

      // —— MOBILE-ONLY: suppress default long-press callout
      // Keep selection enabled; block the small bubble menu — but not on excluded sites.
      try {
        if (mode === 'mobile' && typeof node.insertCSS === 'function') {
          const currentUrl = node.getURL?.() ?? '';
          if (!isCtxtExcludedSite(currentUrl)) {
            node.insertCSS(`
              html, body, * {
                -webkit-touch-callout: none !important;
              }
            `);
          }
        }
      } catch {}

      try {
        const currentUrl = node.getURL?.();
        if (currentUrl) {
          callbacksRef.current.onUrlChange(currentUrl);
        }
      } catch {}
    };

    node.addEventListener('did-navigate', handleDidNavigate);
    node.addEventListener('did-navigate-in-page', handleDidNavigate);
    // Main-frame only loading → use did-start-navigation
    node.addEventListener('did-start-navigation', handleDidStartNavigation);
    node.addEventListener('did-stop-loading', handleDidStop);
    node.addEventListener('did-fail-load', handleDidFail);
    node.addEventListener('dom-ready', handleDomReady);

    return () => {
      node.removeEventListener('dom-ready', shadowStylesListener);
      observer.disconnect();
      node.removeEventListener('did-navigate', handleDidNavigate);
      node.removeEventListener('did-navigate-in-page', handleDidNavigate);
      node.removeEventListener('did-start-navigation', handleDidStartNavigation);
      node.removeEventListener('did-stop-loading', handleDidStop);
      node.removeEventListener('did-fail-load', handleDidFail);
      node.removeEventListener('dom-ready', handleDomReady);
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
        if (typeof node.goBack === 'function') {
          node.goBack();
        }
      } catch {}
    },
    goForward: () => {
      const node = webviewRef.current;
      if (!node) return;
      try {
        if (typeof node.goForward === 'function') {
          node.goForward();
        }
      } catch {}
    },
    reload: () => {
      const node = webviewRef.current;
      if (!node) return;
      try {
        if (typeof node.reload === 'function') {
          node.reload();
        }
      } catch {}
    },
    loadURL: (url: string) => {
      const node = webviewRef.current;
      if (!node) return;
      const target = (url || '').trim();
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
    },
    focus: () => {
      const node = webviewRef.current;
      if (!node) return;
      try {
        node.focus();
      } catch {}
    },
    getURL: () => {
      const node = webviewRef.current;
      if (!node) return null;
      try {
        if (typeof node.getURL === 'function') {
          const current = node.getURL();
          return typeof current === 'string' ? current : node.src || null;
        }
        return node.src || null;
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
    <webview
      ref={webviewRef}
      className={className}
      style={composedStyle}
      //@ts-expect-error expexted
      // eslint-disable-next-line react/no-unknown-property
      allowpopups="true"
    />
  );
});

export default WebViewHost;
