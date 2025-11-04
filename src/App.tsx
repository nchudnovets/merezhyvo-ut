import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type {
  CSSProperties,
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  FocusEvent as ReactFocusEvent,
  FormEvent
} from 'react';
import type { WebviewTag } from 'electron';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import Toolbar from './components/toolbar/Toolbar';
import { MessengerToolbar } from './components/messenger/MessengerToolbar';
import WebViewPane from './components/webview/WebViewPane';
import ZoomBar from './components/zoom/ZoomBar';
import CreateShortcutModal from './components/modals/shortcutModal/CreateShortcut';
import { SettingsModal } from './components/modals/settingsModal/SettingsModal';
import { TabsPanel } from './components/modals/tabsPanel/TabsPanel';
import { tabsPanelStyles } from './components/modals/tabsPanel/tabsPanelStyles';
import WebViewHost from './components/webview/WebViewHost';
import type { WebViewHandle, StatusState } from './components/webview/WebViewHost';
import { zoomBarStyles, zoomBarModeStyles } from './components/zoom/zoomBarStyles';
import { styles } from './styles/styles';
import { useMerezhyvoMode } from './hooks/useMerezhyvoMode';
import { ipc } from './services/ipc/ipc';
import { torService } from './services/tor/tor';
import { windowHelpers } from './services/window/window';
import { useTabsStore, tabsActions, defaultTabUrl, getTabsState } from './store/tabs';
import KeyboardPane from './components/keyboard/KeyboardPane';
import type { LayoutId } from './components/keyboard/layouts';
import { nextLayoutId, LANGUAGE_LAYOUT_IDS } from './components/keyboard/layouts';
import type { GetWebview } from './components/keyboard/inject';
import { makeMainInjects, makeWebInjects, probeWebEditable } from './components/keyboard/inject';
import type { Mode, InstalledApp, Tab, MessengerId, MessengerDefinition, MessengerSettings } from './types/models';
import { sanitizeMessengerSettings, resolveOrderedMessengers } from './shared/messengers';
import { setupHostRtlDirection } from './keyboard/hostRtl';
import { isCtxtExcludedSite } from './helpers/websiteCtxtExclusions';

const DEFAULT_URL = defaultTabUrl;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.5;
const ZOOM_STEP = 0.1;

type StartParams = {
  url: string;
  hasStartParam: boolean;
  single: boolean;
};

type AppInfo = {
  name: string;
  version: string;
  description: string;
  chromium: string;
  electron: string;
  node: string;
};

type ActiveInputTarget = 'url' | 'modalTitle' | 'modalUrl' | 'torContainer' | null;

type LoadInstalledAppsOptions = {
  quiet?: boolean;
};

type NavigationState = {
  back?: boolean;
  forward?: boolean;
};

type CreateWebviewOptions = {
  zoom: number;
  mode: Mode;
};

type DestroyTabOptions = {
  keepMeta?: boolean;
};

type LastLoadedInfo = {
  id: string | null;
  url: string | null;
};

type WebviewTitleEvent = {
  title?: string | null;
};

type WebviewFaviconEvent = {
  favicons?: unknown;
};

type KeyboardDirection = 'ArrowLeft' | 'ArrowRight';

type TabViewEntry = {
  container: HTMLDivElement;
  root: Root;
  cleanup: () => void;
  isBackground: boolean;
  handle: WebViewHandle | null;
  view: WebviewTag | null;
  render: (mode?: Mode, zoom?: number) => void;
};

type MainBrowserAppProps = {
  initialUrl: string;
  mode: Mode;
  hasStartParam: boolean;
};

type SingleWindowAppProps = {
  initialUrl: string;
  mode: Mode;
};

type SubmitEvent = FormEvent<HTMLFormElement> | { preventDefault: () => void } | undefined;

const WEBVIEW_BASE_CSS = `
  :root, html { color-scheme: dark; }
  @media (prefers-color-scheme: light) {
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: #111827; }
  ::-webkit-scrollbar-thumb {
    background: #2563eb;
    border-radius: 999px;
    border: 2px solid #111827;
  }
  ::-webkit-scrollbar-thumb:hover { background: #1d4ed8; }
  input, textarea, [contenteditable='true'] {
    caret-color: #60a5fa !important;
  }
  :root {
    --mzr-caret-accent: #22d3ee;
    --mzr-focus-ring:   #60a5fa;
    --mzr-sel-bg:       rgba(34,211,238,.28);
    --mzr-sel-fg:       #0b1020;
  }
  html, body, * {
    -webkit-touch-callout: none !important;
  }
  input, textarea, [contenteditable="true"] {
    -webkit-user-select: text !important;
    user-select: text !important;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --mzr-caret-accent: #7dd3fc;
      --mzr-sel-bg:       rgba(125,211,252,.3);
      --mzr-sel-fg:       #0a0f1f;
      --mzr-focus-ring:   #93c5fd;
    }
  }
  @media (prefers-color-scheme: light) {
    :root {
      --mzr-caret-accent: #0ea5e9;
      --mzr-sel-bg:       rgba(14,165,233,.25);
      --mzr-sel-fg:       #0b1020;
      --mzr-focus-ring:   #3b82f6;
    }
  }
  input[type="text"],
  input[type="search"],
  input[type="url"],
  input[type="email"],
  input[type="tel"],
  input[type="password"],
  textarea,
  [contenteditable=""],
  [contenteditable="true"] {
    caret-color: var(--mzr-caret-accent) !important;
  }

  ::selection {
    background: var(--mzr-sel-bg) !important;
    color: var(--mzr-sel-fg) !important;
  }
  ::-moz-selection {
    background: var(--mzr-sel-bg) !important;
    color: var(--mzr-sel-fg) !important;
  }

  input[type="text"]:focus-visible,
  input[type="search"]:focus-visible,
  input[type="url"]:focus-visible,
  input[type="email"]:focus-visible,
  input[type="tel"]:focus-visible,
  input[type="password"]:focus-visible,
  textarea:focus-visible,
  [contenteditable=""]:focus-visible,
  [contenteditable="true"]:focus-visible {
    outline: 2px solid var(--mzr-focus-ring) !important;
    outline-offset: 2px !important;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--mzr-focus-ring) 35%, transparent) !important;
  }
`;

const FALLBACK_APP_INFO: AppInfo = {
  name: 'Merezhyvo',
  version: '0.0.0',
  description: '',
  chromium: '',
  electron: '',
  node: ''
};

const parseStartUrl = (): StartParams => {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('start');
    const singleParam = params.get('single');

    let url = DEFAULT_URL;
    let hasStartParam = false;
    if (raw) {
      try {
        url = decodeURIComponent(raw);
      } catch {
        url = raw;
      }
      hasStartParam = true;
    }

    const single = typeof singleParam === 'string'
      ? singleParam === '' || singleParam === '1' || singleParam.toLowerCase() === 'true'
      : false;

    return { url, hasStartParam, single };
  } catch {
    return { url: DEFAULT_URL, hasStartParam: false, single: false };
  }
};

const normalizeAddress = (value: string): string => {
  if (!value || !value.trim()) return DEFAULT_URL;
  const trimmed = value.trim();

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) return trimmed; // already includes a scheme
  if (trimmed.includes(' ')) return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  if (!trimmed.includes('.') && trimmed.toLowerCase() !== 'localhost') {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
  try {
    const candidate = new URL(`https://${trimmed}`);
    return candidate.href;
  } catch {
    return `https://duckduckgo.com/?q=${encodeURIComponent(trimmed)}`;
  }
};

const normalizeShortcutUrl = (value: string): string | null => {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return null;
    }
    const lowerHref = parsed.href.toLowerCase();
    if (lowerHref === 'https://mail.google.com' || lowerHref.startsWith('https://mail.google.com/')) {
      return 'https://mail.google.com';
    }
    return parsed.href;
  } catch {
    return null;
  }
};

const MainBrowserApp: React.FC<MainBrowserAppProps> = ({ initialUrl, mode, hasStartParam }) => {
  const webviewHandleRef = useRef<WebViewHandle | null>(null);
  const webviewRef = useRef<WebviewTag | null>(null);
  const [activeViewRevision, setActiveViewRevision] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const modalTitleInputRef = useRef<HTMLInputElement | null>(null);
  const modalUrlInputRef = useRef<HTMLInputElement | null>(null);
  const torContainerInputRef = useRef<HTMLInputElement | null>(null);
  const activeInputRef = useRef<ActiveInputTarget>(null);
  const webviewReadyRef = useRef<boolean>(false);

  const { ready: tabsReady, tabs, activeId, activeTab } = useTabsStore();
  const tabCount = tabs.length;

  const [inputValue, setInputValue] = useState<string>(initialUrl);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const isEditingRef = useRef<boolean>(false);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [status, setStatus] = useState<StatusState>('loading');
  const [webviewReady, setWebviewReady] = useState<boolean>(false);

  const [showModal, setShowModal] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [shortcutUrl, setShortcutUrl] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [msg, setMsg] = useState<string>('');
  const [showTabsPanel, setShowTabsPanel] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [installedAppsLoading, setInstalledAppsLoading] = useState<boolean>(false);
  const [settingsMsg, setSettingsMsg] = useState<string>('');
  const [pendingRemoval, setPendingRemoval] = useState<InstalledApp | null>(null);
  const [settingsBusy, setSettingsBusy] = useState<boolean>(false);
  const [shortcutCompleted, setShortcutCompleted] = useState<boolean>(false);
  const [shortcutSuccessMsg, setShortcutSuccessMsg] = useState<string>('');
  const [torEnabled, setTorEnabled] = useState<boolean>(false);
  const [torContainerId, setTorContainerId] = useState<string>('');
  const [torContainerDraft, setTorContainerDraft] = useState<string>('');
  const [torConfigSaving, setTorConfigSaving] = useState<boolean>(false);
  const [torConfigFeedback, setTorConfigFeedback] = useState<string>('');
  const [torIp, setTorIp] = useState<string>('');
  const [torIpLoading, setTorIpLoading] = useState<boolean>(false);
  const [torAlertMessage, setTorAlertMessage] = useState<string>('');
  const [kbVisible, setKbVisible] = useState<boolean>(false);
  const [enabledKbLayouts, setEnabledKbLayouts] = useState<LayoutId[]>(['en']);
  const [kbLayout, setKbLayout] = useState<LayoutId>('en');
  const [mainViewMode, setMainViewMode] = useState<'browser' | 'messenger'>('browser');
  const [messengerSettingsState, setMessengerSettingsState] = useState<MessengerSettings>(() => sanitizeMessengerSettings(null));
  const messengerSettingsRef = useRef<MessengerSettings>(messengerSettingsState);
  const messengerTabIdsRef = useRef<Map<MessengerId, string>>(new Map());
  const prevBrowserTabIdRef = useRef<string | null>(null);
  const pendingMessengerTabIdRef = useRef<string | null>(null);
  const lastMessengerIdRef = useRef<MessengerId | null>(null);
  const [activeMessengerId, setActiveMessengerId] = useState<MessengerId | null>(null);
  const [messengerOrderSaving, setMessengerOrderSaving] = useState<boolean>(false);
  const [messengerOrderMessage, setMessengerOrderMessage] = useState<string>('');

  const FOCUS_CONSOLE_ACTIVE = '__MZR_OSK_FOCUS_ON__';
  const FOCUS_CONSOLE_INACTIVE = '__MZR_OSK_FOCUS_OFF__';
  const oskPressGuardRef = useRef(false);

  const prevAlphaLayoutRef = React.useRef(kbLayout);

  useEffect(() => {
    if (kbLayout !== 'symbols1' && kbLayout !== 'symbols2') prevAlphaLayoutRef.current = kbLayout;
  }, [kbLayout]);

  useEffect(() => {
    messengerSettingsRef.current = messengerSettingsState;
  }, [messengerSettingsState]);

  const availableLayouts = useMemo(
    () => new Set<LayoutId>(LANGUAGE_LAYOUT_IDS as LayoutId[]),
    []
  );

  const toLayoutIds = useCallback((arr: unknown): LayoutId[] => {
    if (!Array.isArray(arr)) return ['en' as LayoutId];
    const filtered = arr.filter(
      (x): x is LayoutId => typeof x === 'string' && availableLayouts.has(x as LayoutId)
    );
    return filtered.length ? filtered : (['en'] as LayoutId[]);
  }, [availableLayouts]);

  const pickDefault = useCallback((def: unknown, enabled: LayoutId[]): LayoutId => {
    if (
      typeof def === 'string' &&
      availableLayouts.has(def as LayoutId) &&
      enabled.includes(def as LayoutId)
    ) {
      return def as LayoutId;
    }
    return (enabled[0] ?? ('en' as LayoutId));
  }, [availableLayouts]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const kb = await ipc.settings.keyboard.get();
        if (!alive) return;

        const enabled = toLayoutIds(kb?.enabledLayouts);
        const def = pickDefault(kb?.defaultLayout, enabled);

        setEnabledKbLayouts(enabled);
        setKbLayout(def);
      } catch {
        // keep defaults on failure
      }
    })();
    return () => { alive = false; };
  }, [pickDefault, setEnabledKbLayouts, setKbLayout, toLayoutIds]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const messengerSettings = await ipc.settings.messenger.get();
        if (!messengerSettings || cancelled) return;
        setMessengerSettingsState(messengerSettings);
      } catch {
        if (!cancelled) {
          setMessengerSettingsState(sanitizeMessengerSettings(null));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setMessengerSettingsState, setMessengerOrderSaving, setMessengerOrderMessage]);

  useEffect(() => {
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      const enabled = toLayoutIds(detail?.enabledLayouts);
      const def = pickDefault(detail?.defaultLayout, enabled);
      setEnabledKbLayouts(enabled);
      setKbLayout(def);
    };

    window.addEventListener('mzr-osk-settings-changed', onChanged as EventListener);
    return () => window.removeEventListener('mzr-osk-settings-changed', onChanged as EventListener);
  }, [pickDefault, setEnabledKbLayouts, setKbLayout, toLayoutIds]);

  const loadInstalledApps = useCallback(async ({ quiet = false }: LoadInstalledAppsOptions = {}) => {
    if (!quiet) {
      setSettingsMsg('');
      setPendingRemoval(null);
    }
    setInstalledAppsLoading(true);
    try {
      const result = await ipc.settings.loadInstalledApps();
      if (result?.ok && Array.isArray(result.installedApps)) {
        setInstalledApps(result.installedApps);
      } else if (!quiet) {
        setSettingsMsg(result?.error || 'Failed to load installed apps.');
      }
      return result;
    } catch (err) {
      if (!quiet) {
        setSettingsMsg(String(err));
      }
      return null;
    } finally {
      setInstalledAppsLoading(false);
    }
  }, []);

  const installedAppsList = useMemo<InstalledApp[]>(() => {
    const list = Array.isArray(installedApps) ? [...installedApps] : [];
    list.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
    return list;
  }, [installedApps]);

  const appInfo = useMemo<AppInfo>(() => {
    if (typeof window === 'undefined') return FALLBACK_APP_INFO;
    const info = window.merezhyvo?.appInfo as Partial<AppInfo> | undefined;
    return {
      name: info?.name ?? FALLBACK_APP_INFO.name,
      version: info?.version ?? FALLBACK_APP_INFO.version,
      description: info?.description ?? FALLBACK_APP_INFO.description,
      chromium: info?.chromium ?? FALLBACK_APP_INFO.chromium,
      electron: info?.electron ?? FALLBACK_APP_INFO.electron,
      node: info?.node ?? FALLBACK_APP_INFO.node
    };
  }, []);

  const tabsReadyRef = useRef<boolean>(tabsReady);
  const tabsRef = useRef<Tab[]>(tabs);
  const previousActiveTabRef = useRef<Tab | null>(activeTab ?? null);
  const webviewHostRef = useRef<HTMLDivElement | null>(null);
  const backgroundHostRef = useRef<HTMLDivElement | null>(null);
  const tabViewsRef = useRef<Map<string, TabViewEntry>>(new Map());
  const backgroundTabRef = useRef<string | null>(null);
  const [isHtmlFullscreen, setIsHtmlFullscreen] = useState<boolean>(false);
  const fullscreenTabRef = useRef<string | null>(null);
  const powerBlockerIdRef = useRef<number | null>(null);
  const playingTabsRef = useRef<Set<string>>(new Set());

  const startUrlAppliedRef = useRef<boolean>(false);
  const activeIdRef = useRef<string | null>(activeId);
  const activeTabRef = useRef<Tab | null>(activeTab ?? null);
  const lastLoadedRef = useRef<LastLoadedInfo>({ id: null, url: null });
  const torIpRequestRef = useRef<number>(0);

  const pinnedTabs = useMemo(() => tabs.filter((tab) => tab.pinned), [tabs]);
  const regularTabs = useMemo(() => tabs.filter((tab) => !tab.pinned), [tabs]);
  const activeTabIsLoading = !!activeTab?.isLoading;
  const activeUrl = (activeTab?.url && activeTab.url.trim()) ? activeTab.url : DEFAULT_URL;
  const orderedMessengers = useMemo(
    () => resolveOrderedMessengers(messengerSettingsState),
    [messengerSettingsState]
  );

  const {
    newTab: newTabAction,
    closeTab: closeTabAction,
    activateTab: activateTabAction,
    pinTab: pinTabAction,
    navigateActive: navigateActiveAction,
    reloadActive: reloadActiveAction,
    updateMeta: updateMetaAction
  } = tabsActions;

  const ensureMessengerTab = useCallback((definition: MessengerDefinition): string | null => {
    const map = messengerTabIdsRef.current;
    const existingId = map.get(definition.id);
    if (existingId) {
      const currentState = getTabsState();
      if (currentState.tabs.some((tab) => tab.id === existingId)) {
        return existingId;
      }
      map.delete(definition.id);
    }
    newTabAction(definition.url, { title: definition.title, kind: 'messenger' });
    const nextState = getTabsState();
    const createdId = nextState.activeId || null;
    if (createdId) {
      map.set(definition.id, createdId);
      updateMetaAction(createdId, { title: definition.title, url: definition.url });
    }
    return createdId;
  }, [newTabAction, updateMetaAction]);
  
  useEffect(() => {
    ipc.notifyTabsReady();
  }, []);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { tabsReadyRef.current = tabsReady; }, [tabsReady]);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);
  useEffect(() => { previousActiveTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => {
    if (fullscreenTabRef.current && fullscreenTabRef.current !== activeId) {
      fullscreenTabRef.current = null;
      setIsHtmlFullscreen(false);
    }
  }, [activeId]);
  useEffect(() => {
    loadInstalledApps({ quiet: true });
  }, [loadInstalledApps]);

  const showTorAlert = useCallback((message: string) => {
    setTorAlertMessage(message);
  }, []);

  const dismissTorAlert = useCallback(() => {
    setTorAlertMessage('');
  }, []);
  useEffect(() => {
    let cancelled = false;
    const loadSettingsState = async () => {
      try {
        const state = await ipc.settings.loadState();
        if (!state || cancelled) return;
        const containerId = state.tor?.containerId ? state.tor.containerId : '';
        setTorContainerId(containerId);
        setTorContainerDraft(containerId);
      } catch {
        if (!cancelled) {
          setTorContainerId('');
        }
      }
    };
    loadSettingsState();
    return () => {
      cancelled = true;
    };
  }, []);

  const getActiveWebview: GetWebview = useCallback((): WebviewTag | null => {
    const handle = webviewHandleRef.current;
    if (handle && typeof handle.getWebView === 'function') {
      const element = handle.getWebView();
      if (element) return element;
    }
    return webviewRef.current ?? null;
  }, []);

  const {
    injectTextToWeb,
    injectBackspaceToWeb,
    injectEnterToWeb,
    injectArrowToWeb,
    isActiveMultiline,
    ensureSelectionCssInjected,
    hasSelection,
    getSelectionRect,
    clearSelection,
    getSelectionTouchState,
    pollMenuRequest,
  } = React.useMemo(() => makeWebInjects(getActiveWebview), [getActiveWebview]);

  const {
    injectTextToMain,
    injectBackspaceToMain,
    injectEnterToMain,
    injectArrowToMain,
  } = React.useMemo(() => makeMainInjects(), []);

  useEffect(() => {
  let cancelled = false;
  let prevShown = false;

  const tick = async () => {
    if (cancelled) return;

    try {
      const [has, touchState] = await Promise.all([
        hasSelection(),
        getSelectionTouchState(),
      ]);

      if (!has) { prevShown = false; return; }

      // Don't show menu while user is still touching/dragging selection handles
      if (touchState.touching) { prevShown = false; return; }

      const now = Date.now();
      // Wait a short grace period after touchend so handles settle visually
      if (now - touchState.lastTouchTs < 250) { return; }

      // First long-press to create selection (skip showing menu)
      if (!prevShown) {
        prevShown = true;
        return;
      }

      const req = await pollMenuRequest();
      if (!req) return;

      const wv = getActiveWebview();
      if (!wv) return;
      const url = await wv.getURL();
      if (isCtxtExcludedSite(url)) {
        return;
      }

      const hostRect = wv.getBoundingClientRect();
      const cx = Math.round(hostRect.left + req.x);
      const cy = Math.round(hostRect.top + req.y);

      window.merezhyvo?.openContextMenuAt(cx, cy, window.devicePixelRatio || 1);
    } catch {
      // ignore transient errors
    }
  };

  const id = window.setInterval(() => { void tick(); }, 80);
  return () => { cancelled = true; window.clearInterval(id); };
}, [
  ensureSelectionCssInjected,
  hasSelection,
  getSelectionRect,
  getSelectionTouchState,
  pollMenuRequest,
  getActiveWebview,
]);

  const isEditableMainNow = React.useCallback(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    if (el.closest?.('[data-soft-keyboard="true"]')) return false;
    if ((el as any).isContentEditable) return true;
    if (el.tagName === 'TEXTAREA') return !(el as HTMLTextAreaElement).readOnly && !(el as HTMLTextAreaElement).disabled;
    if (el.tagName === 'INPUT') {
      const input = el as HTMLInputElement;
      const type = (input.getAttribute('type') || 'text').toLowerCase();
      const nonText = new Set(['button','submit','reset','checkbox','radio','range','color','file','image','hidden']);
      if (nonText.has(type)) return false;
      return !input.readOnly && !input.disabled;
    }
    return false;
  }, []);

  const onEnterShouldClose = useCallback(async (): Promise<boolean> => {
    // Step 1: check input inside the main window
    const el = document.activeElement as HTMLElement | null;
    if (el) {
      const tag = (el.tagName || '').toLowerCase();
      const isMultiMain = el.isContentEditable || tag === 'textarea';
      if (isMultiMain) return false;
    }

    // Step 2: ask the webview injector if the field is multiline
    try {
      const isMulti = await isActiveMultiline?.();
      if (typeof isMulti === 'boolean') return !isMulti;
    } catch {}

    // Step 3: default behaviour is to close the keyboard
    return true;
  }, [isActiveMultiline]);

  const closeKeyboard = useCallback(() => setKbVisible(false), []);

  const injectText = React.useCallback(async (text: string) => {
    if (isEditableMainNow()) { injectTextToMain(text); return; }
    if (await probeWebEditable(getActiveWebview)) { await injectTextToWeb(text); return; }
  }, [getActiveWebview, injectTextToMain, injectTextToWeb, isEditableMainNow]);

  const injectBackspace = React.useCallback(async () => {
    if (isEditableMainNow()) { injectBackspaceToMain(); return; }
    if (await probeWebEditable(getActiveWebview)) { await injectBackspaceToWeb(); return; }
  }, [getActiveWebview, injectBackspaceToMain, injectBackspaceToWeb, isEditableMainNow]);

  const injectEnter = React.useCallback(async () => {
    if (isEditableMainNow()) { injectEnterToMain(); return; }
    if (await probeWebEditable(getActiveWebview)) { await injectEnterToWeb(); return; }
  }, [getActiveWebview, injectEnterToMain, injectEnterToWeb, isEditableMainNow]);

  const injectArrow = React.useCallback(async (dir: KeyboardDirection) => {
    if (isEditableMainNow()) { injectArrowToMain(dir); return; }
    if (await probeWebEditable(getActiveWebview)) { await injectArrowToWeb(dir); return; }
  }, [getActiveWebview, injectArrowToMain, injectArrowToWeb, isEditableMainNow]);

  const getActiveWebviewHandle = useCallback((): WebViewHandle | null => webviewHandleRef.current, []);

  const startPowerBlocker = useCallback(async (): Promise<number | null> => {
    if (powerBlockerIdRef.current != null) return powerBlockerIdRef.current;
    try {
      const id = await ipc.power.start();
      if (typeof id === 'number') {
        powerBlockerIdRef.current = id;
        return id;
      }
    } catch (err) {
      console.error('[Merezhyvo] power blocker start failed', err);
    }
    return null;
  }, []);

  const stopPowerBlocker = useCallback(async (): Promise<void> => {
    const id = powerBlockerIdRef.current;
    if (id == null) return;
    try {
      await ipc.power.stop(id);
    } catch (err) {
      console.error('[Merezhyvo] power blocker stop failed', err);
    }
    powerBlockerIdRef.current = null;
  }, []);

  const refreshTorIp = useCallback(async (): Promise<void> => {
    const requestId = Date.now();
    torIpRequestRef.current = requestId;
    setTorIpLoading(true);
    try {
      const response = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch IP');
      const data = (await response.json().catch(() => ({}))) as { ip?: string };
      if (torIpRequestRef.current === requestId) {
        const ip = typeof data.ip === 'string' ? data.ip : '';
        setTorIp(ip);
      }
    } catch {
      if (torIpRequestRef.current === requestId) {
        setTorIp('');
      }
    } finally {
      if (torIpRequestRef.current === requestId) {
        setTorIpLoading(false);
      }
    }
  }, []);


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
  }, []);

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
  }, []);

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

  const updatePowerBlocker = useCallback(() => {
    if (playingTabsRef.current.size > 0) {
      void startPowerBlocker();
    } else {
      void stopPowerBlocker();
    }
  }, [startPowerBlocker, stopPowerBlocker]);

  const destroyTabView = useCallback((tabId: string, { keepMeta = false }: DestroyTabOptions = {}) => {
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
      updateMetaAction(tabId, { isPlaying: false, discarded: true });
    }
    if (backgroundTabRef.current === tabId) {
      backgroundTabRef.current = null;
    }
    if (fullscreenTabRef.current === tabId) {
      fullscreenTabRef.current = null;
      setIsHtmlFullscreen(false);
    }
  }, [setActiveViewRevision, updateMetaAction, updatePowerBlocker]);

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

  const refreshNavigationState = useCallback(() => {
    const handle = webviewHandleRef.current;
    const view = (handle && typeof handle.getWebView === 'function')
      ? handle.getWebView()
      : webviewRef.current;
    if (!view) {
      setCanGoBack(false);
      setCanGoForward(false);
      return;
    }
    try {
      setCanGoBack(view.canGoBack());
      setCanGoForward(view.canGoForward());
    } catch {
      setCanGoBack(false);
      setCanGoForward(false);
    }
  }, []);

  const attachWebviewListeners = useCallback((view: WebviewTag, tabId: string) => {
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
      updateMetaAction(tabId, { isPlaying: true, discarded: false });
    };

    const handleMediaPaused = () => {
      playingTabsRef.current.delete(tabId);
      updatePowerBlocker();
      updateMetaAction(tabId, { isPlaying: false });
      if (backgroundTabRef.current === tabId) {
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

    const injectBaseCss = () => {
      try {
        const maybe = view.insertCSS(WEBVIEW_BASE_CSS);
        if (maybe && typeof maybe.catch === 'function') {
          maybe.catch(() => {});
        }
      } catch {}
    };

    injectBaseCss();
    view.addEventListener('dom-ready', injectBaseCss);
    view.addEventListener('did-navigate', injectBaseCss);
    view.addEventListener('did-navigate-in-page', injectBaseCss);

    view.addEventListener('page-title-updated', handleTitle);
    view.addEventListener('page-favicon-updated', handleFavicon);
    view.addEventListener('media-started-playing', handleMediaStarted);
    view.addEventListener('media-paused', handleMediaPaused);
    view.addEventListener('enter-html-full-screen', handleEnterFullscreen);
    view.addEventListener('leave-html-full-screen', handleLeaveFullscreen);

    injectBaseCss();

    return () => {
      view.removeEventListener('page-title-updated', handleTitle);
      view.removeEventListener('page-favicon-updated', handleFavicon);
      view.removeEventListener('media-started-playing', handleMediaStarted);
      view.removeEventListener('media-paused', handleMediaPaused);
      view.removeEventListener('enter-html-full-screen', handleEnterFullscreen);
      view.removeEventListener('leave-html-full-screen', handleLeaveFullscreen);
      view.removeEventListener('dom-ready', injectBaseCss);
      view.removeEventListener('did-navigate', injectBaseCss);
      view.removeEventListener('did-navigate-in-page', injectBaseCss);
    };
  }, [destroyTabView, updateMetaAction, updatePowerBlocker]);

  const handleHostCanGo = useCallback((tabId: string, state?: NavigationState | null) => {
    if (activeIdRef.current !== tabId) return;
    setCanGoBack(!!state?.back);
    setCanGoForward(!!state?.forward);
  }, []);

  const handleHostStatus = useCallback((tabId: string, nextStatus: StatusState) => {
    updateMetaAction(tabId, { isLoading: nextStatus === 'loading' });
    if (activeIdRef.current !== tabId) return;
    setStatus(nextStatus);
    if (nextStatus === 'loading') {
      webviewReadyRef.current = false;
      setWebviewReady(false);
    } else if (nextStatus === 'ready') {
      webviewReadyRef.current = true;
      setWebviewReady(true);
      refreshNavigationState();
    } else if (nextStatus === 'error') {
      webviewReadyRef.current = false;
      setWebviewReady(false);
    }
  }, [refreshNavigationState, updateMetaAction]);

  const handleHostUrlChange = useCallback((tabId: string, nextUrl: string) => {
    if (!nextUrl) return;
    const cleanUrl = nextUrl.trim();
    updateMetaAction(tabId, {
      url: cleanUrl,
      discarded: false,
      lastUsedAt: Date.now()
    });
    if (activeIdRef.current === tabId && !isEditingRef.current) {
      setInputValue(cleanUrl);
      lastLoadedRef.current = { id: tabId, url: cleanUrl };
    }
  }, [updateMetaAction]);

  const handleHostDomReady = useCallback((tabId: string) => {
    const entry = tabViewsRef.current.get(tabId);
    const view = entry?.view;
    if (!view) return;
    if (activeIdRef.current === tabId) {
      try { view.focus(); } catch {}
    }
  }, []);
  const zoomRef = useRef(mode === 'mobile' ? 1.8 : 1.0);
  const [zoomLevel, setZoomLevel] = useState(zoomRef.current);

  const setZoomClamped = useCallback((val: number | string) => {
    const numeric = Number(val);
    if (!Number.isFinite(numeric)) return;
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, numeric));
    const rounded = Math.round(clamped * 100) / 100;
    const view = getActiveWebview();
    if (view) {
      try {
        if (typeof view.setZoomFactor === 'function') {
          view.setZoomFactor(rounded);
        } else {
          view.executeJavaScript(`require('electron').webFrame.setZoomFactor(${rounded})`).catch(() => {});
        }
      } catch {}
    }
    zoomRef.current = rounded;
    setZoomLevel(rounded);
  }, [getActiveWebview]);

  useEffect(() => {
    const base = mode === 'mobile' ? 2.3 : 1.0;
    if (Math.abs(zoomRef.current - base) < 1e-3) return;
    const frame = requestAnimationFrame(() => {
      setZoomClamped(base);
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, setZoomClamped]);

  const applyZoomPolicy = useCallback(() => {
    const view = getActiveWebview();
    if (!view) return;
    try {
      if (typeof view.setVisualZoomLevelLimits === 'function') {
        view.setVisualZoomLevelLimits(1, 3);
      }
      setZoomClamped(zoomRef.current);
    } catch {}
  }, [getActiveWebview, setZoomClamped]);

  useEffect(() => {
    const view = getActiveWebview();
    if (!view) return;

    const onReady = () => applyZoomPolicy();
    const onNavigate = () => applyZoomPolicy();
    const onZoomChanged = () => {
      const raw = typeof view.getZoomFactor === 'function' ? view.getZoomFactor() : undefined;
      if (typeof raw !== 'number' || Number.isNaN(raw)) return;
      const normalized = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, raw)) * 100) / 100;
      zoomRef.current = normalized;
      setZoomLevel(normalized);
    };

    view.addEventListener('dom-ready', onReady);
    view.addEventListener('did-frame-finish-load', onReady);
    view.addEventListener('did-navigate', onNavigate);
    view.addEventListener('did-navigate-in-page', onNavigate);
    view.addEventListener('zoom-changed', onZoomChanged);

    onReady();

    return () => {
      view.removeEventListener('dom-ready', onReady);
      view.removeEventListener('did-frame-finish-load', onReady);
      view.removeEventListener('did-navigate', onNavigate);
      view.removeEventListener('did-navigate-in-page', onNavigate);
      view.removeEventListener('zoom-changed', onZoomChanged);
    };
  }, [activeId, activeViewRevision, applyZoomPolicy, getActiveWebview, webviewReady]);

  const handleZoomSliderChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { valueAsNumber, value } = event.target;
    const candidate = Number.isFinite(valueAsNumber) ? valueAsNumber : Number(value);
    setZoomClamped(candidate);
  }, [setZoomClamped]);

  useEffect(() => {
    for (const entry of tabViewsRef.current.values()) {
      try {
        entry.render?.(mode, zoomRef.current);
      } catch {}
    }
  }, [mode, zoomLevel]);

  const ensureHostReady = useCallback((): boolean => {
    return webviewHostRef.current != null;
  }, []);

  const createWebviewForTab = useCallback(
    (tab: Tab, { zoom: zoomFactor, mode: currentMode }: CreateWebviewOptions): WebviewTag | null => {
    if (!ensureHostReady()) return null;
    const host = webviewHostRef.current;
    if (!host) {
      return null;
    }
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.inset = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.backgroundColor = '#05070f';
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
        if (viewChanged) {
          setActiveViewRevision((rev) => rev + 1);
        }
      }
    };
    entry.render = (modeOverride: Mode = currentMode, zoomOverride: number = zoomFactor) => {
      const initialUrl = (tab.url && tab.url.trim()) ? tab.url.trim() : DEFAULT_URL;
      root.render(
        <WebViewHost
          ref={refCallback}
          initialUrl={initialUrl}
          mode={modeOverride}
          zoom={zoomOverride}
          onCanGo={(state) => handleHostCanGo(tab.id, state)}
          onStatus={(nextStatus) => handleHostStatus(tab.id, nextStatus)}
          onUrlChange={(url) => handleHostUrlChange(tab.id, url)}
          onDomReady={() => handleHostDomReady(tab.id)}
          style={{ width: '100%', height: '100%' }}
        />
      );
    };
    tabViewsRef.current.set(tab.id, entry);
    entry.render();
    return entry.view;
  }, [
    attachWebviewListeners,
    ensureHostReady,
    handleHostCanGo,
    handleHostDomReady,
    handleHostStatus,
    handleHostUrlChange,
    installShadowStyles,
    setActiveViewRevision
  ]);

  const loadUrlIntoView = useCallback((tab: Tab, entry?: TabViewEntry | null) => {
    if (!entry) return;
    const targetUrl = (tab.url && tab.url.trim()) ? tab.url.trim() : DEFAULT_URL;
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
  }, [updateMetaAction]);

  const activateTabView = useCallback((tab: Tab | null) => {
    if (!tab) return;
    updateMetaAction(tab.id, { discarded: false });
    let entry = tabViewsRef.current.get(tab.id);
    if (!entry) {
      const created = createWebviewForTab(tab, { zoom: zoomRef.current, mode });
      if (!created) {
        requestAnimationFrame(() => activateTabView(tab));
        return;
      }
      entry = tabViewsRef.current.get(tab.id);
    } else {
      entry.render?.(mode, zoomRef.current);
    }
    if (!entry) return;

    entry.isBackground = false;
    if (backgroundTabRef.current === tab.id) {
      backgroundTabRef.current = null;
    }
    const container = entry.container;
    const view = entry.view;
    if (!container || !view) {
      requestAnimationFrame(() => activateTabView(tab));
      return;
    }
    const host = webviewHostRef.current;
    if (host && container.parentElement !== host) {
      try { host.appendChild(container); } catch {}
    }
    applyActiveStyles(container, view);
    webviewHandleRef.current = entry.handle;
    webviewRef.current = view;
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
  }, [
    applyActiveStyles,
    createWebviewForTab,
    loadUrlIntoView,
    mode,
    refreshNavigationState,
    setActiveViewRevision,
    updateMetaAction
  ]);

  const demoteTabView = useCallback((tab: Tab | null) => {
    if (!tab) return;
    const entry = tabViewsRef.current.get(tab.id);
    if (!entry) return;
    if (tab.isYouTube && tab.isPlaying) {
      if (backgroundTabRef.current && backgroundTabRef.current !== tab.id) {
        const previousId = backgroundTabRef.current;
        updateMetaAction(previousId, { isPlaying: false });
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
  }, [destroyTabView, mountInBackgroundHost, updateMetaAction]);

  useEffect(() => {
    const off = ipc.onOpenUrl((arg) => {
      const { url } =
        typeof arg === 'string' ? { url: arg } : (arg || {});
      if (!url) return;
      newTabAction(String(url));
    });
    return () => {
      if (typeof off === 'function') {
        try {
          off();
        } catch {}
      }
    };
  }, [newTabAction]);

  useEffect(() => {
    const validIds = new Set(tabs.map((tab) => tab.id));
    for (const tabId of Array.from(tabViewsRef.current.keys())) {
      if (!validIds.has(tabId)) {
        destroyTabView(tabId, { keepMeta: true });
      }
    }
  }, [destroyTabView, tabs]);

  useEffect(() => {
    if (!tabsReady) return;
    if (isEditingRef.current) return;
    setInputValue(activeUrl);
  }, [tabsReady, activeUrl]);

  useEffect(() => {
    if (!tabsReady || !hasStartParam) return;
    if (startUrlAppliedRef.current) return;
    startUrlAppliedRef.current = true;
    const trimmed = (initialUrl || '').trim();
    if (!trimmed) return;
    navigateActiveAction(trimmed);
  }, [tabsReady, hasStartParam, initialUrl, navigateActiveAction]);

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
  }, [activateTabView, activeTab, demoteTabView, tabsReady]);

  useEffect(() => () => {
    for (const tabId of Array.from(tabViewsRef.current.keys())) {
      destroyTabView(tabId, { keepMeta: true });
    }
  }, [destroyTabView]);

  const hostnameFromUrl = useCallback((value: string | null | undefined) => {
    if (!value) return '';
    try {
      return new URL(value).hostname.replace(/^www\./, '');
    } catch {
      return String(value || '');
    }
  }, []);

  const displayTitleForTab = useCallback((tab: Tab | null | undefined) => {
    if (!tab) return 'New Tab';
    const title = (tab.title || '').trim();
    if (title) return title;
    const host = hostnameFromUrl(tab.url);
    return host || 'New Tab';
  }, [hostnameFromUrl]);

  const displaySubtitleForTab = useCallback((tab: Tab | null | undefined) => {
    if (!tab) return '';
    const host = hostnameFromUrl(tab.url);
    if (host) return host;
    const url = (tab.url || '').trim();
    return url && url !== DEFAULT_URL ? url : '';
  }, [hostnameFromUrl]);

  const fallbackInitialForTab = useCallback((tab: Tab | null | undefined) => {
    const label = displayTitleForTab(tab);
    const first = label.trim().charAt(0);
    return first ? first.toUpperCase() : '•';
  }, [displayTitleForTab]);

  const isEditableElement = useCallback((element: Element | null) => {
    if (!element) return false;
    if (element === inputRef.current) return true;
    return windowHelpers.isEditableElement(element);
  }, [inputRef]);

  const blurActiveInWebview = useCallback(() => {
    const wv = getActiveWebview();
    if (!wv) return;
    const js = `
      (function(){
        try {
          const el = document.activeElement;
          if (el && typeof el.blur === 'function') el.blur();
        } catch {}
      })();
    `;
    try {
      const result = wv.executeJavaScript(js, false);
      if (result && typeof result.then === 'function') {
        result.catch(() => {});
      }
    } catch {}
  }, [getActiveWebview]);

  const resetEditingState = useCallback(() => {
    setIsEditing(false);
    isEditingRef.current = false;
    activeInputRef.current = null;
    try {
      inputRef.current?.blur?.();
    } catch {}
  }, []);

  const exitMessengerMode = useCallback(() => {
    if (mainViewMode !== 'messenger') return;
    const idsToClose = Array.from(messengerTabIdsRef.current.values());
    messengerTabIdsRef.current.clear();
    pendingMessengerTabIdRef.current = null;
    setMainViewMode('browser');
    setActiveMessengerId(null);
    void ipc.ua.setMode('auto');
    const previousId = prevBrowserTabIdRef.current;
    prevBrowserTabIdRef.current = null;
    if (idsToClose.length) {
      for (const tabId of idsToClose) {
        closeTabAction(tabId);
      }
    }
    if (previousId) {
      const state = getTabsState();
      if (state.tabs.some((tab) => tab.id === previousId)) {
        activateTabAction(previousId);
      }
    }
    resetEditingState();
  }, [activateTabAction, closeTabAction, mainViewMode, resetEditingState]);

  const activateMessenger = useCallback((definition: MessengerDefinition) => {
    resetEditingState();
    blurActiveInWebview();
    const tabId = ensureMessengerTab(definition);
    if (!tabId) return;
    pendingMessengerTabIdRef.current = tabId;
    if (activeIdRef.current !== tabId) {
      activateTabAction(tabId);
    }
    setMainViewMode('messenger');
    setActiveMessengerId(definition.id);
    lastMessengerIdRef.current = definition.id;
    void ipc.ua.setMode('desktop');
    setInputValue(definition.url);
  }, [activateTabAction, blurActiveInWebview, ensureMessengerTab, resetEditingState, setInputValue]);

  const handleEnterMessengerMode = useCallback(() => {
    if (!orderedMessengers.length) return;
    if (mainViewMode !== 'messenger') {
      prevBrowserTabIdRef.current = activeIdRef.current;
    }
    const fallback = orderedMessengers[0];
    if (!fallback) return;
    const lastId = lastMessengerIdRef.current;
    const preferredId = lastId && orderedMessengers.some((item) => item.id === lastId)
      ? lastId
      : fallback.id;
    const target = orderedMessengers.find((item) => item.id === preferredId) ?? fallback;
    activateMessenger(target);
  }, [activateMessenger, mainViewMode, orderedMessengers]);

  const handleMessengerSelect = useCallback((messengerId: MessengerId) => {
    const target = orderedMessengers.find((item) => item.id === messengerId);
    if (!target) return;
    if (mainViewMode !== 'messenger') {
      prevBrowserTabIdRef.current = activeIdRef.current;
    }
    if (activeMessengerId === messengerId && mainViewMode === 'messenger') return;
    activateMessenger(target);
  }, [activateMessenger, activeMessengerId, mainViewMode, orderedMessengers]);

  const handleMessengerMove = useCallback(async (messengerId: MessengerId, direction: 'up' | 'down') => {
    const currentSettings = messengerSettingsRef.current;
    const currentOrder = Array.isArray(currentSettings?.order) ? currentSettings.order.slice() : [];
    const index = currentOrder.indexOf(messengerId);
    if (index === -1) return;
    const offset = direction === 'up' ? -1 : 1;
    const targetIndex = index + offset;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

    const previousOrder = currentOrder.slice();
    const nextOrder = currentOrder.slice();
    const [moved] = nextOrder.splice(index, 1);
    if (!moved) return;
    nextOrder.splice(targetIndex, 0, moved);

    messengerSettingsRef.current = { order: nextOrder };
    setMessengerSettingsState({ order: nextOrder });
    setMessengerOrderSaving(true);
    setMessengerOrderMessage('');

    try {
      const saved = await ipc.settings.messenger.update(nextOrder);
      if (saved && Array.isArray(saved.order)) {
        messengerSettingsRef.current = saved;
        setMessengerSettingsState(saved);
        setMessengerOrderMessage('Messenger order saved');
      } else {
        setMessengerOrderMessage('Unable to save messenger order');
      }
    } catch {
      messengerSettingsRef.current = { order: previousOrder };
      setMessengerSettingsState({ order: previousOrder });
      setMessengerOrderMessage('Failed to save messenger order');
    } finally {
      setMessengerOrderSaving(false);
    }
  }, []);

  useEffect(() => {
    if (mainViewMode !== 'messenger') return;
    const map = messengerTabIdsRef.current;
    for (const [messengerId, tabId] of Array.from(map.entries())) {
      if (!tabs.some((tab) => tab.id === tabId)) {
        map.delete(messengerId);
      }
    }

    if (pendingMessengerTabIdRef.current && activeId !== pendingMessengerTabIdRef.current) {
      return;
    }
    if (pendingMessengerTabIdRef.current && activeId === pendingMessengerTabIdRef.current) {
      pendingMessengerTabIdRef.current = null;
    }

    const activeEntry = Array.from(map.entries()).find(([, tabId]) => tabId === activeId);
    if (!activeEntry) {
      if (!pendingMessengerTabIdRef.current) {
        exitMessengerMode();
      }
      return;
    }

    const [currentMessengerId] = activeEntry;
    if (activeMessengerId !== currentMessengerId) {
      setActiveMessengerId(currentMessengerId);
      lastMessengerIdRef.current = currentMessengerId;
    }
  }, [activeId, activeMessengerId, exitMessengerMode, mainViewMode, tabs]);

  useEffect(() => {
    if (mainViewMode === 'messenger' && orderedMessengers.length === 0) {
      exitMessengerMode();
    }
  }, [exitMessengerMode, mainViewMode, orderedMessengers]);

  useEffect(() => () => {
    const ids = Array.from(messengerTabIdsRef.current.values());
    messengerTabIdsRef.current.clear();
    pendingMessengerTabIdRef.current = null;
    if (ids.length) {
      for (const tabId of ids) {
        closeTabAction(tabId);
      }
    }
    void ipc.ua.setMode('auto');
  }, [closeTabAction]);
  const closeShortcutModal = useCallback(() => {
    setShowModal(false);
    setBusy(false);
    setMsg('');
    setTitle('');
    setShortcutUrl('');
    setShortcutCompleted(false);
    setShortcutSuccessMsg('');
    activeInputRef.current = null;
    blurActiveInWebview();
  }, [blurActiveInWebview]);

  const openSettingsModal = useCallback(() => {
    activeInputRef.current = null;
    setShowSettingsModal(true);
    setSettingsMsg('');
    setPendingRemoval(null);
    setSettingsBusy(false);
    blurActiveInWebview();
  }, [blurActiveInWebview]);

  const closeSettingsModal = useCallback(() => {
    setShowSettingsModal(false);
    setPendingRemoval(null);
    setSettingsMsg('');
    setSettingsBusy(false);
  }, []);

  const askRemoveApp = useCallback((app: InstalledApp | null | undefined) => {
    if (!app) return;
    setPendingRemoval(app);
    setSettingsMsg('');
  }, [setPendingRemoval, setSettingsMsg]);

  const cancelRemoveApp = useCallback(() => {
    setPendingRemoval(null);
  }, [setPendingRemoval]);

  const confirmRemoveApp = useCallback(async () => {
    if (!pendingRemoval) return;
    setSettingsBusy(true);
    setSettingsMsg('');
    try {
      const res = await ipc.settings.removeInstalledApp({
        id: pendingRemoval.id,
        desktopFilePath: pendingRemoval.desktopFilePath
      });
      if (res && res.ok) {
        const nextInstalledApps = res.installedApps;
        if (Array.isArray(nextInstalledApps)) {
          setInstalledApps(nextInstalledApps);
        } else {
          setInstalledApps((apps) => apps.filter((app) => app.id !== pendingRemoval.id));
        }
        setPendingRemoval(null);
        void loadInstalledApps({ quiet: true });
      } else {
        setSettingsMsg(res?.error || 'Failed to remove shortcut.');
      }
    } catch (err) {
      setSettingsMsg(String(err));
    } finally {
      setSettingsBusy(false);
    }
  }, [loadInstalledApps, pendingRemoval, setInstalledApps, setPendingRemoval, setSettingsBusy, setSettingsMsg]);

  useEffect(() => {
    if (!showModal) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      if (modalTitleInputRef.current) {
        modalTitleInputRef.current.focus();
        modalTitleInputRef.current.select();
      }
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeShortcutModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(frame);
    };
  }, [showModal, closeShortcutModal]);

  useEffect(() => {
    const teardown = setupHostRtlDirection();
    return () => teardown();
  }, []);

  useEffect(() => {
    if (!showSettingsModal) {
      return undefined;
    }
    loadInstalledApps();
    setTorContainerDraft(torContainerId);
    setTorConfigFeedback('');
    refreshTorIp();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSettingsModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSettingsModal, loadInstalledApps, closeSettingsModal, torContainerId, refreshTorIp]);

  const handleTorContainerInputChange = useCallback((value: string) => {
    setTorContainerDraft(value);
    setTorConfigFeedback('');
  }, []);

  const handleSaveTorContainer = useCallback(async () => {
    const trimmed = torContainerDraft.trim();
    setTorConfigSaving(true);
    setTorConfigFeedback('');
    try {
      const result = await ipc.settings.saveTorConfig(trimmed);
      if (result?.ok) {
        const nextId = result.containerId ?? trimmed;
        setTorContainerId(nextId);
        setTorContainerDraft(nextId);
        setTorConfigFeedback('Saved');
      } else {
        setTorConfigFeedback(result?.error || 'Failed to save container identifier.');
      }
    } catch (err) {
      setTorConfigFeedback(String(err));
    } finally {
      setTorConfigSaving(false);
    }
  }, [torContainerDraft]);

  const handleToggleTor = useCallback(async () => {
    const trimmedContainerId = (torContainerId || '').trim();
    if (!torEnabled && !trimmedContainerId) {
      showTorAlert('Libertine container identifier is missing in Settings.');
      setShowSettingsModal(true);
      return;
    }
    try {
      const state = await torService.toggle({ containerId: trimmedContainerId });
      if (!torEnabled && (!state || !state.enabled)) {
        const reason = state?.reason || '';
        if (reason) {
          if (/identifier/i.test(reason)) {
            showTorAlert('Libertine container identifier is missing in Settings.');
          } else {
            showTorAlert('Tor is missing in your Libertine container. Please check your settings.');
          }
        }
      }
    } catch (err) {
      console.error('[Merezhyvo] tor toggle failed', err);
    }
  }, [torEnabled, torContainerId, setShowSettingsModal, showTorAlert]);

  useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);

  useEffect(() => {
    const off = torService.subscribe((enabled) => {
      setTorEnabled(!!enabled);
    });
    torService.getState()
      .then((state) => {
        if (state) {
          setTorEnabled(!!state.enabled);
        }
      })
      .catch(() => {});
    return () => { if (typeof off === 'function') off(); };
  }, []);

  useEffect(() => {
    refreshTorIp();
  }, [torEnabled, refreshTorIp]);

  useEffect(() => {
    refreshNavigationState();
  }, [activeId, refreshNavigationState, tabsReady]);

  useEffect(() => {
    if (!isEditingRef.current) return;
    const node = inputRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      try {
        const end = typeof node.selectionEnd === 'number' ? node.selectionEnd : node.value.length;
        const start = typeof node.selectionStart === 'number' ? node.selectionStart : end;
        if (start === end) {
          node.scrollLeft = node.scrollWidth;
        }
      } catch {}
    });
  }, [inputValue]);

  useEffect(() => {
    const node = modalTitleInputRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      try {
        const end = typeof node.selectionEnd === 'number' ? node.selectionEnd : node.value.length;
        const start = typeof node.selectionStart === 'number' ? node.selectionStart : end;
        if (start === end) {
          node.scrollLeft = node.scrollWidth;
        }
      } catch {}
    });
  }, [title]);

  useEffect(() => {
    const node = modalUrlInputRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      try {
        const end = typeof node.selectionEnd === 'number' ? node.selectionEnd : node.value.length;
        const start = typeof node.selectionStart === 'number' ? node.selectionStart : end;
        if (start === end) {
          node.scrollLeft = node.scrollWidth;
        }
      } catch {}
    });
  }, [shortcutUrl]);

  useEffect(() => {
    if (mode !== 'mobile') return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const insideOsk = t.closest('[data-soft-keyboard="true"]');
      if (insideOsk) {
        oskPressGuardRef.current = true;
        setTimeout(() => { oskPressGuardRef.current = false; }, 250);
        return;
      }
      if (!isEditableElement(t)) setKbVisible(false);
    };

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (isEditableElement(t)) setKbVisible(true);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('focusin', onFocusIn, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }, [mode, isEditableElement]);

  useEffect(() => {
    if (mode !== 'mobile') return;
    const wv = getActiveWebview();
    if (!wv) return;

    const bridgeScript = `
      (function(){
        try {
          if (window.__mzrFocusBridgeInstalled) return;
          window.__mzrFocusBridgeInstalled = true;

          var nonText = new Set(['button','submit','reset','checkbox','radio','range','color','file','image','hidden']);
          function isEditable(el){
            if(!el) return false;
            if(el.isContentEditable) return true;
            var tag = (el.tagName||'').toLowerCase();
            if(tag==='textarea') return !el.disabled && !el.readOnly;
            if(tag==='input'){
              var type = (el.getAttribute('type')||'').toLowerCase();
              if(nonText.has(type)) return false;
              return !el.disabled && !el.readOnly;
            }
            return false;
          }

          function markLast(el){
            try { window.__mzrLastEditable = el; } catch(e) {}
          }

          function notify(flag){
            try { console.info(flag ? '${FOCUS_CONSOLE_ACTIVE}' : '${FOCUS_CONSOLE_INACTIVE}'); } catch(e){}
          }

          document.addEventListener('focusin', function(ev){
            if (isEditable(ev.target)) { markLast(ev.target); notify(true); }
          }, true);

          document.addEventListener('focusout', function(ev){
            if (!isEditable(ev.target)) return;
            setTimeout(function(){
              var still = isEditable(document.activeElement);
              if (still) markLast(document.activeElement);
              notify(still);
            }, 0);
          }, true);

          document.addEventListener('pointerdown', function(ev){
            var t = ev.target;
            if (isEditable(t)) { markLast(t); notify(true); }
          }, true);
        } catch(e){}
      })();
    `;


    const install = () => {
      try {
        const r = wv.executeJavaScript(bridgeScript, false);
        if (r && typeof r.then === 'function') r.catch(()=>{});
      } catch {}
    };

    const onConsole = (event: any) => {
      const msg: string = (event && event.message) || '';
      if (msg === FOCUS_CONSOLE_ACTIVE) {
        setKbVisible(true);
      } else if (msg === FOCUS_CONSOLE_INACTIVE) {
        if (oskPressGuardRef.current) return;
        setKbVisible(false);
      }
    };

    install();
    wv.addEventListener('dom-ready', install);
    wv.addEventListener('did-navigate', install);
    wv.addEventListener('did-navigate-in-page', install);
    wv.addEventListener('console-message', onConsole);

    return () => {
      wv.removeEventListener('dom-ready', install);
      wv.removeEventListener('did-navigate', install);
      wv.removeEventListener('did-navigate-in-page', install);
      wv.removeEventListener('console-message', onConsole);
    };
  }, [mode, getActiveWebview, activeId, activeViewRevision]);
  const handleSubmit = useCallback((event: SubmitEvent) => {
    event?.preventDefault?.();
    const handle = getActiveWebviewHandle();
    const view = (handle && typeof handle.getWebView === 'function')
      ? handle.getWebView()
      : getActiveWebview();
    if (!handle && !view) return;
    const target = normalizeAddress(inputValue);
    setInputValue(target);
    setStatus('loading');
    webviewReadyRef.current = false;
    setWebviewReady(false);
    const activeIdCurrent = activeIdRef.current;
    if (activeIdCurrent) {
      navigateActiveAction(target);
      lastLoadedRef.current = { id: activeIdCurrent, url: target };
    }
    if (handle) {
      handle.loadURL(target);
    } else if (view) {
      try { view.loadURL(target); } catch {}
    }
  }, [getActiveWebview, getActiveWebviewHandle, inputValue, navigateActiveAction]);

  const handleBack = useCallback(() => {
    const handle = getActiveWebviewHandle();
    if (handle) {
      try { handle.goBack(); } catch {}
      return;
    }
    const view = getActiveWebview();
    if (view && typeof view.canGoBack === 'function' && view.canGoBack()) {
      try { view.goBack(); } catch {}
    }
  }, [getActiveWebview, getActiveWebviewHandle]);
  const handleForward = useCallback(() => {
    const handle = getActiveWebviewHandle();
    if (handle) {
      try { handle.goForward(); } catch {}
      return;
    }
    const view = getActiveWebview();
    if (view && typeof view.canGoForward === 'function' && view.canGoForward()) {
      try { view.goForward(); } catch {}
    }
  }, [getActiveWebview, getActiveWebviewHandle]);
  const handleReload = useCallback(() => {
    const handle = getActiveWebviewHandle();
    const view = (handle && typeof handle.getWebView === 'function')
      ? handle.getWebView()
      : getActiveWebview();
    if (!handle && !view) return;
    if (view && 'isConnected' in view && !view.isConnected) return;
    const activeUrlCurrent = (activeTabRef.current?.url || '').trim() || DEFAULT_URL;
    setStatus('loading');
    reloadActiveAction();
    const wasReady = webviewReadyRef.current;
    webviewReadyRef.current = false;
    setWebviewReady(false);
    try {
      if (handle) {
        if (wasReady) {
          handle.reload();
        } else {
          handle.loadURL(activeUrlCurrent);
        }
      } else if (view) {
        if (wasReady && typeof view.reload === 'function') {
          view.reload();
        } else {
          view.loadURL(activeUrlCurrent);
        }
      }
    } catch {
      if (view) {
        try {
          view.setAttribute('src', activeUrlCurrent);
        } catch {}
      }
    }
  }, [getActiveWebview, getActiveWebviewHandle, reloadActiveAction]);

  const handleInputPointerDown = useCallback((_: ReactPointerEvent<HTMLInputElement>) => {
    activeInputRef.current = 'url';
  }, []);

  const handleInputFocus = useCallback((event: ReactFocusEvent<HTMLInputElement>) => {
    isEditingRef.current = true;
    setIsEditing(true);
    activeInputRef.current = 'url';
    event.target.select();
  }, []);

  const handleInputBlur = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    isEditingRef.current = false;
    setIsEditing(false);
    if (activeInputRef.current === 'url') activeInputRef.current = null;
  }, []);


  const handleModalInputPointerDown = useCallback((_: ReactPointerEvent<HTMLInputElement>) => {
    activeInputRef.current = 'modalTitle';
  }, []);

  const handleModalInputFocus = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    activeInputRef.current = 'modalTitle';
  }, []);

  const handleModalInputBlur = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    if (activeInputRef.current === 'modalTitle') activeInputRef.current = null;
  }, []);

  const handleModalUrlPointerDown = useCallback((_: ReactPointerEvent<HTMLInputElement>) => {
    activeInputRef.current = 'modalUrl';
  }, []);

  const handleModalUrlFocus = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    activeInputRef.current = 'modalUrl';
  }, []);

  const handleModalUrlBlur = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    if (activeInputRef.current === 'modalUrl') activeInputRef.current = null;
  }, []);

  const handleTorInputPointerDown = useCallback((_: ReactPointerEvent<HTMLInputElement>) => {
    activeInputRef.current = 'torContainer';
  }, []);

  const handleTorInputFocus = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    activeInputRef.current = 'torContainer';
  }, []);

  const handleTorInputBlur = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    if (activeInputRef.current === 'torContainer') activeInputRef.current = null;
  }, []);

  const containerStyle = useMemo(() => {
    return styles.container;
  }, []);

  const modalBackdropStyle = useMemo<CSSProperties>(() => {
    return { ...styles.modalBackdrop };
  }, []);

  const tabsPanelBackdropStyle = useMemo<CSSProperties>(() => {
    return { ...tabsPanelStyles.backdrop };
  }, []);
  const getCurrentViewUrl = useCallback(() => {
    try {
      const direct = getActiveWebview()?.getURL?.();
      if (direct) return direct;
    } catch {}
    return activeTabRef.current?.url || activeUrl || null;
  }, [activeUrl, getActiveWebview]);

  const openShortcutModal = () => {
    let appTitle = '';
    const viewUrl = getCurrentViewUrl();
    if (viewUrl) {
      try {
        const hostname = new URL(viewUrl).hostname.replace(/^www\./, '');
        const firstPart = hostname.split('.')[0] || '';
        if (!firstPart) {
          appTitle = viewUrl;
        } else {
          const chars = Array.from(firstPart);
          const capFirst = chars[0]?.toUpperCase() ?? '';
          appTitle = 'm' + capFirst + chars.slice(1).join('');
        }
      } catch {
        appTitle = '';
      }
    }
    setTitle(appTitle);
    setShortcutUrl(viewUrl || '');
    setMsg('');
    setBusy(false);
    setShortcutCompleted(false);
    setShortcutSuccessMsg('');
    setShowModal(true);
  };

  const createShortcut = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) { setMsg('Please enter a name.'); return; }
    const normalizedUrl = normalizeShortcutUrl(shortcutUrl || getCurrentViewUrl() || '');
    if (!normalizedUrl) {
      setMsg('Please enter a valid URL (http/https).');
      return;
    }
    setShortcutUrl(normalizedUrl);
    setMsg('');
    setBusy(true);
    try {
      const res = await ipc.createShortcut({
        title: trimmedTitle,
        url: normalizedUrl,
        single: true
      });
      if (res?.ok) {
        const installedApp = res.installedApp;
        if (installedApp) {
          setInstalledApps((apps) => {
            const next = [...apps];
            const index = next.findIndex((app) => app.id === installedApp.id);
            if (index === -1) {
              return [...next, installedApp];
            }
            next[index] = installedApp;
            return next;
          });
        } else {
          void loadInstalledApps({ quiet: true });
        }
        setShortcutCompleted(true);
        setShortcutSuccessMsg('Shortcut saved successfully. You can now open your new web application from the app launcher.');
        activeInputRef.current = null;
        const activeIdCurrent = activeIdRef.current;
        if (activeIdCurrent) {
          closeTabAction(activeIdCurrent);
        }
        return;
      } else {
        setMsg(res?.error || 'Unknown error.');
      }
    } catch (err) {
      setMsg(String(err));
    } finally {
      setBusy(false);
    }
  }, [activeIdRef, closeTabAction, getCurrentViewUrl, loadInstalledApps, setBusy, setInstalledApps, setMsg, setShortcutSuccessMsg, setShortcutCompleted, setShortcutUrl, shortcutUrl, title]);

  const handleShortcutPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleZoomSliderPointerDown = useCallback((event: ReactPointerEvent<HTMLInputElement>) => {
    event.stopPropagation();
  }, []);

  const openTabsPanel = useCallback(() => {
    if (!tabsReady) return;
    setShowTabsPanel(true);
    activeInputRef.current = null;
    blurActiveInWebview();
  }, [tabsReady, blurActiveInWebview]);

  const closeTabsPanel = useCallback(() => {
    setShowTabsPanel(false);
  }, []);

  const handleActivateTab = useCallback((id: string) => {
    if (!id) return;
    activateTabAction(id);
    setShowTabsPanel(false);
    blurActiveInWebview();
  }, [activateTabAction, blurActiveInWebview]);

  const handleCloseTab = useCallback((id: string) => {
    if (!id) return;
    closeTabAction(id);
  }, [closeTabAction]);

  const handleTogglePin = useCallback((id: string) => {
    if (!id) return;
    pinTabAction(id);
  }, [pinTabAction]);

  const handleNewTab = useCallback(() => {
    newTabAction(DEFAULT_URL);
    setShowTabsPanel(false);
    blurActiveInWebview();
    requestAnimationFrame(() => {
      try { inputRef.current?.focus?.(); } catch {}
    });
  }, [blurActiveInWebview, newTabAction]);

  const statusLabelMap: Record<StatusState, string> = {
    loading: 'Loading',
    ready: 'Ready',
    error: 'Failed to load'
  };
  const zoomDisplay = `${Math.round(zoomLevel * 100)}%`;
  const tabLoadingOverlay = activeTabIsLoading
    ? (
      <div
        style={{
          ...styles.webviewLoadingOverlay,
          ...(mode === 'mobile' ? styles.webviewLoadingOverlayMobile : null)
        }}
        aria-live="polite"
        aria-label="Loading"
      >
        <div
          aria-hidden="true"
          className="mzv-spinner"
          style={{
            ...styles.webviewLoadingSpinner,
            ...(mode === 'mobile' ? styles.webviewLoadingSpinnerMobile : null)
          }}
        />
      </div>
    )
    : null;

  return (
    <div style={containerStyle} className={`app app--${mode}`}>
      {!isHtmlFullscreen && mainViewMode === 'browser' && (
        <Toolbar
          mode={mode}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          webviewReady={webviewReady}
          tabCount={tabCount}
          tabsReady={tabsReady}
          inputRef={inputRef}
          inputValue={inputValue}
          status={status}
          statusLabel={statusLabelMap[status] || status}
          torEnabled={torEnabled}
          onBack={handleBack}
          onForward={handleForward}
          onReload={handleReload}
          onSubmit={handleSubmit}
          onInputChange={(value) => setInputValue(value)}
          onInputPointerDown={handleInputPointerDown}
          onInputFocus={handleInputFocus}
          onInputBlur={handleInputBlur}
          onShortcutPointerDown={handleShortcutPointerDown}
          onOpenShortcutModal={openShortcutModal}
          onOpenTabsPanel={openTabsPanel}
          onToggleTor={handleToggleTor}
          onOpenSettings={openSettingsModal}
          onEnterMessengerMode={handleEnterMessengerMode}
        />
      )}

      {!isHtmlFullscreen && mainViewMode === 'messenger' && (
        <MessengerToolbar
          mode={mode}
          messengers={orderedMessengers}
          activeMessengerId={activeMessengerId}
          onSelectMessenger={handleMessengerSelect}
          onExit={exitMessengerMode}
        />
      )}

      <WebViewPane
        webviewHostRef={webviewHostRef}
        backgroundHostRef={backgroundHostRef}
        webviewStyle={styles.webviewMount}
        webviewHostStyle={styles.webviewHost}
        backgroundStyle={styles.backgroundShelf}
        overlay={tabLoadingOverlay}
      />

      {!isHtmlFullscreen && (
        <ZoomBar
          mode={mode}
          zoomLevel={zoomLevel}
          zoomDisplay={zoomDisplay}
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={ZOOM_STEP}
          onPointerDown={handleZoomSliderPointerDown}
          onChange={handleZoomSliderChange}
        />
      )}

      {showTabsPanel && (
        <TabsPanel
          mode={mode}
          backdropStyle={tabsPanelBackdropStyle}
          activeTabId={activeId}
          pinnedTabs={pinnedTabs}
          regularTabs={regularTabs}
          onClose={closeTabsPanel}
          onNewTab={handleNewTab}
          onActivateTab={handleActivateTab}
          onTogglePin={handleTogglePin}
          onCloseTab={handleCloseTab}
          displayTitle={displayTitleForTab}
          displaySubtitle={displaySubtitleForTab}
          fallbackInitial={fallbackInitialForTab}
        />
      )}

      {showModal && (
        <CreateShortcutModal
          mode={mode}
          modalBackdropStyle={modalBackdropStyle}
          shortcutCompleted={shortcutCompleted}
          shortcutSuccessMsg={shortcutSuccessMsg}
          busy={busy}
          msg={msg}
          title={title}
          shortcutUrl={shortcutUrl}
          modalTitleInputRef={modalTitleInputRef}
          modalUrlInputRef={modalUrlInputRef}
          onClose={closeShortcutModal}
          onCreateShortcut={createShortcut}
          onTitleChange={(value) => setTitle(value)}
          onShortcutUrlChange={(value) => setShortcutUrl(value)}
          onTitlePointerDown={handleModalInputPointerDown}
          onTitleFocus={handleModalInputFocus}
          onTitleBlur={handleModalInputBlur}
          onUrlPointerDown={handleModalUrlPointerDown}
          onUrlFocus={handleModalUrlFocus}
          onUrlBlur={handleModalUrlBlur}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          mode={mode}
          backdropStyle={modalBackdropStyle}
          installedApps={installedAppsList}
          loading={installedAppsLoading}
          message={settingsMsg}
          pendingRemoval={pendingRemoval}
          busy={settingsBusy}
          appInfo={appInfo}
          torEnabled={torEnabled}
          torCurrentIp={torIp}
          torIpLoading={torIpLoading}
          torContainerValue={torContainerDraft}
          torSavedContainerId={torContainerId}
          torContainerSaving={torConfigSaving}
          torContainerMessage={torConfigFeedback}
          torInputRef={torContainerInputRef}
          onTorInputPointerDown={handleTorInputPointerDown}
          onTorInputFocus={handleTorInputFocus}
          onTorInputBlur={handleTorInputBlur}
          onTorContainerChange={handleTorContainerInputChange}
          onSaveTorContainer={handleSaveTorContainer}
          onClose={closeSettingsModal}
          onRequestRemove={askRemoveApp}
          onCancelRemove={cancelRemoveApp}
          onConfirmRemove={confirmRemoveApp}
          messengerItems={orderedMessengers}
          messengerOrderSaving={messengerOrderSaving}
          messengerOrderMessage={messengerOrderMessage}
          onMessengerMove={handleMessengerMove}
        />
      )}

      {torAlertMessage && (
        <div
          style={styles.torAlertOverlay}
          role="alertdialog"
          aria-modal="true"
          aria-live="assertive"
          onClick={dismissTorAlert}
        >
          <div
            style={{
              ...styles.torAlertCard,
              ...(mode === 'mobile' ? styles.torAlertCardMobile : styles.torAlertCardDesktop)
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <p
              style={{
                ...styles.torAlertText,
                ...(mode === 'mobile' ? styles.torAlertTextMobile : styles.torAlertTextDesktop)
              }}
            >
              {torAlertMessage}
            </p>
            <button
              type="button"
              style={{
                ...styles.torAlertButton,
                ...(mode === 'mobile' ? styles.torAlertButtonMobile : styles.torAlertButtonDesktop)
              }}
              onClick={dismissTorAlert}
            >
              OK
            </button>
          </div>
        </div>
      )}

      <KeyboardPane
        visible={kbVisible}
        layoutId={kbLayout}
        enabledLayouts={enabledKbLayouts}
        context="text"
        injectText={injectText}
        injectBackspace={injectBackspace}
        injectEnter={injectEnter}
        injectArrow={injectArrow}
        onSetLayout={setKbLayout}
        onEnterShouldClose={onEnterShouldClose}
        onClose={closeKeyboard}
        onCycleLayout={() => setKbLayout(prev => nextLayoutId(prev, enabledKbLayouts))}
      />
    </div>
  );
};

const App: React.FC = () => {
  const { url: parsedStartUrl, hasStartParam, single: isSingleWindow } = useMemo(() => parseStartUrl(), []);
  const initialUrl = useMemo(() => normalizeAddress(parsedStartUrl), [parsedStartUrl]);
  const mode = useMerezhyvoMode();

  if (isSingleWindow) {
    return <SingleWindowApp initialUrl={initialUrl} mode={mode} />;
  }

  return (
    <MainBrowserApp
      initialUrl={initialUrl}
      mode={mode}
      hasStartParam={hasStartParam}
    />
  );
};

export default App;

const singleStyles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#000',
    overflow: 'hidden'
  },
  webviewWrapper: {
    position: 'relative',
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: 0,
    overflow: 'hidden'
  },
  webview: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: '#000'
  },
  webviewFullscreen: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    border: 'none',
    backgroundColor: '#000'
  },
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: '6px 12px',
    borderRadius: '999px',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    color: '#f8fafc',
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  statusBadgeError: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)'
  }
};

const SingleWindowApp: React.FC<SingleWindowAppProps> = ({ initialUrl, mode }) => {
  const webviewHandleRef = useRef<WebViewHandle | null>(null);
  const listenersCleanupRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState<StatusState>('loading');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const powerBlockerIdRef = useRef<number | null>(null);
  const initialZoom = mode === 'mobile' ? 2 : 1;
  const zoomRef = useRef<number>(initialZoom);
  const [zoomLevel, setZoomLevel] = useState<number>(initialZoom);

  const startPowerBlocker = useCallback(async (): Promise<number | null> => {
    if (powerBlockerIdRef.current != null) return powerBlockerIdRef.current;
    try {
      const id = await ipc.power.start();
      if (typeof id === 'number') {
        powerBlockerIdRef.current = id;
        return id;
      }
    } catch (err) {
      console.error('[Merezhyvo] power blocker start failed (single)', err);
    }
    return null;
  }, []);

  const stopPowerBlocker = useCallback(async (): Promise<void> => {
    const id = powerBlockerIdRef.current;
    if (id == null) return;
    try {
      await ipc.power.stop(id);
    } catch (err) {
      console.error('[Merezhyvo] power blocker stop failed (single)', err);
    }
    powerBlockerIdRef.current = null;
  }, []);

  const setZoomClamped = useCallback((value: number | string) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, numeric));
    const rounded = Math.round(clamped * 100) / 100;
    zoomRef.current = rounded;
    setZoomLevel(rounded);
  }, []);

  useEffect(() => {
    const base = mode === 'mobile' ? 2 : 1;
    if (Math.abs(zoomRef.current - base) < 1e-3) return;
    const frame = requestAnimationFrame(() => {
      setZoomClamped(base);
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, setZoomClamped]);

  const attachExtraListeners = useCallback((view: WebviewTag | null) => {
    if (!view) return () => {};
    const handleMediaStarted = () => { void startPowerBlocker(); };
    const handleMediaPaused = () => { void stopPowerBlocker(); };
    const handleEnterFullscreen = () => setIsFullscreen(true);
    const handleLeaveFullscreen = () => setIsFullscreen(false);
    const handleZoomChanged = (event: any) => {
      const raw = typeof event?.newZoomFactor === 'number' ? event.newZoomFactor : view.getZoomFactor?.();
      if (typeof raw !== 'number' || Number.isNaN(raw)) return;
      const normalized = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, raw)) * 100) / 100;
      zoomRef.current = normalized;
      setZoomLevel(normalized);
    };

    const injectBaseCss = () => {
      try {
        const maybe = view.insertCSS(WEBVIEW_BASE_CSS);
        if (maybe && typeof maybe.catch === 'function') {
          maybe.catch(() => {});
        }
      } catch {}
    };

    const installInputScroll = () => {
      const script = `
        (function(){
          try {
            if (window.__mzrSingleInputScrollInstalled) return;
            window.__mzrSingleInputScrollInstalled = true;
            const ensureFieldScroll = (el) => {
              if (!el) return;
              const tag = (el.tagName || '').toLowerCase();
              if (tag !== 'input' && tag !== 'textarea') return;
              requestAnimationFrame(() => {
                try {
                  if (typeof el.selectionStart !== 'number' || typeof el.selectionEnd !== 'number') return;
                  if (el.selectionStart === el.selectionEnd) {
                    el.scrollLeft = el.scrollWidth;
                  }
                } catch {}
              });
            };
            document.addEventListener('input', (event) => ensureFieldScroll(event.target), true);
            document.addEventListener('keyup', (event) => {
              const key = event?.key;
              if (key === 'ArrowRight' || key === 'ArrowLeft' || key === 'End') {
                ensureFieldScroll(event.target);
              }
            }, true);
          } catch {}
        })();
      `;
      try { view.executeJavaScript(script, false).catch?.(() => {}); } catch {}
    };

    injectBaseCss();
    installInputScroll();

    view.addEventListener('media-started-playing', handleMediaStarted);
    view.addEventListener('media-paused', handleMediaPaused);
    view.addEventListener('enter-html-full-screen', handleEnterFullscreen);
    view.addEventListener('leave-html-full-screen', handleLeaveFullscreen);
    view.addEventListener('zoom-changed', handleZoomChanged);
    view.addEventListener('dom-ready', injectBaseCss);
    view.addEventListener('did-navigate', injectBaseCss);
    view.addEventListener('did-navigate-in-page', injectBaseCss);

    return () => {
      view.removeEventListener('media-started-playing', handleMediaStarted);
      view.removeEventListener('media-paused', handleMediaPaused);
      view.removeEventListener('enter-html-full-screen', handleEnterFullscreen);
      view.removeEventListener('leave-html-full-screen', handleLeaveFullscreen);
      view.removeEventListener('zoom-changed', handleZoomChanged);
      view.removeEventListener('dom-ready', injectBaseCss);
      view.removeEventListener('did-navigate', injectBaseCss);
      view.removeEventListener('did-navigate-in-page', injectBaseCss);
    };
  }, [startPowerBlocker, stopPowerBlocker]);

  const handleDomReady = useCallback(() => {
    const handle = webviewHandleRef.current;
    const view = handle && typeof handle.getWebView === 'function' ? handle.getWebView() : null;
    if (!view) return;
    try {
      listenersCleanupRef.current?.();
    } catch {}
    listenersCleanupRef.current = attachExtraListeners(view);
    setStatus('ready');
    try { handle?.focus(); } catch {}
  }, [attachExtraListeners]);

  useEffect(() => () => {
    try { listenersCleanupRef.current?.(); } catch {}
    listenersCleanupRef.current = () => {};
    void stopPowerBlocker();
  }, [stopPowerBlocker]);

  const webviewStyle = isFullscreen ? singleStyles.webviewFullscreen : singleStyles.webview;
  const showErrorBadge = status === 'error';
  const statusStyle = { ...singleStyles.statusBadge, ...(showErrorBadge ? singleStyles.statusBadgeError : null) };
  const zoomDisplay = `${Math.round(zoomLevel * 100)}%`;
  const handleZoomSliderChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { valueAsNumber, value } = event.target;
    const candidate = Number.isFinite(valueAsNumber) ? valueAsNumber : Number(value);
    setZoomClamped(candidate);
  }, [setZoomClamped]);
  const handleZoomSliderPointerDown = useCallback((event: ReactPointerEvent<HTMLInputElement>) => {
    event.stopPropagation();
  }, []);

  const initialTarget = initialUrl && initialUrl.trim() ? initialUrl.trim() : DEFAULT_URL;

  return (
    <div style={singleStyles.container} className={`single-app single-app--${mode}`}>
      <div style={singleStyles.webviewWrapper}>
        <WebViewHost
          ref={(instance) => {
            webviewHandleRef.current = instance;
          }}
          initialUrl={initialTarget}
          mode={mode}
          zoom={zoomLevel}
          onCanGo={() => {}}
          onStatus={setStatus}
          onUrlChange={() => {}}
          onDomReady={handleDomReady}
          style={webviewStyle}
        />
        {status === 'loading' && (
          <div
            style={{
              ...styles.webviewLoadingOverlay,
              ...(mode === 'mobile' ? styles.webviewLoadingOverlayMobile : null)
            }}
            aria-live="polite"
            aria-label="Loading"
          >
            <div
              aria-hidden="true"
              style={{
                ...styles.webviewLoadingSpinner,
                ...(mode === 'mobile' ? styles.webviewLoadingSpinnerMobile : null)
              }}
            />
          </div>
        )}
      </div>
      {showErrorBadge && (
        <div style={statusStyle}>
          Load failed
        </div>
      )}
      {!isFullscreen && (
        <div className="zoom-toolbar" style={zoomBarStyles.bottomToolbar}>
          <span style={{ ...zoomBarStyles.zoomLabel, ...(zoomBarModeStyles[mode].zoomLabel || {}) }}>Zoom</span>
          <div style={zoomBarStyles.zoomSliderContainer}>
            <input
              type="range"
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              value={zoomLevel}
              onPointerDown={handleZoomSliderPointerDown}
              onInput={handleZoomSliderChange}
              onChange={handleZoomSliderChange}
              aria-label="Zoom level"
              className="zoom-slider"
              style={{ ...zoomBarStyles.zoomSlider, ...(zoomBarModeStyles[mode].zoomSlider || {}) }}
            />
          </div>
          <span style={{ ...zoomBarStyles.zoomValue, ...(zoomBarModeStyles[mode].zoomValue || {}) }}>{zoomDisplay}</span>
        </div>
      )}
    </div>
  );
};
