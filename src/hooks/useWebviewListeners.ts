import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { WebviewTag } from 'electron';
import type { Tab } from '../types/models';

type DestroyTabOptions = { keepMeta?: boolean };

type WebviewTitleEvent = {
  title?: string | null;
};

type WebviewFaviconEvent = {
  favicons?: unknown;
};

type Params = {
  baseCssRef: MutableRefObject<string>;
  updateMetaAction: (id: string, patch?: Partial<Tab>) => void;
  playingTabsRef: MutableRefObject<Set<string>>;
  updatePowerBlocker: () => void;
  isYouTubeTab: (tabId: string) => boolean;
  backgroundTabRef: MutableRefObject<string | null>;
  destroyTabView: (tabId: string, options?: DestroyTabOptions) => void;
  fullscreenTabRef: MutableRefObject<string | null>;
  setIsHtmlFullscreen: (value: boolean) => void;
  webviewFocusedRef: MutableRefObject<boolean>;
  openNewTab: (url: string) => void;
};

export const useWebviewListeners = ({
  baseCssRef,
  updateMetaAction,
  playingTabsRef,
  updatePowerBlocker,
  isYouTubeTab,
  backgroundTabRef,
  destroyTabView,
  fullscreenTabRef,
  setIsHtmlFullscreen,
  webviewFocusedRef,
  openNewTab
}: Params) => {
  return useCallback((view: WebviewTag, tabId: string) => {
    const handleTitle = (event: WebviewTitleEvent | null | undefined) => {
      const titleValue = typeof event?.title === 'string' ? event.title : '';
      if (titleValue) {
        updateMetaAction(tabId, { title: titleValue, lastUsedAt: Date.now() });
      }
    };

    const handleFavicon = (event: WebviewFaviconEvent | null | undefined) => {
      const favicons = Array.isArray(event?.favicons) ? event.favicons : [];
      const favicon = favicons.find((href): href is string => typeof href === 'string' && href.trim().length > 0);
      if (favicon) {
        updateMetaAction(tabId, { favicon: favicon.trim() });
      }
    };

    const handleMediaStarted = () => {
      playingTabsRef.current.add(tabId);
      updatePowerBlocker();
      updateMetaAction(tabId, {
        isPlaying: true,
        discarded: false,
        keepAlive: isYouTubeTab(tabId)
      });
    };

    const handleMediaPaused = () => {
      playingTabsRef.current.delete(tabId);
      updatePowerBlocker();
      const shouldKeepAlive = isYouTubeTab(tabId) || backgroundTabRef.current === tabId;
      updateMetaAction(tabId, { isPlaying: false, keepAlive: shouldKeepAlive });
      if (backgroundTabRef.current === tabId && !shouldKeepAlive) {
        destroyTabView(tabId, { keepMeta: true });
      }
    };

    const handleEnterFullscreen = () => {
      fullscreenTabRef.current = tabId;
      setIsHtmlFullscreen(true);
    };

    const handleLeaveFullscreen = () => {
      if (fullscreenTabRef.current === tabId) {
        fullscreenTabRef.current = null;
        setIsHtmlFullscreen(false);
      }
    };

    const openWindowUrl = (rawUrl: unknown) => {
      const nextUrl = typeof rawUrl === 'string' ? rawUrl : '';
      if (!nextUrl) return;
      openNewTab(nextUrl);
    };

    const handleIpcMessage = (event: Event) => {
      const payload = event as { channel?: unknown; args?: unknown[] };
      if (payload.channel !== 'mzr:webview:open-url') return;
      const raw = Array.isArray(payload.args) ? payload.args[0] : undefined;
      if (typeof raw === 'string') {
        openWindowUrl(raw);
        return;
      }
      if (raw && typeof raw === 'object' && typeof (raw as { url?: unknown }).url === 'string') {
        openWindowUrl((raw as { url?: string }).url);
      }
    };

    const injectBaseCss = () => {
      const css = baseCssRef.current;
      if (!css) return;
      try {
        const maybe = view.insertCSS(css);
        if (maybe && typeof maybe.catch === 'function') {
          maybe.catch(() => {});
        }
      } catch {}
    };

    injectBaseCss();
    const handleFocus = () => { webviewFocusedRef.current = true; };
    const handleBlur = () => { webviewFocusedRef.current = false; };
    view.addEventListener('dom-ready', injectBaseCss);
    view.addEventListener('did-navigate', injectBaseCss);
    view.addEventListener('did-navigate-in-page', injectBaseCss);
    view.addEventListener('focus', handleFocus);
    view.addEventListener('blur', handleBlur);

    view.addEventListener('page-title-updated', handleTitle);
    view.addEventListener('page-favicon-updated', handleFavicon);
    view.addEventListener('media-started-playing', handleMediaStarted);
    view.addEventListener('media-paused', handleMediaPaused);
    view.addEventListener('enter-html-full-screen', handleEnterFullscreen);
    view.addEventListener('leave-html-full-screen', handleLeaveFullscreen);
    view.addEventListener('ipc-message', handleIpcMessage);

    injectBaseCss();

    return () => {
      view.removeEventListener('page-title-updated', handleTitle);
      view.removeEventListener('page-favicon-updated', handleFavicon);
      view.removeEventListener('media-started-playing', handleMediaStarted);
      view.removeEventListener('media-paused', handleMediaPaused);
      view.removeEventListener('enter-html-full-screen', handleEnterFullscreen);
      view.removeEventListener('leave-html-full-screen', handleLeaveFullscreen);
      view.removeEventListener('ipc-message', handleIpcMessage);
      view.removeEventListener('dom-ready', injectBaseCss);
      view.removeEventListener('did-navigate', injectBaseCss);
      view.removeEventListener('did-navigate-in-page', injectBaseCss);
      view.removeEventListener('focus', handleFocus);
      view.removeEventListener('blur', handleBlur);
    };
  }, [
    backgroundTabRef,
    baseCssRef,
    destroyTabView,
    fullscreenTabRef,
    isYouTubeTab,
    playingTabsRef,
    openNewTab,
    setIsHtmlFullscreen,
    updateMetaAction,
    updatePowerBlocker,
    webviewFocusedRef
  ]);
};
