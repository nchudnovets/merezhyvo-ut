import { useCallback, useRef, useState } from 'react';
import type { Mode, MessengerDefinition, MessengerId, MessengerSettings } from '../types/models';
import { tabsActions, getTabsState } from '../store/tabs';
import { sanitizeMessengerSettings, resolveOrderedMessengers } from '../shared/messengers';
import type { WebviewTag } from 'electron';

type UseMessengerModeParams = {
  activeId: string | null;
  mode: Mode;
  getActiveWebview: () => WebviewTag | null;
  blurActiveInWebview: () => void;
  resetEditingState: () => void;
  setInputValue: (v: string) => void;
};

export const useMessengerMode = ({
  activeId,
  mode: _mode,
  getActiveWebview: _getActiveWebview,
  blurActiveInWebview,
  resetEditingState,
  setInputValue
}: UseMessengerModeParams) => {
  const [mainViewMode, setMainViewMode] = useState<'browser' | 'messenger'>('browser');
  const [messengerSettingsState, setMessengerSettingsState] = useState<MessengerSettings>(() =>
    sanitizeMessengerSettings(null)
  );
  const messengerSettingsRef = useRef<MessengerSettings>(messengerSettingsState);
  const messengerTabIdsRef = useRef<Map<MessengerId, string>>(new Map());
  const prevBrowserTabIdRef = useRef<string | null>(null);
  const pendingMessengerTabIdRef = useRef<string | null>(null);
  const lastMessengerIdRef = useRef<MessengerId | null>(null);
  const [activeMessengerId, setActiveMessengerId] = useState<MessengerId | null>(null);

  const orderedMessengers = resolveOrderedMessengers(messengerSettingsState);

  const { activateTab: activateTabAction, closeTab: closeTabAction } = tabsActions;

  const ensureMessengerTab = useCallback(
    (definition: MessengerDefinition): string | null => {
      const map = messengerTabIdsRef.current;
      const existingId = map.get(definition.id);
      if (existingId) {
        const currentState = getTabsState();
        if (currentState.tabs.some((tab) => tab.id === existingId)) {
          return existingId;
        }
        map.delete(definition.id);
      }
      tabsActions.newTab(definition.url, { title: definition.title, kind: 'messenger' });
      const nextState = getTabsState();
      const createdId = nextState.activeId || null;
      if (createdId) {
        map.set(definition.id, createdId);
        tabsActions.updateMeta(createdId, { title: definition.title, url: definition.url });
      }
      return createdId;
    },
    []
  );

  const exitMessengerMode = useCallback(() => {
    if (mainViewMode !== 'messenger') return;
    const stateBeforeExit = getTabsState();
    const activeBeforeExit =
      stateBeforeExit.tabs.find((tab) => tab.id === stateBeforeExit.activeId) ?? null;
    const shouldRestorePrevious = !activeBeforeExit || activeBeforeExit.kind === 'messenger';
    const idsToClose = Array.from(messengerTabIdsRef.current.values());
    messengerTabIdsRef.current.clear();
    pendingMessengerTabIdRef.current = null;
    setMainViewMode('browser');
    setActiveMessengerId(null);
    void window.merezhyvo?.ua?.setMode?.('auto');
    const previousId = prevBrowserTabIdRef.current;
    prevBrowserTabIdRef.current = null;
    if (idsToClose.length) {
      for (const tabId of idsToClose) {
        closeTabAction(tabId);
      }
    }
    if (shouldRestorePrevious && previousId) {
      const state = getTabsState();
      if (state.tabs.some((tab) => tab.id === previousId)) {
        activateTabAction(previousId);
      }
    }
    resetEditingState();
  }, [activateTabAction, closeTabAction, mainViewMode, resetEditingState]);

  const activateMessenger = useCallback(
    (definition: MessengerDefinition) => {
      resetEditingState();
      blurActiveInWebview();
      const tabId = ensureMessengerTab(definition);
      if (!tabId) return;
      pendingMessengerTabIdRef.current = tabId;
      if (activeId !== tabId) {
        activateTabAction(tabId);
      }
      setMainViewMode('messenger');
      setActiveMessengerId(definition.id);
      lastMessengerIdRef.current = definition.id;
      void window.merezhyvo?.ua?.setMode?.('desktop');
      setInputValue(definition.url);
    },
    [activateTabAction, activeId, blurActiveInWebview, ensureMessengerTab, resetEditingState, setInputValue]
  );

  const handleEnterMessengerMode = useCallback(() => {
    if (!orderedMessengers.length) return;
    if (mainViewMode !== 'messenger') {
      prevBrowserTabIdRef.current = activeId;
    }
    const last = lastMessengerIdRef.current;
    const next = orderedMessengers.find((m) => m.id === last) ?? orderedMessengers[0];
    if (!next) return;
    activateMessenger(next);
  }, [activateMessenger, activeId, mainViewMode, orderedMessengers]);

  const handleMessengerSelect = useCallback(
    (id: MessengerId) => {
      const definition = orderedMessengers.find((m) => m.id === id);
      if (!definition) return;
      activateMessenger(definition);
    },
    [activateMessenger, orderedMessengers]
  );

  const exitIfNoMessengers = useCallback(() => {
    if (mainViewMode === 'messenger' && orderedMessengers.length === 0) {
      exitMessengerMode();
    }
  }, [exitMessengerMode, mainViewMode, orderedMessengers]);

  return {
    mainViewMode,
    setMainViewMode,
    messengerSettingsState,
    setMessengerSettingsState,
    messengerSettingsRef,
    messengerTabIdsRef,
    prevBrowserTabIdRef,
    pendingMessengerTabIdRef,
    lastMessengerIdRef,
    activeMessengerId,
    setActiveMessengerId,
    orderedMessengers,
    exitMessengerMode,
    activateMessenger,
    handleEnterMessengerMode,
    handleMessengerSelect,
    ensureMessengerTab,
    exitIfNoMessengers
  };
};
