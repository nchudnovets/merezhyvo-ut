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

    const flattenEmitter = (emitter: ListenerCapable | null) => {
      if (!emitter || typeof emitter.setMaxListeners !== 'function') {
        return;
      }
      try {
        const current = emitter.getMaxListeners?.();
        if (current !== 0) {
          emitter.setMaxListeners(0);
        }
      } catch {
        // ignore
      }
    };

    try {
      const contents = (node as unknown as { getWebContents?: () => WebContents | null }).getWebContents?.() ?? null;
      flattenEmitter(contents as ListenerCapable | null);
      flattenEmitter(node as ListenerCapable);
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

  useEffect(() => {
  const el = webviewRef.current;
  if (!el) return;

  // Wire ipc-message listener (mirror notifications to host)
  const handleIpcMessage = (e: Electron.IpcMessageEvent) => {
    const passwordsApi = window.merezhyvo?.passwords;
    const wcId = typeof el.getWebContentsId === 'function' ? el.getWebContentsId() : undefined;

    if (e.channel === 'mzr:pw:field-focus') {
      const payload = e.args?.[0] as { origin?: string; signonRealm?: string; field?: string };
      if (wcId && payload && payload.origin && payload.signonRealm && (payload.field === 'password' || payload.field === 'username')) {
        void passwordsApi?.notifyFieldFocus({
          wcId,
          origin: payload.origin,
          signonRealm: payload.signonRealm,
          field: payload.field as 'username' | 'password'
        });
      }
      return;
    }

    if (e.channel === 'mzr:pw:field-blur') {
      if (wcId) {
        void passwordsApi?.notifyFieldBlur(wcId);
      }
      return;
    }

    if (e.channel !== 'mzr:webview:notification') return;

    const raw = e.args?.[0] as {
      title: string;
      options: { body: string; icon: string; data: unknown; tag: string };
    };

    // Determine current URL of this webview for toast → focus mapping
    let currentUrl: string | undefined;
    try {
      const got = el.getURL?.();
      currentUrl = typeof got === 'string' ? got : el.src || undefined;
    } catch {
      currentUrl = el.src || undefined;
    }

    const detail = {
      title: raw.title,
      options: {
        body: raw.options?.body ?? '',
        icon: raw.options?.icon ?? '',
        data: raw.options?.data ?? null,
        tag: raw.options?.tag ?? ''
      },
      source: { url: currentUrl } as { url?: string }
    };

    window.dispatchEvent(new CustomEvent('mzr-notification', { detail }));
  };

  // Electron.WebviewTag supports this event name
  el.addEventListener('ipc-message', handleIpcMessage as unknown as EventListener);

  return () => {
    el.removeEventListener('ipc-message', handleIpcMessage as unknown as EventListener);
  };
}, []);


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
