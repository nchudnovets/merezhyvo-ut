import React, { useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { WebviewTag } from 'electron';
import WebViewHost, { type StatusState, type WebViewHandle } from '../components/webview/WebViewHost';
import type { Mode, Tab } from '../types/models';
import type { TabViewEntry } from '../types/tabView';
import type { NavigationState, CreateWebviewOptions } from '../types/navigation';
import { DEFAULT_URL } from '../utils/navigation';
import { TOR_PARTITION } from '../utils/tor';

type Handlers = {
  handleHostCanGo: (tabId: string, state?: NavigationState | null) => void;
  handleHostStatus: (tabId: string, nextStatus: StatusState) => void;
  handleHostUrlChange: (tabId: string, nextUrl: string) => void;
  handleHostDomReady: (tabId: string) => void;
  handleNavigationStart: (tabId: string, payload: { url: string; isInPage: boolean }) => void;
  handleNavigationError: (
    tabId: string,
    payload: { errorCode: number; errorDescription: string; validatedURL: string; isMainFrame: boolean }
  ) => void;
  attachWebviewListeners: (view: WebviewTag, tabId: string) => (() => void) | void;
  installShadowStyles: (view: WebviewTag) => (() => void) | void;
  applyActiveStyles: (container: HTMLDivElement, view: WebviewTag) => void;
  mountInBackgroundHost: (container: HTMLDivElement | null | undefined) => void;
  refreshNavigationState: () => void;
  refreshCertStatus: (wcId: number | null) => void | Promise<void>;
  updateMetaAction: (tabId: string, patch: Partial<Tab>) => void;
  applyZoomToView: (factor: number, view?: WebviewTag | null) => void;
  getStoredZoomForTab: (tab: Tab | null | undefined, mode: Mode) => number;
  getWebContentsIdSafe: (view?: WebviewTag | null) => number | null;
  destroyTabView: (tabId: string, options?: { keepMeta?: boolean }) => void;
};

type Refs = {
  tabViewsRef: MutableRefObject<Map<string, TabViewEntry>>;
  webviewHostRef: MutableRefObject<HTMLDivElement | null>;
  backgroundTabRef: MutableRefObject<string | null>;
  webviewHandleRef: MutableRefObject<WebViewHandle | null>;
  webviewRef: MutableRefObject<WebviewTag | null>;
  activeIdRef: MutableRefObject<string | null>;
  activeWcIdRef: MutableRefObject<number | null>;
  lastLoadedRef: MutableRefObject<{ id: string | null; url: string | null }>;
  previousActiveTabRef: MutableRefObject<Tab | null>;
  webviewReadyRef: MutableRefObject<boolean>;
  tabsRef: MutableRefObject<Tab[]>;
};

type Setters = {
  setStatus: Dispatch<SetStateAction<StatusState>>;
  setWebviewReady: Dispatch<SetStateAction<boolean>>;
  setActiveViewRevision: Dispatch<SetStateAction<number>>;
};

type Params = {
  mode: Mode;
  tabs: Tab[];
  activeTab: Tab | null;
  tabsReady: boolean;
  torEnabled: boolean;
  refs: Refs;
  handlers: Handlers;
  setters: Setters;
};

export const useTabViewLifecycle = ({
  mode,
  tabs,
  activeTab,
  tabsReady,
  torEnabled,
  refs,
  handlers,
  setters
}: Params) => {
  const {
    tabViewsRef,
    webviewHostRef,
    backgroundTabRef,
    webviewHandleRef,
    webviewRef,
    activeIdRef,
    activeWcIdRef,
    lastLoadedRef,
    previousActiveTabRef,
    webviewReadyRef,
    tabsRef
  } = refs;

  const {
    handleHostCanGo,
    handleHostStatus,
    handleHostUrlChange,
    handleHostDomReady,
    handleNavigationStart,
    handleNavigationError,
    attachWebviewListeners,
    installShadowStyles,
    applyActiveStyles,
    mountInBackgroundHost,
    refreshNavigationState,
    refreshCertStatus,
    updateMetaAction,
    applyZoomToView,
    getStoredZoomForTab,
    getWebContentsIdSafe,
    destroyTabView
  } = handlers;

  const { setStatus, setWebviewReady, setActiveViewRevision } = setters;
  const partitionKey = torEnabled ? TOR_PARTITION : 'default';
  const partitionValue = torEnabled ? TOR_PARTITION : undefined;

  const ensureHostReady = useCallback((): boolean => {
    return webviewHostRef.current != null;
  }, [webviewHostRef]);

  const createWebviewForTab = useCallback(
    (tab: Tab, { zoom: _zoomFactor, mode: currentMode }: CreateWebviewOptions): WebviewTag | null => {
      if (!ensureHostReady()) return null;
      const host = webviewHostRef.current;
      if (!host) {
        return null;
      }
      const initialZoom = getStoredZoomForTab(tab, currentMode);
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.inset = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.backgroundColor = 'var(--mzr-bg)';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      try {
        host.appendChild(container);
      } catch {}
      const root = createRoot(container);
      const entry: TabViewEntry = {
        container,
        root,
        cleanup: () => {},
        isBackground: false,
        partitionKey,
        handle: null,
        view: null,
        render: () => {}
      };
      const refCallback = (instance: WebViewHandle | null) => {
        const prevView = entry.view;
        entry.handle = instance || null;
        entry.view = instance?.getWebView?.() || null;
        const viewChanged = prevView !== entry.view;
        if (viewChanged) {
          try { entry.cleanup?.(); } catch {}
          if (entry.view) {
            const listenersCleanup = attachWebviewListeners(entry.view, tab.id);
            const shadowCleanup = installShadowStyles(entry.view);
            entry.cleanup = () => {
              try { listenersCleanup?.(); } catch {}
              try { shadowCleanup?.(); } catch {}
            };
          } else {
            entry.cleanup = () => {};
          }
        }
        if (activeIdRef.current === tab.id) {
          webviewHandleRef.current = entry.handle;
          webviewRef.current = entry.view;
          activeWcIdRef.current = getWebContentsIdSafe(entry.view);
          if (viewChanged) {
            setActiveViewRevision((rev) => rev + 1);
            void refreshCertStatus(activeWcIdRef.current);
          }
        }
      };
      entry.render = (modeOverride: Mode = currentMode, zoomOverride: number = initialZoom) => {
        const initialUrl = (tab.url && tab.url.trim()) ? tab.url.trim() : DEFAULT_URL;
        root.render(
          <WebViewHost
            key={`${tab.id}:${partitionKey}`}
            ref={refCallback}
            initialUrl={initialUrl}
            mode={modeOverride}
            zoom={zoomOverride}
            partition={partitionValue}
            onCanGo={(state: NavigationState | null) => handleHostCanGo(tab.id, state)}
            onStatus={(nextStatus: StatusState) => handleHostStatus(tab.id, nextStatus)}
            onUrlChange={(url: string) => handleHostUrlChange(tab.id, url)}
            onDomReady={() => handleHostDomReady(tab.id)}
            onNavigationStart={(payload: { url: string; isInPage: boolean }) => handleNavigationStart(tab.id, payload)}
            onNavigationError={(payload: { errorCode: number; errorDescription: string; validatedURL: string; isMainFrame: boolean }) =>
              handleNavigationError(tab.id, payload)}
            style={{ width: '100%', height: '100%' }}
          />
        );
      };
      tabViewsRef.current.set(tab.id, entry);
      entry.render();
      return entry.view;
    },
    [
      activeIdRef,
      attachWebviewListeners,
      getStoredZoomForTab,
      getWebContentsIdSafe,
      handleHostCanGo,
      handleHostStatus,
      handleHostUrlChange,
      handleNavigationError,
      handleNavigationStart,
      installShadowStyles,
      refreshCertStatus,
      setActiveViewRevision,
      tabViewsRef,
      webviewHandleRef,
      webviewHostRef,
      webviewRef,
      activeWcIdRef,
      ensureHostReady,
      handleHostDomReady,
      partitionKey,
      partitionValue
    ]
  );

  const loadUrlIntoView = useCallback(
    (tab: Tab, entry?: TabViewEntry | null) => {
      if (!entry) return;
      const targetUrl = (tab.url && tab.url.trim()) ? tab.url.trim() : DEFAULT_URL;
      if (targetUrl.toLowerCase().startsWith('mzr://')) {
        return;
      }
      const last = lastLoadedRef.current;
      if (last.id === tab.id && last.url === targetUrl) return;
      lastLoadedRef.current = { id: tab.id, url: targetUrl };
      webviewReadyRef.current = false;
      setWebviewReady(false);
      setStatus('loading');
      updateMetaAction(tab.id, { isLoading: true });
      if (entry.handle) {
        entry.handle.loadURL(targetUrl);
        return;
      }
      const view = entry.view;
      if (!view) return;
      try {
        const result = view.loadURL(targetUrl);
        if (result && typeof result.catch === 'function') {
          result.catch(() => {});
        }
      } catch {
        try { view.setAttribute('src', targetUrl); } catch {}
      }
    },
    [lastLoadedRef, setStatus, setWebviewReady, updateMetaAction, webviewReadyRef]
  );

  const activateTabView = useCallback(
    function activate(tab: Tab | null) {
      if (!tab) return;
      updateMetaAction(tab.id, { discarded: false });
      let entry = tabViewsRef.current.get(tab.id);
      if (entry && (entry.partitionKey ?? 'default') !== partitionKey) {
        destroyTabView(tab.id, { keepMeta: true });
        entry = undefined;
      }
      if (!entry) {
        const targetZoom = getStoredZoomForTab(tab, mode);
        const created = createWebviewForTab(tab, { zoom: targetZoom, mode });
        if (!created) {
          requestAnimationFrame(() => activate(tab));
          return;
        }
        entry = tabViewsRef.current.get(tab.id);
      } else {
        const targetZoom = getStoredZoomForTab(tab, mode);
        applyZoomToView(targetZoom, entry.view);
        entry.render?.(mode, targetZoom);
      }
      if (!entry) return;

      entry.isBackground = false;
      if (backgroundTabRef.current === tab.id) {
        backgroundTabRef.current = null;
      }
      const container = entry.container;
      const view = entry.view;
      if (!container || !view) {
        requestAnimationFrame(() => activate(tab));
        return;
      }
      const host = webviewHostRef.current;
      if (host && container.parentElement !== host) {
        try { host.appendChild(container); } catch {}
      }
      applyActiveStyles(container, view);
      webviewHandleRef.current = entry.handle;
      webviewRef.current = view;
      const wcId = getWebContentsIdSafe(view);
      activeWcIdRef.current = wcId;
      void refreshCertStatus(wcId);
      setActiveViewRevision((rev) => rev + 1);

      const current = (() => {
        if (entry.handle && typeof entry.handle.getURL === 'function') {
          const got = entry.handle.getURL();
          return typeof got === 'string' ? got : '';
        }
        try { return view.getURL?.(); } catch { return ''; }
      })();
      const target = (tab.url && tab.url.trim()) ? tab.url.trim() : DEFAULT_URL;
      if (!current || current !== target) {
        loadUrlIntoView(tab, entry);
      } else {
        setStatus('ready');
        webviewReadyRef.current = true;
        setWebviewReady(true);
        refreshNavigationState();
      }
    },
    [
      applyActiveStyles,
      applyZoomToView,
      backgroundTabRef,
      createWebviewForTab,
      getStoredZoomForTab,
      loadUrlIntoView,
      mode,
      destroyTabView,
      refreshNavigationState,
      setActiveViewRevision,
      setStatus,
      setWebviewReady,
      updateMetaAction,
      getWebContentsIdSafe,
      refreshCertStatus,
      tabViewsRef,
      webviewHostRef,
      webviewHandleRef,
      webviewRef,
      activeWcIdRef,
      webviewReadyRef,
      partitionKey
    ]
  );

  const demoteTabView = useCallback(
    (tab: Tab | null) => {
      if (!tab) return;
      const entry = tabViewsRef.current.get(tab.id);
      if (!entry) return;
      if (tab.isYouTube && tab.isPlaying) {
        if (backgroundTabRef.current && backgroundTabRef.current !== tab.id) {
          const previousId = backgroundTabRef.current;
          updateMetaAction(previousId, { isPlaying: false, keepAlive: false });
          destroyTabView(previousId, { keepMeta: true });
        }
        backgroundTabRef.current = tab.id;
        entry.isBackground = true;
        if (entry.container) {
          mountInBackgroundHost(entry.container);
          entry.container.style.pointerEvents = 'none';
          entry.container.style.opacity = '0';
        }
        if (entry.view) {
          entry.view.style.pointerEvents = 'none';
          entry.view.style.opacity = '0';
        }
      } else {
        destroyTabView(tab.id);
      }
    },
    [backgroundTabRef, destroyTabView, mountInBackgroundHost, tabViewsRef, updateMetaAction]
  );

  useEffect(() => {
    const validIds = new Set(tabs.map((tab) => tab.id));
    for (const tabId of Array.from(tabViewsRef.current.keys())) {
      if (!validIds.has(tabId)) {
        destroyTabView(tabId, { keepMeta: true });
      }
    }
  }, [destroyTabView, tabViewsRef, tabs]);

  useEffect(() => {
    const entries = Array.from(tabViewsRef.current.entries());
    for (const [tabId, entry] of entries) {
      const entryKey = entry.partitionKey ?? 'default';
      if (entryKey !== partitionKey) {
        destroyTabView(tabId, { keepMeta: true });
      }
    }
  }, [destroyTabView, partitionKey, tabViewsRef]);

  useEffect(() => {
    if (!tabsReady) return;
    const next = tabsRef.current.find((tab) => tab.id === activeIdRef.current) || activeTab;
    if (!next) return;

    const prev = previousActiveTabRef.current;
    if (prev && prev.id !== next.id) {
      demoteTabView(prev);
    }

    activateTabView(next);
    previousActiveTabRef.current = next;
  }, [activateTabView, activeTab, demoteTabView, tabsReady, tabsRef, activeIdRef, previousActiveTabRef]);

  useEffect(() => () => {
    for (const tabId of Array.from(tabViewsRef.current.keys())) {
      destroyTabView(tabId, { keepMeta: true });
    }
  }, [destroyTabView, tabViewsRef]);

  return {
    createWebviewForTab,
    loadUrlIntoView,
    activateTabView,
    demoteTabView
  };
};
