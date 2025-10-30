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
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MutableRefObject,
  ReactElement
} from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import SoftKeyboard from './components/keyboard/SoftKeyboard';
import Toolbar from './components/toolbar/Toolbar';
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
import { useTabsStore, tabsActions, defaultTabUrl } from './store/tabs';
import type { Mode, InstalledApp, Tab } from './types/models';
import { layouts as keyboardLayouts } from './layouts/keyboard/layouts';
import type { KeyboardLayoutId } from './layouts/keyboard/layouts';

const DEFAULT_URL = defaultTabUrl;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.5;
const ZOOM_STEP = 0.1;
const KB_HEIGHT = 650;
const FOCUS_CONSOLE_ACTIVE = '__MZR_FOCUS_ACTIVE__';
const FOCUS_CONSOLE_INACTIVE = '__MZR_FOCUS_INACTIVE__';

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

type WebviewTag = any;

type WebviewTitleEvent = {
  title?: string | null;
};

type WebviewFaviconEvent = {
  favicons?: unknown;
};

type WebviewZoomEvent = {
  newZoomFactor?: number | null;
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

  // --- Soft keyboard state ---
  const [kbVisible, setKbVisible] = useState<boolean>(false);
  const [kbLayout, setKbLayout] = useState<KeyboardLayoutId>(() => {
    if (typeof window === 'undefined') return 'en';
    try {
      const stored = window.localStorage.getItem('mzr.kbLayout');
      if (stored && Object.prototype.hasOwnProperty.call(keyboardLayouts, stored)) {
        return stored as KeyboardLayoutId;
      }
    } catch {}
    return 'en';
  });
  const [kbShift, setKbShift] = useState<boolean>(false);
  const [kbCaps, setKbCaps] = useState<boolean>(false);

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

  const {
    newTab: newTabAction,
    closeTab: closeTabAction,
    activateTab: activateTabAction,
    pinTab: pinTabAction,
    navigateActive: navigateActiveAction,
    reloadActive: reloadActiveAction,
    updateMeta: updateMetaAction
  } = tabsActions;
  
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
  const getActiveWebview = useCallback((): WebviewTag | null => {
    const handle = webviewHandleRef.current;
    if (handle && typeof handle.getWebView === 'function') {
      const element = handle.getWebView();
      if (element) return element;
    }
    return webviewRef.current ?? null;
  }, []);

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
      setKbVisible(false);
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

  // --- Zoom management inside the active webview ---
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
    const base = mode === 'mobile' ? 2.0 : 1.0;
    zoomRef.current = base;
    setZoomLevel(base);
    setZoomClamped(base);
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
    const onZoomChanged = (event: WebviewZoomEvent | null | undefined) => {
      const raw = typeof event?.newZoomFactor === 'number' ? event.newZoomFactor : view.getZoomFactor?.();
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
    return () => { try { off && off(); } catch {} };
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
    if (mode === 'mobile') setKbVisible(false);
  }, [mode, blurActiveInWebview, setKbVisible]);

  const openSettingsModal = useCallback(() => {
    activeInputRef.current = null;
    setShowSettingsModal(true);
    setSettingsMsg('');
    setPendingRemoval(null);
    setSettingsBusy(false);
    blurActiveInWebview();
    if (mode === 'mobile') setKbVisible(false);
  }, [mode, blurActiveInWebview]);

  const closeSettingsModal = useCallback(() => {
    setShowSettingsModal(false);
    setPendingRemoval(null);
    setSettingsMsg('');
    setSettingsBusy(false);
    if (mode === 'mobile') setKbVisible(false);
  }, [mode, setKbVisible]);

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
    try { localStorage.setItem('mzr.kbLayout', kbLayout); } catch {}
  }, [kbLayout]);

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

  // --- Text injection helpers (used by the soft keyboard) ---
  const injectTextToWeb = useCallback(async (text: string) => {
    const wv = getActiveWebview();
    if (!wv) return;
    const js = `
      (function(rawText){
        try {
          const el = document.activeElement;
          if (!el) return false;
          const isEditable = el.isContentEditable || (typeof el.value === 'string');
          if (!isEditable) return false;
          const text = String(rawText ?? '');
          if (!text) return false;

          const isEnter = text === '\\n';
          const key = isEnter ? 'Enter' : text;
          const firstCodePoint = text.codePointAt ? text.codePointAt(0) || 0 : (text.length ? text.charCodeAt(0) : 0);
          const keyCode = isEnter ? 13 : (firstCodePoint > 0xffff ? 0 : firstCodePoint);
          const code = (() => {
            if (isEnter) return 'Enter';
            if (text.length === 1) {
              const ch = text;
              if (ch === ' ') return 'Space';
              if (/[0-9]/.test(ch)) return 'Digit' + ch;
              if (/[a-zA-Z]/.test(ch)) return 'Key' + ch.toUpperCase();
              if (ch === '.') return 'Period';
              if (ch === ',') return 'Comma';
              if (ch === '-') return 'Minus';
              if (ch === '+') return 'Equal';
              if (ch === '/') return 'Slash';
              if (ch === '*') return 'NumpadMultiply';
            }
            return key.length === 1 ? 'Key' + key.toUpperCase() : key || 'Unidentified';
          })();

          const fireKeyEvent = (type) => {
            const event = new KeyboardEvent(type, {
              key,
              code,
              location: 0,
              bubbles: true,
              cancelable: type !== 'keyup',
              composed: true
            });
            try {
              Object.defineProperty(event, 'keyCode', { get: () => keyCode });
              Object.defineProperty(event, 'which', { get: () => keyCode });
              Object.defineProperty(event, 'charCode', { get: () => type === 'keypress' ? keyCode : 0 });
            } catch {}
            el.dispatchEvent(event);
          };

          const initialValue = el.isContentEditable ? null : (typeof el.value === 'string' ? String(el.value) : '');
          const initialStart = el.isContentEditable ? null : (typeof el.selectionStart === 'number' ? el.selectionStart : (initialValue ? initialValue.length : 0));
          const initialEnd = el.isContentEditable ? null : (typeof el.selectionEnd === 'number' ? el.selectionEnd : initialStart);

          fireKeyEvent('keydown');
          if (key !== 'Unidentified') {
            fireKeyEvent('keypress');
          }

          if (!el.isContentEditable) {
            const currentValue = typeof el.value === 'string' ? String(el.value) : '';
            const currentStart = typeof el.selectionStart === 'number' ? el.selectionStart : currentValue.length;
            const currentEnd = typeof el.selectionEnd === 'number' ? el.selectionEnd : currentStart;
            const handledByPage = currentValue !== initialValue || currentStart !== initialStart || currentEnd !== initialEnd;
            if (handledByPage) {
              fireKeyEvent('keyup');
              return true;
            }
          }

          const beforeInputEvt = new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true, cancelable: true });
          if (!el.dispatchEvent(beforeInputEvt)) {
            fireKeyEvent('keyup');
            return true;
          }

          let success = false;
          if (el.isContentEditable) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              range.deleteContents();
              range.insertNode(document.createTextNode(text));
              range.collapse(false);
              const inputEvt = new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true });
              el.dispatchEvent(inputEvt);
              success = true;
              document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
            }
          } else {
            if (typeof el.setRangeText === 'function') {
              el.setRangeText(text, initialStart, initialEnd, 'end');
            } else {
              const before = initialValue.slice(0, initialStart);
              const after  = initialValue.slice(initialEnd);
              el.value = before + text + after;
              const posFallback = before.length + text.length;
              if (typeof el.setSelectionRange === 'function') {
                el.setSelectionRange(posFallback, posFallback);
              } else {
                el.selectionStart = el.selectionEnd = posFallback;
              }
            }
            const inputEvt = new InputEvent('input', { inputType: 'insertText', data: text, bubbles: true });
            el.dispatchEvent(inputEvt);
            success = true;
            document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
          }

          fireKeyEvent('keyup');
          return success;
        } catch(e) { return false; }
      })(${JSON.stringify(text)});
    `;
    try { await wv.executeJavaScript(js); } catch {}
  }, [getActiveWebview]);

  const injectBackspaceToWeb = useCallback(async () => {
    const wv = getActiveWebview();
    if (!wv) return;
    const js = `
      (function(){
        try {
          const el = document.activeElement;
          if (!el) return false;
          const isEditable = el.isContentEditable || (typeof el.value === 'string');
          if (!isEditable) return false;

          const fire = (type) => {
            const event = new KeyboardEvent(type, {
              key: 'Backspace',
              code: 'Backspace',
              location: 0,
              bubbles: true,
              cancelable: type !== 'keyup',
              composed: true
            });
            try {
              Object.defineProperty(event, 'keyCode', { get: () => 8 });
              Object.defineProperty(event, 'which', { get: () => 8 });
              Object.defineProperty(event, 'charCode', { get: () => 0 });
            } catch {}
            el.dispatchEvent(event);
          };

          const initialValue = el.isContentEditable ? null : (typeof el.value === 'string' ? String(el.value) : '');
          const initialStart = el.isContentEditable ? null : (typeof el.selectionStart === 'number' ? el.selectionStart : (initialValue ? initialValue.length : 0));
          const initialEnd = el.isContentEditable ? null : (typeof el.selectionEnd === 'number' ? el.selectionEnd : initialStart);

          fire('keydown');

          if (!el.isContentEditable) {
            const currentValue = typeof el.value === 'string' ? String(el.value) : '';
            const currentStart = typeof el.selectionStart === 'number' ? el.selectionStart : currentValue.length;
            const currentEnd = typeof el.selectionEnd === 'number' ? el.selectionEnd : currentStart;
            const handledByPage = currentValue !== initialValue || currentStart !== initialStart || currentEnd !== initialEnd;
            if (handledByPage) {
              fire('keyup');
              return true;
            }
          }

          const beforeInputEvt = new InputEvent('beforeinput', { inputType: 'deleteContentBackward', data: null, bubbles: true, cancelable: true });
          if (!el.dispatchEvent(beforeInputEvt)) {
            fire('keyup');
            return true;
          }

          let success = false;

          if (el.isContentEditable) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              if (!range.collapsed) {
                range.deleteContents();
              } else {
                range.setStart(range.startContainer, Math.max(0, range.startOffset - 1));
                range.deleteContents();
              }
              const inputEvt = new InputEvent('input', { inputType: 'deleteContentBackward', data: null, bubbles: true });
              el.dispatchEvent(inputEvt);
              document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
              success = true;
            }
          } else {
            if (initialStart === 0 && initialEnd === 0) {
              fire('keyup');
              return true;
            }
            const deleteStart = initialStart === initialEnd ? Math.max(0, initialStart - 1) : Math.min(initialStart, initialEnd);
            const deleteEnd = Math.max(initialStart, initialEnd);
            if (typeof el.setRangeText === 'function') {
              el.setRangeText('', deleteStart, deleteEnd, 'end');
            } else {
              const before = initialValue.slice(0, deleteStart);
              const after  = initialValue.slice(deleteEnd);
              el.value = before + after;
              const posFallback = before.length;
              if (typeof el.setSelectionRange === 'function') {
                el.setSelectionRange(posFallback, posFallback);
              } else {
                el.selectionStart = el.selectionEnd = posFallback;
              }
            }
            const inputEvt = new InputEvent('input', { inputType: 'deleteContentBackward', data: null, bubbles: true });
            el.dispatchEvent(inputEvt);
            document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
            success = true;
          }

          fire('keyup');
          return success;
        } catch(e) { return false; }
      })();
    `;
    try { await wv.executeJavaScript(js); } catch {}
  }, [getActiveWebview]);

  const injectArrowToWeb = useCallback(async (direction: KeyboardDirection) => {
    const wv = getActiveWebview();
    if (!wv) return;
    const js = `
      (function(dir){
        try {
          const el = document.activeElement;
          if (!el) return false;
          const isEditable = el.isContentEditable || (typeof el.value === 'string');
          if (!isEditable) return false;
          const moveBackward = dir === 'ArrowLeft';
          const key = moveBackward ? 'ArrowLeft' : 'ArrowRight';
          const keyCode = moveBackward ? 37 : 39;

          const fire = (type) => {
            const event = new KeyboardEvent(type, {
              key,
              code: key,
              location: 0,
              bubbles: true,
              cancelable: type !== 'keyup',
              composed: true
            });
            try {
              Object.defineProperty(event, 'keyCode', { get: () => keyCode });
              Object.defineProperty(event, 'which', { get: () => keyCode });
              Object.defineProperty(event, 'charCode', { get: () => 0 });
            } catch {}
            el.dispatchEvent(event);
          };

          fire('keydown');

          let success = false;

          if (el.isContentEditable) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              if (!sel.isCollapsed) {
                moveBackward ? sel.collapseToStart() : sel.collapseToEnd();
              }
              if (typeof sel.modify === 'function') {
                sel.modify('move', moveBackward ? 'backward' : 'forward', 'character');
              } else {
                const range = sel.getRangeAt(0);
                const node = range.startContainer;
                let offset = range.startOffset + (moveBackward ? -1 : 1);
                if (node.nodeType === Node.TEXT_NODE) {
                  const length = node.textContent?.length ?? 0;
                  offset = Math.max(0, Math.min(length, offset));
                  range.setStart(node, offset);
                  range.collapse(true);
                }
              }
              document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
              success = true;
            }
          } else {
            const length = el.value.length;
            const start = el.selectionStart ?? length;
            const end = el.selectionEnd ?? length;
            let pos;
            if (start !== end) {
              pos = moveBackward ? Math.min(start, end) : Math.max(start, end);
            } else {
              pos = moveBackward ? Math.max(0, start - 1) : Math.min(length, start + 1);
            }
            el.selectionStart = el.selectionEnd = pos;
            el.focus();
            document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
            success = true;
          }

          fire('keyup');
          return success;
        } catch (e) { return false; }
      })(${JSON.stringify(direction)});
    `;
    try { await wv.executeJavaScript(js); } catch {}
  }, [getActiveWebview]);

  // --- Toolbar event handlers ---
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
    setKbVisible(false);
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
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleInputFocus = useCallback((event: ReactFocusEvent<HTMLInputElement>) => {
    isEditingRef.current = true;
    setIsEditing(true);
    activeInputRef.current = 'url';
    event.target.select();
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleInputBlur = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    isEditingRef.current = false;
    setIsEditing(false);
    if (activeInputRef.current === 'url') activeInputRef.current = null;
    if (mode !== 'mobile') return;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      const isSoftKey = active && typeof active.closest === 'function' && active.closest('[data-soft-keyboard="true"]');
      if (isSoftKey || isEditableElement(active)) {
        return;
      }
      setKbVisible(false);
    });
  }, [mode, isEditableElement]);


  const handleModalInputPointerDown = useCallback((_: ReactPointerEvent<HTMLInputElement>) => {
    activeInputRef.current = 'modalTitle';
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleModalInputFocus = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    activeInputRef.current = 'modalTitle';
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleModalInputBlur = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    if (activeInputRef.current === 'modalTitle') activeInputRef.current = null;
    if (mode !== 'mobile') return;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      const isSoftKey = active && typeof active.closest === 'function' && active.closest('[data-soft-keyboard="true"]');
      if (isSoftKey || isEditableElement(active)) {
        return;
      }
      setKbVisible(false);
    });
  }, [mode, isEditableElement]);

  const handleModalUrlPointerDown = useCallback((_: ReactPointerEvent<HTMLInputElement>) => {
    activeInputRef.current = 'modalUrl';
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleModalUrlFocus = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    activeInputRef.current = 'modalUrl';
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleModalUrlBlur = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    if (activeInputRef.current === 'modalUrl') activeInputRef.current = null;
    if (mode !== 'mobile') return;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      const isSoftKey = active && typeof active.closest === 'function' && active.closest('[data-soft-keyboard="true"]');
      if (isSoftKey || isEditableElement(active)) {
        return;
      }
      setKbVisible(false);
    });
  }, [mode, isEditableElement]);

  const handleTorInputPointerDown = useCallback((_: ReactPointerEvent<HTMLInputElement>) => {
    activeInputRef.current = 'torContainer';
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleTorInputFocus = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    activeInputRef.current = 'torContainer';
    if (mode === 'mobile') setKbVisible(true);
  }, [mode]);

  const handleTorInputBlur = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    if (activeInputRef.current === 'torContainer') activeInputRef.current = null;
    if (mode !== 'mobile') return;
    requestAnimationFrame(() => {
      const active = document.activeElement;
      const isSoftKey = active && typeof active.closest === 'function' && active.closest('[data-soft-keyboard="true"]');
      if (isSoftKey || isEditableElement(active)) {
        return;
      }
      setKbVisible(false);
    });
  }, [mode, isEditableElement]);

  const containerStyle = useMemo(() => {
    if (isHtmlFullscreen) return styles.container;
    if (mode !== 'mobile') return styles.container;
    return {
      ...styles.container,
      paddingBottom: kbVisible ? KB_HEIGHT : 0,
      transition: 'padding-bottom 160ms ease'
    };
  }, [isHtmlFullscreen, kbVisible, mode]);

  const modalBackdropStyle = useMemo<CSSProperties>(() => {
    const base: CSSProperties = { ...styles.modalBackdrop, zIndex: 45 + (kbVisible ? 60 : 0) };
    if (mode === 'mobile') {
      return {
        ...base,
        alignItems: 'flex-start',
        paddingTop: 24,
        paddingBottom: 24,
        top: 0,
        bottom: kbVisible ? KB_HEIGHT : 0,
        transition: 'bottom 160ms ease'
      };
    }
    return base;
  }, [mode, kbVisible]);
  const tabsPanelBackdropStyle = useMemo<CSSProperties>(() => {
    const base: CSSProperties = { ...tabsPanelStyles.backdrop, zIndex: 55 + (kbVisible ? 60 : 0) };
    if (mode === 'mobile') {
      return {
        ...base,
        alignItems: 'flex-start',
        paddingTop: 0,
        paddingBottom: 0,
        top: 0,
        bottom: kbVisible ? KB_HEIGHT : 0,
        transition: 'bottom 160ms ease'
      };
    }
    return base;
  }, [mode, kbVisible]);



  useEffect(() => {
    const wv = getActiveWebview();
    if (!wv) return undefined;

    const script = `
      (function installMerezhyvoFocusBridge() {
        if (window.__mzrFocusBridgeInstalled) return;
        window.__mzrFocusBridgeInstalled = true;

        const nonTextTypes = new Set(['button','submit','reset','checkbox','radio','range','color','file','image','hidden']);
        const isEditable = (el) => {
          if (!el) return false;
          if (el.isContentEditable) return true;
          const tag = (el.tagName || '').toLowerCase();
          if (tag === 'textarea') return !el.disabled && !el.readOnly;
          if (tag === 'input') {
            const type = (el.getAttribute('type') || '').toLowerCase();
            if (nonTextTypes.has(type)) return false;
            return !el.disabled && !el.readOnly;
          }
          return false;
        };

        const notify = (active) => {
          try {
            console.info(active ? ${JSON.stringify(FOCUS_CONSOLE_ACTIVE)} : ${JSON.stringify(FOCUS_CONSOLE_INACTIVE)});
          } catch {}
        };

        const handleFocusIn = (event) => {
          if (isEditable(event.target)) notify(true);
        };

        const handleFocusOut = (event) => {
          if (!isEditable(event.target)) return;
          setTimeout(() => {
            notify(isEditable(document.activeElement));
          }, 0);
        };

        const handlePointerDown = (event) => {
          const target = event.target;
          if (isEditable(target)) {
            notify(true);
          } else {
            setTimeout(() => {
              notify(isEditable(document.activeElement));
            }, 0);
          }
        };

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

        const handleInput = (event) => {
          ensureFieldScroll(event.target);
        };

        const handleKeyup = (event) => {
          const key = event?.key;
          if (key === 'ArrowRight' || key === 'ArrowLeft' || key === 'End') {
            ensureFieldScroll(event.target);
          }
        };

        document.addEventListener('focusin', handleFocusIn, true);
        document.addEventListener('focusout', handleFocusOut, true);
        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('input', handleInput, true);
        document.addEventListener('keyup', handleKeyup, true);
      })();
    `;

    const install = () => {
      try {
        const result = wv.executeJavaScript(script, false);
        if (result && typeof result.then === 'function') {
          result.catch(() => {});
        }
      } catch {}
    };

    install();
    wv.addEventListener('dom-ready', install);
    wv.addEventListener('did-navigate', install);
    wv.addEventListener('did-navigate-in-page', install);
    wv.addEventListener('did-frame-finish-load', install);

    return () => {
      wv.removeEventListener('dom-ready', install);
      wv.removeEventListener('did-navigate', install);
      wv.removeEventListener('did-navigate-in-page', install);
      wv.removeEventListener('did-frame-finish-load', install);
    };
  }, [activeId, activeViewRevision, getActiveWebview]);

  useEffect(() => {
    const wv = getActiveWebview();
    if (!wv) return undefined;

    const handler = (event: { message?: string } | null) => {
      if (mode !== 'mobile') return;
      const message = event?.message;
      if (message === FOCUS_CONSOLE_ACTIVE) {
        setKbVisible(true);
        return;
      }
      if (message === FOCUS_CONSOLE_INACTIVE) {
        requestAnimationFrame(() => {
          const active = document.activeElement;
          const isSoftKey = active && typeof active.closest === 'function' && active.closest('[data-soft-keyboard="true"]');
          if (isSoftKey || isEditableElement(active)) {
            return;
          }
          setKbVisible(false);
        });
      }
    };

    wv.addEventListener('console-message', handler);
    return () => {
      wv.removeEventListener('console-message', handler);
    };
  }, [activeId, activeViewRevision, getActiveWebview, isEditableElement, mode]);



  const closeKeyboard = useCallback(() => {
    setKbVisible(false);
    activeInputRef.current = null;
    if (isEditingRef.current && inputRef.current) {
      try { inputRef.current.blur(); } catch {}
    }
    blurActiveInWebview();
  }, [blurActiveInWebview]);

  // --- Shortcut modal helpers ---
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
    setKbVisible(false);
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
        setKbVisible(false);
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
  }, [activeIdRef, closeTabAction, getCurrentViewUrl, loadInstalledApps, setBusy, setInstalledApps, setKbVisible, setMsg, setShortcutSuccessMsg, setShortcutCompleted, setShortcutUrl, shortcutUrl, title]);

  const sendKeyToWeb = useCallback(async (key: string) => {
    const activeTarget = activeInputRef.current;

    if (activeTarget === 'url' && inputRef.current) {
      const inputEl = inputRef.current;
      const value = inputEl.value ?? '';
      const rawStart = inputEl.selectionStart ?? value.length;
      const rawEnd = inputEl.selectionEnd ?? value.length;
      const selectionStart = Math.min(rawStart, rawEnd);
      const selectionEnd = Math.max(rawStart, rawEnd);
      const setCaret = (pos: number) => {
        setTimeout(() => {
          inputEl.selectionStart = inputEl.selectionEnd = pos;
        }, 0);
      };

      if (key === 'Backspace') {
        if (selectionStart === 0 && selectionEnd === 0) {
          if (kbShift && !kbCaps) setKbShift(false);
          return;
        }
        const deleteStart = selectionStart === selectionEnd ? Math.max(0, selectionStart - 1) : selectionStart;
        const nextValue = value.slice(0, deleteStart) + value.slice(selectionEnd);
        setInputValue(nextValue);
        setCaret(deleteStart);
      } else if (key === 'Enter') {
        const fake = { preventDefault: () => {} };
        handleSubmit(fake);
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const nextPos = key === 'ArrowLeft'
          ? (selectionStart !== selectionEnd ? selectionStart : Math.max(0, selectionStart - 1))
          : (selectionStart !== selectionEnd ? selectionEnd : Math.min(value.length, selectionEnd + 1));
        setCaret(nextPos);
      } else {
        const nextValue = value.slice(0, selectionStart) + key + value.slice(selectionEnd);
        const nextPos = selectionStart + key.length;
        setInputValue(nextValue);
        setCaret(nextPos);
      }
      if (kbShift && !kbCaps) setKbShift(false);
      return;
    }

    if (activeTarget === 'modalTitle' && modalTitleInputRef.current) {
      const inputEl = modalTitleInputRef.current;
      const value = inputEl.value ?? '';
      const rawStart = inputEl.selectionStart ?? value.length;
      const rawEnd = inputEl.selectionEnd ?? value.length;
      const selectionStart = Math.min(rawStart, rawEnd);
      const selectionEnd = Math.max(rawStart, rawEnd);
      const setCaret = (pos: number) => {
        setTimeout(() => {
          inputEl.selectionStart = inputEl.selectionEnd = pos;
        }, 0);
      };

      if (key === 'Backspace') {
        if (selectionStart === 0 && selectionEnd === 0) {
          if (kbShift && !kbCaps) setKbShift(false);
          return;
        }
        const deleteStart = selectionStart === selectionEnd ? Math.max(0, selectionStart - 1) : selectionStart;
        const nextValue = value.slice(0, deleteStart) + value.slice(selectionEnd);
        setTitle(nextValue);
        setCaret(deleteStart);
      } else if (key === 'Enter') {
        if (!busy) {
          createShortcut();
        }
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const nextPos = key === 'ArrowLeft'
          ? (selectionStart !== selectionEnd ? selectionStart : Math.max(0, selectionStart - 1))
          : (selectionStart !== selectionEnd ? selectionEnd : Math.min(value.length, selectionEnd + 1));
        setCaret(nextPos);
      } else {
        const nextValue = value.slice(0, selectionStart) + key + value.slice(selectionEnd);
        const nextPos = selectionStart + key.length;
        setTitle(nextValue);
        setCaret(nextPos);
      }
      if (kbShift && !kbCaps) setKbShift(false);
      return;
    }

    if (activeTarget === 'modalUrl' && modalUrlInputRef.current) {
      const inputEl = modalUrlInputRef.current;
      const value = inputEl.value ?? '';
      const rawStart = inputEl.selectionStart ?? value.length;
      const rawEnd = inputEl.selectionEnd ?? value.length;
      const selectionStart = Math.min(rawStart, rawEnd);
      const selectionEnd = Math.max(rawStart, rawEnd);
      const setCaret = (pos: number) => {
        setTimeout(() => {
          inputEl.selectionStart = inputEl.selectionEnd = pos;
        }, 0);
      };

      if (key === 'Backspace') {
        if (selectionStart === 0 && selectionEnd === 0) {
          if (kbShift && !kbCaps) setKbShift(false);
          return;
        }
        const deleteStart = selectionStart === selectionEnd ? Math.max(0, selectionStart - 1) : selectionStart;
        const nextValue = value.slice(0, deleteStart) + value.slice(selectionEnd);
        setShortcutUrl(nextValue);
        setCaret(deleteStart);
      } else if (key === 'Enter') {
        if (!busy) {
          createShortcut();
        }
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const nextPos = key === 'ArrowLeft'
          ? (selectionStart !== selectionEnd ? selectionStart : Math.max(0, selectionStart - 1))
          : (selectionStart !== selectionEnd ? selectionEnd : Math.min(value.length, selectionEnd + 1));
        setCaret(nextPos);
      } else {
        const nextValue = value.slice(0, selectionStart) + key + value.slice(selectionEnd);
        const nextPos = selectionStart + key.length;
        setShortcutUrl(nextValue);
        setCaret(nextPos);
      }
      if (kbShift && !kbCaps) setKbShift(false);
      return;
    }

    if (activeTarget === 'torContainer' && torContainerInputRef.current) {
      const inputEl = torContainerInputRef.current;
      const value = inputEl.value ?? '';
      const rawStart = inputEl.selectionStart ?? value.length;
      const rawEnd = inputEl.selectionEnd ?? value.length;
      const selectionStart = Math.min(rawStart, rawEnd);
      const selectionEnd = Math.max(rawStart, rawEnd);
      const setCaret = (pos: number) => {
        setTimeout(() => {
          inputEl.selectionStart = inputEl.selectionEnd = pos;
        }, 0);
      };

      if (key === 'Backspace') {
        if (selectionStart === 0 && selectionEnd === 0) {
          if (kbShift && !kbCaps) setKbShift(false);
          return;
        }
        const deleteStart = selectionStart === selectionEnd ? Math.max(0, selectionStart - 1) : selectionStart;
        const nextValue = value.slice(0, deleteStart) + value.slice(selectionEnd);
        setTorContainerDraft(nextValue);
        setCaret(deleteStart);
      } else if (key === 'Enter') {
        handleSaveTorContainer();
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const nextPos = key === 'ArrowLeft'
          ? (selectionStart !== selectionEnd ? selectionStart : Math.max(0, selectionStart - 1))
          : (selectionStart !== selectionEnd ? selectionEnd : Math.min(value.length, selectionEnd + 1));
        setCaret(nextPos);
      } else {
        const nextValue = value.slice(0, selectionStart) + key + value.slice(selectionEnd);
        const nextPos = selectionStart + key.length;
        setTorContainerDraft(nextValue);
        setCaret(nextPos);
      }
      if (kbShift && !kbCaps) setKbShift(false);
      return;
    }

    if (key === 'Backspace') {
      await injectBackspaceToWeb();
    } else if (key === 'Enter') {
      await injectTextToWeb('\n');
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      await injectArrowToWeb(key);
    } else {
      await injectTextToWeb(key);
    }
    if (kbShift && !kbCaps) setKbShift(false);
  }, [busy, createShortcut, handleSaveTorContainer, handleSubmit, injectArrowToWeb, injectBackspaceToWeb, injectTextToWeb, kbShift, kbCaps, setInputValue, setShortcutUrl, setTitle]);

  const handleShortcutPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleZoomSliderPointerDown = useCallback((event: ReactPointerEvent<HTMLInputElement>) => {
    event.stopPropagation();
  }, []);

  // --- Layout helpers for the keyboard ---
  const nextLayout = useCallback(() => {
    const order: KeyboardLayoutId[] = ['en', 'uk', 'symbols'];
    const index = order.indexOf(kbLayout);
    const nextIndex = index >= 0 ? (index + 1) % order.length : 0;
    const nextId = order[nextIndex] ?? 'en';
    setKbLayout(nextId);
  }, [kbLayout]);

  const toggleSymbols = useCallback(() => {
    setKbLayout((layout) => layout === 'symbols' ? 'en' : 'symbols');
  }, []);

  const toggleShift = useCallback(() => setKbShift((shift) => !shift), []);
  const toggleCaps = useCallback(() => setKbCaps((caps) => !caps), []);

  const openTabsPanel = useCallback(() => {
    if (!tabsReady) return;
    setShowTabsPanel(true);
    activeInputRef.current = null;
    blurActiveInWebview();
    if (mode === 'mobile') setKbVisible(false);
  }, [tabsReady, blurActiveInWebview, mode]);

  const closeTabsPanel = useCallback(() => {
    setShowTabsPanel(false);
    if (mode === 'mobile') setKbVisible(false);
  }, [mode]);

  const handleActivateTab = useCallback((id: string) => {
    if (!id) return;
    activateTabAction(id);
    setShowTabsPanel(false);
    blurActiveInWebview();
    if (mode === 'mobile') setKbVisible(false);
  }, [activateTabAction, blurActiveInWebview, mode]);

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
    if (mode === 'mobile') setKbVisible(false);
    requestAnimationFrame(() => {
      try { inputRef.current?.focus?.(); } catch {}
    });
  }, [mode, blurActiveInWebview, newTabAction]);

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
      {!isHtmlFullscreen && (
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

      <SoftKeyboard
        visible={mode === 'mobile' && kbVisible}
        height={KB_HEIGHT}
        layoutId={kbLayout}
        shift={kbShift}
        caps={kbCaps}
        onKey={sendKeyToWeb}
        onClose={closeKeyboard}
        onToggleShift={toggleShift}
        onToggleCaps={toggleCaps}
        onToggleSymbols={toggleSymbols}
        onNextLayout={nextLayout}
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
  const zoomRef = useRef<number>(mode === 'mobile' ? 2 : 1);
  const [zoomLevel, setZoomLevel] = useState<number>(zoomRef.current);

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
    setZoomClamped(base);
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
