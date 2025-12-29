import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WebviewTag } from 'electron';
import type { Mode, Tab } from '../types/models';
import { ZOOM_MAX, ZOOM_MIN } from '../utils/zoom';
import type { MutableRefObject } from 'react';

type Params = {
  mode: Mode;
  activeTab: Tab | null;
  activeId: string | null;
  tabs: Tab[];
  tabsReady: boolean;
  activeTabRef: MutableRefObject<Tab | null>;
  activeViewRevision: number;
  webviewReady: boolean;
  getActiveWebview: () => WebviewTag | null;
  updateTabZoom: (tabId: string, patch: { zoomMobile?: number; zoomDesktop?: number }) => void;
  defaults: { mobile: number; desktop: number };
};

export const useWebviewZoom = ({
  mode,
  activeTab,
  activeId,
  tabs,
  tabsReady,
  activeTabRef,
  activeViewRevision,
  webviewReady,
  getActiveWebview,
  updateTabZoom,
  defaults
}: Params) => {
  const [zoomLevel, setZoomLevel] = useState<number>(() =>
    mode === 'mobile' ? defaults.mobile : defaults.desktop
  );
  const zoomRef = useRef<number>(zoomLevel);

  const baseZoomForMode = useCallback(
    (m: Mode) => (m === 'mobile' ? defaults.mobile : defaults.desktop),
    [defaults]
  );

  const getStoredZoomForTab = useCallback(
    (tab: Tab | null | undefined, m: Mode): number => {
      if (!tab) return baseZoomForMode(m);
      const stored = m === 'mobile' ? tab.zoomMobile : tab.zoomDesktop;
      return typeof stored === 'number' && Number.isFinite(stored) ? stored : baseZoomForMode(m);
    },
    [baseZoomForMode]
  );

  const applyZoomToView = useCallback(
    (factor: number, view?: WebviewTag | null) => {
      const target = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, factor));
      zoomRef.current = target;
      setZoomLevel(target);
      const node = view ?? getActiveWebview();
      if (!node) return;
      try {
        if (typeof node.setZoomFactor === 'function') {
          node.setZoomFactor(target);
        } else {
          node.executeJavaScript(`require('electron').webFrame.setZoomFactor(${target})`).catch(() => {});
        }
      } catch {
        // noop
      }
    },
    [getActiveWebview]
  );

  const setZoomClamped = useCallback(
    (val: number | string) => {
      const numeric = Number(val);
      if (!Number.isFinite(numeric)) return;
      const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, numeric));
      const rounded = Math.round(clamped * 100) / 100;
      applyZoomToView(rounded);
      const activeTabId = activeId;
      if (activeTabId) {
        if (mode === 'mobile') {
          updateTabZoom(activeTabId, { zoomMobile: rounded });
        } else {
          updateTabZoom(activeTabId, { zoomDesktop: rounded });
        }
      }
    },
    [activeId, applyZoomToView, mode, updateTabZoom]
  );

  useEffect(() => {
    const target = getStoredZoomForTab(activeTab, mode);
    const frame = requestAnimationFrame(() => {
      applyZoomToView(target);
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, mode, getStoredZoomForTab, applyZoomToView]);

  useEffect(() => {
    if (!activeId || !tabsReady) return;
    const current = tabs.find((t) => t.id === activeId) ?? activeTab;
    const target = getStoredZoomForTab(current, mode);
    const frame = requestAnimationFrame(() => {
      applyZoomToView(target);
    });
    return () => cancelAnimationFrame(frame);
  }, [activeId, tabs, tabsReady, mode, getStoredZoomForTab, applyZoomToView, activeTab]);

  useEffect(() => {
    const applyZoomPolicy = () => {
      const view = getActiveWebview();
      if (!view) return;
      const tab = activeTabRef.current;
      const target = getStoredZoomForTab(tab, mode);
      try {
        if (typeof view.setVisualZoomLevelLimits === 'function') {
          view.setVisualZoomLevelLimits(1, ZOOM_MAX);
        }
      } catch {
        // ignore
      }
      applyZoomToView(target, view);
    };

    const view = getActiveWebview();
    if (!view) return;

    const onReady = () => applyZoomPolicy();
    const onNavigate = () => applyZoomPolicy();

    view.addEventListener('dom-ready', onReady);
    view.addEventListener('did-frame-finish-load', onReady);
    view.addEventListener('did-navigate', onNavigate);
    view.addEventListener('did-navigate-in-page', onNavigate);

    onReady();

    return () => {
      view.removeEventListener('dom-ready', onReady);
      view.removeEventListener('did-frame-finish-load', onReady);
      view.removeEventListener('did-navigate', onNavigate);
      view.removeEventListener('did-navigate-in-page', onNavigate);
    };
  }, [activeId, activeViewRevision, applyZoomToView, getActiveWebview, getStoredZoomForTab, mode, webviewReady, activeTabRef]);

  const zoomDisplay = useMemo(() => `${Math.round(zoomLevel * 100)}%`, [zoomLevel]);

  return {
    zoomLevel,
    zoomDisplay,
    setZoomClamped,
    applyZoomToView,
    getStoredZoomForTab
  };
};
