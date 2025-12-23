import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { WebviewTag } from 'electron';
import type { Tab } from '../types/models';
import type { WebViewHandle } from '../components/webview/WebViewHost';

type DestroyTabOptions = { keepMeta?: boolean };

type TabViewEntry = {
  container: HTMLDivElement | null;
  root: { unmount: () => void } | null;
  cleanup?: () => void;
  view: WebviewTag | null;
  handle: WebViewHandle | null;
  isBackground?: boolean;
};

type Params = {
  tabViewsRef: MutableRefObject<Map<string, TabViewEntry>>;
  playingTabsRef: MutableRefObject<Set<string>>;
  backgroundTabRef: MutableRefObject<string | null>;
  fullscreenTabRef: MutableRefObject<string | null>;
  webviewRef: MutableRefObject<WebviewTag | null>;
  webviewHandleRef: MutableRefObject<WebViewHandle | null>;
  setActiveViewRevision: (updater: (prev: number) => number) => void;
  updateMetaAction: (id: string, patch?: Partial<Tab>) => void;
  updatePowerBlocker: () => void;
  setIsHtmlFullscreen: (flag: boolean) => void;
};

export const useTabDestroy = ({
  tabViewsRef,
  playingTabsRef,
  backgroundTabRef,
  fullscreenTabRef,
  webviewRef,
  webviewHandleRef,
  setActiveViewRevision,
  updateMetaAction,
  updatePowerBlocker,
  setIsHtmlFullscreen
}: Params) => {
  return useCallback((tabId: string, { keepMeta = false }: DestroyTabOptions = {}) => {
    const entry = tabViewsRef.current.get(tabId);
    if (!entry) return;
    try {
      entry.cleanup?.();
    } catch {}
    const { root, container } = entry;
    if (root) {
      Promise.resolve().then(() => {
        try { root.unmount(); } catch {}
        if (container) {
          try { container.remove(); } catch {}
        }
      });
    } else if (container) {
      try { container.remove(); } catch {}
    }
    if (webviewRef.current === entry.view) {
      webviewRef.current = null;
      webviewHandleRef.current = null;
      setActiveViewRevision((rev) => rev + 1);
    }
    tabViewsRef.current.delete(tabId);
    playingTabsRef.current.delete(tabId);
    updatePowerBlocker();
    if (!keepMeta) {
      updateMetaAction(tabId, { isPlaying: false, discarded: true, keepAlive: false });
    }
    if (backgroundTabRef.current === tabId) {
      backgroundTabRef.current = null;
    }
    if (fullscreenTabRef.current === tabId) {
      fullscreenTabRef.current = null;
      setIsHtmlFullscreen(false);
    }
  }, [backgroundTabRef, fullscreenTabRef, playingTabsRef, setActiveViewRevision, setIsHtmlFullscreen, tabViewsRef, updateMetaAction, updatePowerBlocker, webviewHandleRef, webviewRef]);
};
