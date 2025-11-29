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
import { SettingsModal } from './components/modals/settingsModal/SettingsModal';
import { TabsPanel } from './components/modals/tabsPanel/TabsPanel';
import { tabsPanelStyles } from './components/modals/tabsPanel/tabsPanelStyles';
import WebViewHost from './components/webview/WebViewHost';
import type { WebViewHandle, StatusState } from './components/webview/WebViewHost';
import { styles } from './styles/styles';
import BookmarksPage from './pages/bookmarks/BookmarksPage';
import HistoryPage from './pages/history/HistoryPage';
import LicensesPage from './pages/licenses/LicensesPage';
import PasswordsPage from './pages/passwords/PasswordsPage';
import PasswordCapturePrompt from './components/modals/PasswordCapturePrompt';
import PasswordUnlockModal, {
  type PasswordUnlockPayload
} from './components/modals/PasswordUnlockModal';
import { useMerezhyvoMode } from './hooks/useMerezhyvoMode';
import { useI18n } from './i18n/I18nProvider';
import { ipc } from './services/ipc/ipc';
import { torService } from './services/tor/tor';
import { windowHelpers } from './services/window/window';
import { useTabsStore, tabsActions, defaultTabUrl, getTabsState } from './store/tabs';
import KeyboardPane from './components/keyboard/KeyboardPane';
import type { LayoutId } from './components/keyboard/layouts';
import { nextLayoutId, LANGUAGE_LAYOUT_IDS } from './components/keyboard/layouts';
import type { GetWebview } from './components/keyboard/inject';
import { makeMainInjects, makeWebInjects, probeWebEditable } from './components/keyboard/inject';
import type {
  Mode,
  Tab,
  MessengerId,
  MessengerDefinition,
  MessengerSettings,
  PasswordStatus,
  PasswordPromptPayload,
  PasswordCaptureAction
} from './types/models';
import type { MerezhyvoAboutInfo } from './types/preload';
import { sanitizeMessengerSettings, resolveOrderedMessengers } from './shared/messengers';
import { setupHostRtlDirection } from './keyboard/hostRtl';
import { isCtxtExcludedSite } from './helpers/websiteCtxtExclusions';
import FileDialogHost from './components/fileDialog/FileDialog';
// import { PermissionPrompt } from './components/modals/permissions/PermissionPrompt';
// import { ToastCenter } from './components/notifications/ToastCenter';
import { bannedCountries } from './config/bannedCountries';

const DEFAULT_URL = defaultTabUrl;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.5;
const ZOOM_STEP = 0.1;

type StartParams = {
  url: string;
  hasStartParam: boolean;
};

type AppInfo = {
  name: string;
  version: string;
  description: string;
  chromium: string;
  electron: string;
  node: string;
  torVersion?: string | null;
};

type ActiveInputTarget = 'url' | null;

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

type SubmitEvent = FormEvent<HTMLFormElement> | { preventDefault: () => void } | undefined;

const WEBVIEW_BASE_CSS = `
  :root, html { color-scheme: dark; color:#0f111a; background:#e5e7eb; }
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
  node: '',
  torVersion: null
};

const SERVICE_OVERLAY_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(3, 8, 20, 0.96)',
  padding: '24px',
  overflow: 'auto',
  zIndex: 5
};

// const WEBVIEW_WRAPPER_STYLE: React.CSSProperties = {
//   position: 'relative',
//   flex: 1
// };

const parseStartUrl = (): StartParams => {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('start');
    const providedParam = params.get('startProvided');

    let url = DEFAULT_URL;
    let hasStartParam = false;
    if (raw) {
      try {
        url = decodeURIComponent(raw);
      } catch {
        url = raw;
      }
      const normalizedRaw = url.trim();
      const providedFlag = (providedParam || '').toLowerCase();
      const explicitlyProvided = ['1', 'true', 'yes'].includes(providedFlag);
      if (explicitlyProvided && normalizedRaw) {
        hasStartParam = true;
      } else if (!providedParam && normalizedRaw && normalizedRaw !== DEFAULT_URL) {
        // Backwards compatibility with builds that don't set startProvided.
        hasStartParam = true;
      }
    }

    return { url, hasStartParam };
  } catch {
    return { url: DEFAULT_URL, hasStartParam: false };
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

const MainBrowserApp: React.FC<MainBrowserAppProps> = ({ initialUrl, mode, hasStartParam }) => {
  const webviewHandleRef = useRef<WebViewHandle | null>(null);
  const webviewRef = useRef<WebviewTag | null>(null);
  const [activeViewRevision, setActiveViewRevision] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeInputRef = useRef<ActiveInputTarget>(null);
  const webviewReadyRef = useRef<boolean>(false);
  const { t } = useI18n();

  const { ready: tabsReady, tabs, activeId, activeTab } = useTabsStore();

  const [inputValue, setInputValue] = useState<string>(initialUrl);
  const [urlSuggestions, setUrlSuggestions] = useState<
    { url: string; title?: string | null; source: 'history' | 'bookmark' }[]
  >([]);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const isEditingRef = useRef<boolean>(false);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [status, setStatus] = useState<StatusState>('loading');
  const [webviewReady, setWebviewReady] = useState<boolean>(false);

  const [accessBlocked, setAccessBlocked] = useState<boolean>(false);
  const [showTabsPanel, setShowTabsPanel] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showUnlockModal, setShowUnlockModal] = useState<boolean>(false);
  const [unlockPayload, setUnlockPayload] = useState<PasswordUnlockPayload | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);
  const [pendingSettingsReopen, setPendingSettingsReopen] = useState(false);
  const [settingsScrollTarget, setSettingsScrollTarget] = useState<'passwords' | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<PasswordStatus | null>(null);
  const [passwordPrompt, setPasswordPrompt] = useState<PasswordPromptPayload | null>(null);
  const [passwordPromptBusy, setPasswordPromptBusy] = useState(false);
  const [globalToast, setGlobalToast] = useState<string | null>(null);
  const globalToastTimerRef = useRef<number | null>(null);
  const showGlobalToast = useCallback((message: string) => {
    setGlobalToast(message);
    if (globalToastTimerRef.current) {
      window.clearTimeout(globalToastTimerRef.current);
    }
    globalToastTimerRef.current = window.setTimeout(() => {
      setGlobalToast(null);
      globalToastTimerRef.current = null;
    }, 3200);
  }, []);
  const [torEnabled, setTorEnabled] = useState<boolean>(false);
  const [torKeepEnabled, setTorKeepEnabled] = useState<boolean>(false);
  const [torKeepEnabledDraft, setTorKeepEnabledDraft] = useState<boolean>(false);
  const [torConfigSaving, setTorConfigSaving] = useState<boolean>(false);
  const [torConfigFeedback, setTorConfigFeedback] = useState<string>('');
  const [torIp, setTorIp] = useState<string>('');
  const [torIpLoading, setTorIpLoading] = useState<boolean>(false);
  const [kbVisible, setKbVisible] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [zoomBarHeight, setZoomBarHeight] = useState<number>(0);
  const [enabledKbLayouts, setEnabledKbLayouts] = useState<LayoutId[]>(['en']);
  const [kbLayout, setKbLayout] = useState<LayoutId>('en');
  const [downloadsDefaultDir, setDownloadsDefaultDir] = useState<string>('');
  const [downloadsConcurrent, setDownloadsConcurrent] = useState<1 | 2 | 3>(2);
  const [downloadsSaving, setDownloadsSaving] = useState<boolean>(false);
  const [mainViewMode, setMainViewMode] = useState<'browser' | 'messenger'>('browser');
  const [messengerSettingsState, setMessengerSettingsState] = useState<MessengerSettings>(() => sanitizeMessengerSettings(null));
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const downloadToastTimerRef = useRef<number | null>(null);
  const downloadFileMapRef = useRef<Map<string, string>>(new Map());
  const completedDownloadsRef = useRef<Set<string>>(new Set());
  const messengerSettingsRef = useRef<MessengerSettings>(messengerSettingsState);
  const messengerTabIdsRef = useRef<Map<MessengerId, string>>(new Map());
  const prevBrowserTabIdRef = useRef<string | null>(null);
  const pendingMessengerTabIdRef = useRef<string | null>(null);
  const lastMessengerIdRef = useRef<MessengerId | null>(null);
  const [activeMessengerId, setActiveMessengerId] = useState<MessengerId | null>(null);
  const activeDownloadsRef = useRef<Set<string>>(new Set());
  const downloadIndicatorTimerRef = useRef<number | null>(null);
  const [downloadIndicatorState, setDownloadIndicatorState] = useState<
    'hidden' | 'active' | 'completed' | 'error'
  >('hidden');
  const [pageError, setPageError] = useState<{ url: string | null } | null>(null);
  const lastFailedUrlRef = useRef<string | null>(null);
  const ignoreUrlChangeRef = useRef(false);
  const bookmarksCacheRef = useRef<
    { url: string; title?: string | null; createdAt?: number; updatedAt?: number }[]
  >([]);
  const bookmarksCacheReadyRef = useRef(false);
  const clearDownloadIndicatorTimer = useCallback(() => {
    if (downloadIndicatorTimerRef.current) {
      window.clearTimeout(downloadIndicatorTimerRef.current);
      downloadIndicatorTimerRef.current = null;
    }
  }, []);
  const handleDownloadIndicatorClick = useCallback(() => {
    if (downloadIndicatorState === 'active') return;
    clearDownloadIndicatorTimer();
    setDownloadIndicatorState('hidden');
  }, [clearDownloadIndicatorTimer, downloadIndicatorState]);
  const [messengerOrderSaving, setMessengerOrderSaving] = useState<boolean>(false);
  const [messengerOrderMessage, setMessengerOrderMessage] = useState<string>('');
  const [uiScale, setUiScale] = useState<number>(1);

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

  const [aboutInfoFromMain, setAboutInfoFromMain] = useState<MerezhyvoAboutInfo | null>(null);

  useEffect(() => {
    let canceled = false;
    const fetchAboutInfo = async () => {
      try {
        const info = await window.merezhyvo?.about.getInfo();
        if (!canceled && info) {
          setAboutInfoFromMain(info);
        }
      } catch {
        if (!canceled) {
          setAboutInfoFromMain(null);
        }
      }
    };
    fetchAboutInfo();
    return () => {
      canceled = true;
    };
  }, []);

  const appInfo = useMemo<AppInfo>(() => {
    if (typeof window === 'undefined') return FALLBACK_APP_INFO;
    const info = window.merezhyvo?.appInfo as Partial<AppInfo> | undefined;
    const version = info?.version ?? FALLBACK_APP_INFO.version;
    const chromium =
      aboutInfoFromMain?.chromiumVersion ?? info?.chromium ?? FALLBACK_APP_INFO.chromium;
    const torVersion =
      aboutInfoFromMain?.torVersion ?? info?.torVersion ?? FALLBACK_APP_INFO.torVersion;
    return {
      name: info?.name ?? FALLBACK_APP_INFO.name,
      version,
      description: info?.description ?? FALLBACK_APP_INFO.description,
      chromium,
      electron: info?.electron ?? FALLBACK_APP_INFO.electron,
      node: info?.node ?? FALLBACK_APP_INFO.node,
      torVersion
    };
  }, [aboutInfoFromMain]);

  const tabsReadyRef = useRef<boolean>(tabsReady);
  const tabsRef = useRef<Tab[]>(tabs);
  const previousActiveTabRef = useRef<Tab | null>(activeTab ?? null);
  const webviewHostRef = useRef<HTMLDivElement | null>(null);
  const backgroundHostRef = useRef<HTMLDivElement | null>(null);
  const zoomBarRef = useRef<HTMLDivElement | null>(null);
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
  const torAutoStartGuardRef = useRef<boolean>(false);

  const isServiceTab = (tab: Tab): boolean => (tab.url ?? '').trim().toLowerCase().startsWith('mzr://');
  const pinnedTabs = useMemo(() => tabs.filter((tab) => tab.pinned && !isServiceTab(tab)), [tabs]);
  const regularTabs = useMemo(() => tabs.filter((tab) => !tab.pinned && !isServiceTab(tab)), [tabs]);
  const tabCount = pinnedTabs.length + regularTabs.length;
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
  const isYouTubeTab = useCallback((tabId: string) => {
    return tabsRef.current.some((tab) => tab.id === tabId && tab.isYouTube);
  }, []);
  useEffect(() => { previousActiveTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => {
    if (fullscreenTabRef.current && fullscreenTabRef.current !== activeId) {
      fullscreenTabRef.current = null;
      setIsHtmlFullscreen(false);
    }
  }, [activeId]);
  const handleDownloadsConcurrentChange = useCallback((value: 1 | 2 | 3) => {
    const clamped = Math.min(3, Math.max(1, value)) as 1 | 2 | 3;
    setDownloadsConcurrent(clamped);
  }, []);

  const handleSaveDownloadSettings = useCallback(async () => {
    if (downloadsSaving) return;
    setDownloadsSaving(true);
    try {
      await window.merezhyvo?.downloads?.settings.set?.({
        concurrent: downloadsConcurrent
      });
      setGlobalToast('Download settings saved.');
    } catch (err) {
      console.error('[merezhyvo] downloads settings save failed', err);
      setGlobalToast('Failed to save download settings.');
    } finally {
      setDownloadsSaving(false);
    }
  }, [downloadsConcurrent, downloadsSaving, setGlobalToast]);

  const UI_SCALE_STEP = 0.05;
  const applyUiScale = useCallback(async (raw: number) => {
    const rounded = Math.round(raw / UI_SCALE_STEP) * UI_SCALE_STEP;
    const clamped = Number(Math.max(0.5, Math.min(1.6, rounded)).toFixed(2));
    setUiScale(clamped);
    try {
      await window.merezhyvo?.ui?.set?.({ scale: clamped });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    try {
      root.style.setProperty('--ui-scale', String(uiScale));
    } catch {
      // noop
    }
  }, [uiScale]);

  const handleUiScaleReset = useCallback(() => {
    void applyUiScale(1);
  }, [applyUiScale]);

  const fallbackCopy = (text: string): boolean => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.left = '0';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  };

  const copyCommand = useCallback(
    async (command: string) => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(command);
        } else if (!fallbackCopy(command)) {
          throw new Error('copy failed');
        }
        showGlobalToast('Copied');
      } catch {
        showGlobalToast('Couldn\'t copy command');
      }
    },
    [showGlobalToast]
  );

  const downloadsCommand = window.merezhyvo?.paths?.downloadsSymlinkCommand ?? '';

  const handleCopyDownloadsCommand = useCallback(() => {
    const command = window.merezhyvo?.paths?.downloadsSymlinkCommand;
    if (!command) {
      setGlobalToast('Couldn\'t copy command');
      return;
    }
    void copyCommand(command);
  }, [copyCommand, setGlobalToast]);

  const handleCopyDocumentsCommand = useCallback(() => {
    const command = window.merezhyvo?.paths?.documentsSymlinkCommand;
    if (!command) {
      setGlobalToast('Couldn\'t copy command');
      return;
    }
    void copyCommand(command);
  }, [copyCommand, setGlobalToast]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey) return;
      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        void applyUiScale(uiScale + UI_SCALE_STEP);
      } else if (event.key === '-') {
        event.preventDefault();
        void applyUiScale(uiScale - UI_SCALE_STEP);
      } else if (event.key === '0') {
        event.preventDefault();
        handleUiScaleReset();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [applyUiScale, handleUiScaleReset, uiScale]);
  useEffect(() => {
    let cancelled = false;
    const loadSettingsState = async () => {
      try {
        const state = await ipc.settings.loadState();
        if (!state || cancelled) return;
        const keepEnabled = Boolean(state.tor?.keepEnabled);
        setTorKeepEnabled(keepEnabled);
        setTorKeepEnabledDraft(keepEnabled);
        const downloads = state.downloads ?? { defaultDir: '', concurrent: 2 };
        setDownloadsDefaultDir(downloads.defaultDir ?? '');
        setDownloadsConcurrent(
          downloads.concurrent === 1 || downloads.concurrent === 3 ? downloads.concurrent : 2
        );
        setUiScale(state.ui?.scale ?? 1);
      } catch {
        if (!cancelled) {
          setTorKeepEnabled(false);
          setTorKeepEnabledDraft(false);
          setDownloadsDefaultDir('');
          setDownloadsConcurrent(2);
          setUiScale(1);
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
    clearSelection: _clearSelection,
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

  const evaluateAccessRestriction = useCallback(async (ip?: string) => {
    try {
      const endpoint = ip && ip.trim().length ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) {
        setAccessBlocked(false);
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { country_code?: string };
      const country = typeof data.country_code === 'string' ? data.country_code.trim().toUpperCase() : '';
      setAccessBlocked(country ? bannedCountries.includes(country) : false);
    } catch {
      setAccessBlocked(false);
    }
  }, [setAccessBlocked]);

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
        evaluateAccessRestriction(ip);
      }
    } catch {
      if (torIpRequestRef.current === requestId) {
        setTorIp('');
        evaluateAccessRestriction();
      }
    } finally {
      if (torIpRequestRef.current === requestId) {
        setTorIpLoading(false);
      }
    }
  }, [evaluateAccessRestriction]);


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
      updateMetaAction(tabId, { isPlaying: false, discarded: true, keepAlive: false });
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
  }, [destroyTabView, updateMetaAction, updatePowerBlocker, isYouTubeTab]);

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
      ignoreUrlChangeRef.current = false;
      lastFailedUrlRef.current = null;
      setPageError(null);
      webviewReadyRef.current = false;
      setWebviewReady(false);
      if (mode === 'mobile') {
        setKbVisible(false);
      }
    } else if (nextStatus === 'ready') {
      setPageError(null);
      webviewReadyRef.current = true;
      setWebviewReady(true);
      refreshNavigationState();
    } else if (nextStatus === 'error') {
      const lastTried =
        lastLoadedRef.current.id === tabId ? lastLoadedRef.current.url?.trim() || null : null;
      const activeTabUrl = activeTabRef.current?.url?.trim() || null;
      const pickUrl = (candidate: string | null | undefined) =>
        candidate && !candidate.startsWith('data:') && !candidate.includes('dist-electron/main.js')
          ? candidate
          : null;
      const failedUrl =
        pickUrl(lastTried) ||
        pickUrl(activeTabUrl) ||
        pickUrl(inputValue) ||
        null;
      lastFailedUrlRef.current = failedUrl || null;
      setPageError({ url: failedUrl || null });
      webviewReadyRef.current = false;
      setWebviewReady(false);
    }
  }, [refreshNavigationState, updateMetaAction]);

  const handleHostUrlChange = useCallback((tabId: string, nextUrl: string) => {
    if (!nextUrl) return;
    if (ignoreUrlChangeRef.current) {
      const lowered = nextUrl.toLowerCase();
      if (
        lowered.startsWith('data:text/html') ||
        lowered.includes('dist-electron/main.js') ||
        lowered.startsWith('chrome-error://') ||
        lowered.includes('chromewebdata')
      ) {
        return;
      }
      ignoreUrlChangeRef.current = false;
    }
    const lowered = nextUrl.toLowerCase();
    if (
      lowered.startsWith('data:text/html') ||
      lowered.includes('dist-electron/main.js') ||
      lowered.startsWith('chrome-error://') ||
      lowered.includes('chromewebdata')
    ) {
      return;
    }
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

    // Inject long-press selection handlers for non-excluded sites
    (async () => {
      try {
        const url = typeof view.getURL === 'function' ? view.getURL() : '';
        if (url && isCtxtExcludedSite(url)) return;
        await ensureSelectionCssInjected();
      } catch {
        // ignore transient failures
      }
    })();
  }, [ensureSelectionCssInjected]);
  
  useEffect(() => {
    const run = async () => {
      try {
        const view = getActiveWebview();
        if (!view) return;
        const currentUrl = typeof view.getURL === 'function' ? view.getURL() : '';
        if (currentUrl && isCtxtExcludedSite(currentUrl)) return;
        await ensureSelectionCssInjected();
      } catch {
        // ignore transient failures
      }
    };
    void run();
  }, [activeViewRevision, ensureSelectionCssInjected, getActiveWebview]);

  const zoomRef = useRef(mode === 'mobile' ? 2.3 : 1.0);
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
    const stateBeforeExit = getTabsState();
    const activeBeforeExit = stateBeforeExit.tabs.find((tab) => tab.id === stateBeforeExit.activeId) ?? null;
    const shouldRestorePrevious =
      !activeBeforeExit || activeBeforeExit.kind === 'messenger';
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
    if (shouldRestorePrevious && previousId) {
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
  const openSettingsModal = useCallback(() => {
    activeInputRef.current = null;
    setShowSettingsModal(true);
    blurActiveInWebview();
  }, [blurActiveInWebview]);

  const closeSettingsModal = useCallback(() => {
    setShowSettingsModal(false);
    setSettingsScrollTarget(null);
    setPendingSettingsReopen(false);
  }, []);

  const handleOpenTorProjectLink = useCallback(() => {
    closeSettingsModal();
    newTabAction('https://www.torproject.org');
  }, [closeSettingsModal, newTabAction]);

  const fetchPasswordStatus = useCallback(async (): Promise<PasswordStatus | null> => {
    const api = window.merezhyvo?.passwords;
    if (!api) {
      setPasswordStatus(null);
      return null;
    }
    try {
      const info = await api.status();
      setPasswordStatus(info);
      return info;
    } catch {
      setPasswordStatus(null);
      return null;
    }
  }, []);

  const requestPasswordUnlock = useCallback(
    (fromSettings = false) => {
      closeSettingsModal();
      void fetchPasswordStatus();
      setUnlockPayload(null);
      setUnlockError(null);
      setShowUnlockModal(true);
      setPendingSettingsReopen(fromSettings);
    },
    [closeSettingsModal, fetchPasswordStatus]
  );

  useEffect(() => {
    const teardown = setupHostRtlDirection();
    return () => teardown();
  }, []);

  useEffect(() => {
    if (!showSettingsModal) {
      return undefined;
    }
    setTorKeepEnabledDraft(torKeepEnabled);
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
  }, [showSettingsModal, closeSettingsModal, torKeepEnabled, refreshTorIp]);

  const handleTorKeepChange = useCallback(
    (next: boolean) => {
      if (torConfigSaving) return;
      const previousKeep = torKeepEnabled;
      setTorKeepEnabledDraft(next);
      setTorConfigSaving(true);
      setTorConfigFeedback('');

      void (async () => {
        try {
          const result = await ipc.settings.setTorKeepEnabled(next);
          if (result?.ok) {
            const keep = Boolean(result.keepEnabled);
            setTorKeepEnabled(keep);
            setTorKeepEnabledDraft(keep);
            setTorConfigFeedback('Saved');
          } else {
            setTorKeepEnabled(previousKeep);
            setTorKeepEnabledDraft(previousKeep);
            setTorConfigFeedback(result?.error || 'Failed to update Tor preference.');
          }
        } catch (err) {
          setTorKeepEnabled(previousKeep);
          setTorKeepEnabledDraft(previousKeep);
          setTorConfigFeedback(String(err));
        } finally {
          setTorConfigSaving(false);
        }
      })();
    },
    [torKeepEnabled, torConfigSaving]
  );

  const handleToggleTor = useCallback(async () => {
    try {
      const state = await torService.toggle();
      if (!torEnabled && (!state || !state.enabled)) {
        const reason = state?.reason?.trim() || 'Tor failed to start.';
        showGlobalToast(reason);
      }
    } catch (err) {
      console.error('[Merezhyvo] tor toggle failed', err);
      showGlobalToast('Tor toggle failed.');
    }
  }, [torEnabled, showGlobalToast]);

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
    if (!torKeepEnabled || torEnabled) {
      torAutoStartGuardRef.current = false;
      return;
    }
    if (torAutoStartGuardRef.current) return;
    torAutoStartGuardRef.current = true;
    void (async () => {
      try {
        await torService.toggle();
      } catch (err) {
        console.error('[Merezhyvo] tor auto-start failed', err);
      } finally {
        torAutoStartGuardRef.current = false;
      }
    })();
  }, [torKeepEnabled, torEnabled]);

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

    const onFocusOut = () => {
      if (oskPressGuardRef.current) return;
      const active = document.activeElement as HTMLElement | null;
      if (!isEditableElement(active)) {
        setKbVisible(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
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

           // === Merezhyvo: custom <select> overlay for mobile ===
          (function(){
            try {
              if (window.__mzrSelectBridgeInstalled) return;
              window.__mzrSelectBridgeInstalled = true;

              var win = window;
              var overlayId = '__mzr_select_overlay';

              function resolveSelectFromEvent(ev){
                try {
                  var t = ev && ev.target;
                  if (!t) return null;
                  var el = t;
                  while (el && el.nodeType === 1) {
                    var tag = (el.tagName || '').toLowerCase();
                    if (tag === 'select') return el;
                    el = el.parentElement;
                  }
                } catch(_) {}
                return null;
              }

              function closeSelectOverlay(doc){
                try {
                  doc = doc || document;
                  var existing = doc.getElementById(overlayId);
                  if (existing && existing.parentNode) {
                    existing.parentNode.removeChild(existing);
                  }
                } catch(_) {}
              }

              function openSelectOverlay(el){
                if (!el || el.disabled) return;

                var doc = el.ownerDocument || document;
                var body = doc.body || doc.documentElement;
                var cs = win.getComputedStyle ? win.getComputedStyle(el) : null;
                var fg = cs ? cs.color : '#f9fafb';
                var bg = cs && cs.color ? cs.backgroundColor : '#111827';

                closeSelectOverlay(doc);

                var currentValue = el.value;

                var overlay = doc.createElement('div');
                overlay.id = overlayId;
                overlay.setAttribute('data-mzr', 'select-overlay');

                overlay.style.position = 'fixed';
                overlay.style.left = '0';
                overlay.style.top = '0';
                overlay.style.right = '0';
                overlay.style.bottom = '0';
                overlay.style.zIndex = '999999';
                overlay.style.background = 'rgba(0,0,0,0.35)';
                overlay.style.display = 'flex';
                overlay.style.alignItems = 'flex-end';
                overlay.style.justifyContent = 'center';

                var panel = doc.createElement('div');
                panel.style.maxHeight = '60vh';
                panel.style.width = '100%';
                panel.style.maxWidth = '480px';
                panel.style.margin = '0 8px 12px 8px';
                panel.style.borderRadius = '12px';
                panel.style.background = bg;
                panel.style.color = fg;
                panel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.45)';
                panel.style.overflowY = 'auto';
                panel.style.fontFamily =
                  'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

                var list = doc.createElement('div');
                list.style.padding = '4px 0';
                panel.appendChild(list);

                var opts = el.options || [];
                for (var i = 0; i < opts.length; i++) {
                  var opt = opts[i];
                  if (!opt) continue;
                  if (opt.disabled) continue;

                  var item = doc.createElement('button');
                  item.type = 'button';
                  item.textContent =
                    opt.textContent || opt.label || opt.value || '';
                  item.setAttribute('data-value', opt.value);

                  item.style.display = 'block';
                  item.style.width = '100%';
                  item.style.textAlign = 'left';
                  item.style.padding = '10px 14px';
                  item.style.border = '0';
                  item.style.outline = 'none';
                  item.style.background =
                    (opt.value === currentValue)
                      ? 'rgba(37,99,235,0.22)'
                      : 'transparent';
                  item.style.color = fg;
                  item.style.fontSize = '14px';
                  item.style.cursor = 'pointer';

                  item.addEventListener('click', (function(val){
                    return function(ev){
                      ev.preventDefault();
                      ev.stopPropagation();
                      try {
                        if (typeof el.focus === 'function') el.focus();
                      } catch(_) {}
                      try {
                        if (val !== el.value) {
                          el.value = val;
                          var inputEv = new Event('input', {
                            bubbles: true,
                            cancelable: false
                          });
                          var changeEv = new Event('change', {
                            bubbles: true,
                            cancelable: false
                          });
                          el.dispatchEvent(inputEv);
                          el.dispatchEvent(changeEv);
                          try {
                            if (typeof el.reportValidity === 'function') {
                              el.reportValidity();
                            }
                          } catch(_) {}
                        }
                      } catch(_) {}
                      closeSelectOverlay(doc);
                    };
                  })(opt.value));

                  list.appendChild(item);
                }

                overlay.addEventListener('click', function(ev){
                  if (ev.target === overlay) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    closeSelectOverlay(doc);
                  }
                });

                overlay.appendChild(panel);
                body.appendChild(overlay);

              }

              document.addEventListener('click', function(ev){
                var el = resolveSelectFromEvent(ev);
                if (!el) return;
                if (el.disabled) return;

                try {
                  if (ev.button != null && ev.button !== 0) return;
                } catch(_) {}

                ev.preventDefault();
                ev.stopPropagation();

                openSelectOverlay(el);
              }, true);
            } catch(e){}
          })();
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
  const navigateToUrl = useCallback(
    (raw: string) => {
      const handle = getActiveWebviewHandle();
      const view = (handle && typeof handle.getWebView === 'function')
        ? handle.getWebView()
        : getActiveWebview();
      if (!handle && !view) return;
      const target = normalizeAddress(raw);
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
    },
    [getActiveWebview, getActiveWebviewHandle, navigateActiveAction]
  );

  const handleSubmit = useCallback((event: SubmitEvent) => {
    event?.preventDefault?.();
    setPageError(null);
    lastFailedUrlRef.current = null;
    ignoreUrlChangeRef.current = false;
    navigateToUrl(inputValue);
  }, [inputValue, navigateToUrl]);

  const handleSuggestionSelect = useCallback(
    (url: string) => {
      if (!url) return;
      setUrlSuggestions([]);
      navigateToUrl(url);
    },
    [navigateToUrl]
  );

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

  const loadBookmarksCache = useCallback(async () => {
    if (bookmarksCacheReadyRef.current) {
      return bookmarksCacheRef.current;
    }
    const api = typeof window !== 'undefined' ? window.merezhyvo?.bookmarks : undefined;
    if (!api?.list) {
      bookmarksCacheReadyRef.current = true;
      bookmarksCacheRef.current = [];
      return [];
    }
    try {
      const tree = await api.list();
      const nodes = tree?.nodes ? Object.values(tree.nodes) : [];
      const bookmarks = nodes.filter((n) => n?.type === 'bookmark' && n.url?.trim());
      bookmarksCacheRef.current = bookmarks.map((b: any) => ({
        url: b.url as string,
        title: b.title,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt
      }));
    } catch {
      bookmarksCacheRef.current = [];
    } finally {
      bookmarksCacheReadyRef.current = true;
    }
    return bookmarksCacheRef.current;
  }, []);

  useEffect(() => {
    const onBookmarksChanged = () => {
      bookmarksCacheReadyRef.current = false;
      bookmarksCacheRef.current = [];
    };
    window.addEventListener('merezhyvo:bookmarks:changed', onBookmarksChanged);
    return () => {
      window.removeEventListener('merezhyvo:bookmarks:changed', onBookmarksChanged);
    };
  }, []);

  const fetchUrlSuggestions = useCallback(
    async (query: string) => {
      if (typeof window === 'undefined') {
        return;
      }
      if (!window.merezhyvo?.history && !window.merezhyvo?.bookmarks) {
        return;
      }
      const needle = query.trim();
      if (!needle) {
        setUrlSuggestions([]);
        return;
      }
      const normalizedNeedle = needle.toLowerCase();
      const apiHistory = window.merezhyvo?.history;
      let historyItems: { url: string; title?: string | null }[] = [];
      try {
        const result = await apiHistory?.query?.({ q: needle, limit: 20 });
        historyItems =
          result?.items?.map((item: any) => ({ url: item.url, title: item.title })) ?? [];
      } catch (err) {
        console.error('[suggestions] history query failed', err);
        historyItems = [];
      }

      let bookmarkItems:
        | { url: string; title?: string | null; createdAt?: number; updatedAt?: number }[]
        | [] = [];
      try {
        const cache = await loadBookmarksCache();
        bookmarkItems = cache.filter((entry) => {
          const haystack = `${entry.url} ${entry.title ?? ''}`.toLowerCase();
          return haystack.includes(normalizedNeedle);
        });
        bookmarkItems.sort((a, b) => {
          const aTs = a.updatedAt ?? a.createdAt ?? 0;
          const bTs = b.updatedAt ?? b.createdAt ?? 0;
          return bTs - aTs;
        });
      } catch (err) {
        console.error('[suggestions] bookmark scan failed', err);
        bookmarkItems = [];
      }

      const seen = new Set<string>();
      const combined: { url: string; title?: string | null; source: 'history' | 'bookmark' }[] =
        [];
      for (const item of historyItems) {
        const key = item.url;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        combined.push({ url: key, title: item.title, source: 'history' });
        if (combined.length >= 5) break;
      }
      if (combined.length < 5) {
        for (const bm of bookmarkItems) {
          const key = bm.url;
          if (!key || seen.has(key)) continue;
          seen.add(key);
          combined.push({ url: key, title: bm.title, source: 'bookmark' });
          if (combined.length >= 5) break;
        }
      }
      // If all entries share the same origin but the bare origin is missing, prepend it.
      if (combined.length > 0) {
        try {
          const first = new URL(combined[0].url);
          const baseOrigin = first.origin;
          const allSameOrigin = combined.every((item) => {
            try {
              return new URL(item.url).origin === baseOrigin;
            } catch {
              return false;
            }
          });
          const hasOriginEntry = combined.some((item) => {
            try {
              const parsed = new URL(item.url);
              return parsed.origin === baseOrigin && (parsed.pathname === '/' || parsed.pathname === '');
            } catch {
              return false;
            }
          });
          if (allSameOrigin && !hasOriginEntry && !seen.has(baseOrigin)) {
            combined.unshift({ url: baseOrigin, title: baseOrigin, source: 'history' });
            seen.add(baseOrigin);
            if (combined.length > 5) {
              combined.length = 5;
            }
          }
        } catch {
          // ignore malformed URLs
        }
      }
      setUrlSuggestions(combined);
    },
    [loadBookmarksCache]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const timer = window.setTimeout(() => {
      void fetchUrlSuggestions(inputValue);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [inputValue, fetchUrlSuggestions]);

  const handleKeyboardHeightChange = useCallback((height: number) => {
    setKeyboardHeight(height > 0 ? height : 0);
  }, []);

  useEffect(() => {
    const fileMap = downloadFileMapRef.current;
    const handler = (event: CustomEvent<{ id?: string; status: 'started' | 'completed' | 'failed'; file?: string }>) => {
      const detail = event.detail ?? {};
      const downloadId = typeof detail.id === 'string' && detail.id ? detail.id : null;
      if (downloadId && typeof detail.file === 'string' && detail.file) {
        fileMap.set(downloadId, detail.file);
      }
    };
    window.addEventListener('merezhyvo:download-status', handler as EventListener);
    return () => {
      window.removeEventListener('merezhyvo:download-status', handler as EventListener);
      fileMap.clear();
      if (downloadToastTimerRef.current) {
        window.clearTimeout(downloadToastTimerRef.current);
        downloadToastTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const activeSet = activeDownloadsRef.current;
    const handler = (event: CustomEvent<{ id?: string; state?: 'queued' | 'downloading' | 'completed' | 'failed' }>) => {
      const detail = event.detail ?? {};
      const targetId = typeof detail.id === 'string' && detail.id ? detail.id : '';
      const state = detail.state;
      if (!targetId || !state) return;
      const completedSet = completedDownloadsRef.current;
      const showFailureToast = () => {
        const stored = downloadFileMapRef.current.get(targetId) ?? '';
        const rawName = stored.split(/[\\/]/).pop() ?? stored;
        const fileName = rawName || 'Download';
        const text = `Download failed — ${fileName}`;
        if (downloadToastTimerRef.current) {
          window.clearTimeout(downloadToastTimerRef.current);
        }
        setDownloadToast(text);
        downloadToastTimerRef.current = window.setTimeout(() => {
          setDownloadToast(null);
          downloadToastTimerRef.current = null;
        }, 3200);
        downloadFileMapRef.current.delete(targetId);
      };
      if (state === 'downloading') {
        completedSet.delete(targetId);
      } else if (state === 'completed') {
        completedSet.add(targetId);
        downloadFileMapRef.current.delete(targetId);
      } else if (state === 'failed') {
        completedSet.delete(targetId);
      }
      if (state === 'downloading') {
        activeSet.add(targetId);
        clearDownloadIndicatorTimer();
        setDownloadIndicatorState('active');
        return;
      }
      if (state === 'completed' || state === 'failed') {
        activeSet.delete(targetId);
        if (activeSet.size > 0) return;
        clearDownloadIndicatorTimer();
        if (state === 'completed') {
          setDownloadIndicatorState('completed');
          downloadIndicatorTimerRef.current = window.setTimeout(() => {
            setDownloadIndicatorState('hidden');
            downloadIndicatorTimerRef.current = null;
          }, 10000);
        } else {
          showFailureToast();
          setDownloadIndicatorState('error');
        }
      }
    };

    const handleProgress = () => {
      if (activeSet.size > 0) {
        clearDownloadIndicatorTimer();
        setDownloadIndicatorState('active');
      }
    };

    window.addEventListener('merezhyvo:downloads:state', handler as EventListener);
    window.addEventListener('merezhyvo:downloads:progress', handleProgress as EventListener);
    return () => {
      window.removeEventListener('merezhyvo:downloads:state', handler as EventListener);
      window.removeEventListener('merezhyvo:downloads:progress', handleProgress as EventListener);
      clearDownloadIndicatorTimer();
      activeSet.clear();
      setDownloadIndicatorState('hidden');
    };
  }, [clearDownloadIndicatorTimer]);

  useEffect(() => {
    if (isHtmlFullscreen) {
      setZoomBarHeight(0);
      return;
    }
    const node = zoomBarRef.current;
    if (!node) {
      setZoomBarHeight(0);
      return;
    }
    const notify = () => {
      try {
        const rect = node.getBoundingClientRect();
        const next = Number.isFinite(rect.height) ? rect.height : 0;
        setZoomBarHeight(next > 0 ? next : 0);
      } catch {
        setZoomBarHeight(0);
      }
    };
    notify();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => notify());
      observer.observe(node);
      return () => {
        observer.disconnect();
        setZoomBarHeight(0);
      };
    }
    const id = window.setInterval(() => notify(), 200);
    return () => {
      window.clearInterval(id);
      setZoomBarHeight(0);
    };
  }, [isHtmlFullscreen, uiScale]);

  const containerStyle = useMemo(() => {
    return styles.container;
  }, []);

  const modalBackdropStyle = useMemo<CSSProperties>(() => {
    return { ...styles.modalBackdrop };
  }, []);

  const tabsPanelBackdropStyle = useMemo<CSSProperties>(() => {
    return { ...tabsPanelStyles.backdrop };
  }, []);
  const webviewHostHeight = useMemo(() => {
    if (!kbVisible) return '100%';
    const offset = Math.max(0, keyboardHeight);
    const zoomOffset = Math.max(0, zoomBarHeight);
    if (offset <= 0 && zoomOffset <= 0) return '100%';
    return `calc(100% - ${offset}px + ${zoomOffset}px - 10px)`;
  }, [kbVisible, keyboardHeight, zoomBarHeight]);
  const handleZoomSliderPointerDown = useCallback((event: ReactPointerEvent<HTMLInputElement>) => {
    event.stopPropagation();
  }, []);

  const focusTab = useCallback(
    (wanted: { tabId?: string; url?: string }) => {
      if (!wanted) return;

      // 1) Try by tabId
      if (wanted.tabId) {
        activateTabAction(wanted.tabId);
        return;
      }

      // 2) Fallback: find first tab with matching URL
      if (wanted.url) {
        const hit = tabs.find((t) => t.url === wanted.url);
        if (hit) {
          activateTabAction(hit.id);
        }
      }
    },
    [tabs, activateTabAction]
  );

  useEffect(() => {
    const onFocus = (e: Event) => {
      const detail = (e as CustomEvent<{ tabId?: string; url?: string }>).detail;
      focusTab(detail);
    };
    window.addEventListener('mzr-focus-tab' as unknown as keyof WindowEventMap, onFocus as EventListener);
    return () => {
      window.removeEventListener('mzr-focus-tab' as unknown as keyof WindowEventMap, onFocus as EventListener);
    };
  }, [focusTab]);

  useEffect(() => {
    const handleClose = (event: Event) => {
      const detail = (event as CustomEvent<{ webContentsId?: number; url?: string }>).detail ?? {};
      const targetId =
        typeof detail.webContentsId === 'number' && Number.isFinite(detail.webContentsId)
          ? detail.webContentsId
          : null;
      const currentTabs = tabsRef.current;
      if (targetId !== null) {
        for (const tab of currentTabs) {
          const entry = tabViewsRef.current.get(tab.id);
          const view = entry?.view ?? null;
          if (!view || typeof view.getWebContentsId !== 'function') continue;
          try {
            const wcId = view.getWebContentsId();
            if (wcId === targetId) {
              closeTabAction(tab.id);
              return;
            }
          } catch {
            // ignore
          }
        }
      }
      const targetUrl = typeof detail.url === 'string' ? detail.url.trim() : '';
      if (targetUrl) {
        const candidate = currentTabs.find((tab) => tab.url === targetUrl && !tab.pinned);
        if (candidate) {
          closeTabAction(candidate.id);
        }
      }
    };
    window.addEventListener('mzr-close-tab' as unknown as keyof WindowEventMap, handleClose as EventListener);
    return () => {
      window.removeEventListener('mzr-close-tab' as unknown as keyof WindowEventMap, handleClose as EventListener);
    };
  }, [closeTabAction]);

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      const detail = (event as CustomEvent<PasswordPromptPayload>).detail;
      setPasswordPrompt(detail);
    };
    window.addEventListener('merezhyvo:pw:prompt', handlePrompt as EventListener);
    return () => window.removeEventListener('merezhyvo:pw:prompt', handlePrompt as EventListener);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PasswordUnlockPayload>).detail ?? null;
      void fetchPasswordStatus();
      setUnlockPayload(detail);
      setUnlockError(null);
      setShowUnlockModal(true);
    };
    window.addEventListener('merezhyvo:pw:unlock-required', handler as EventListener);
    return () => window.removeEventListener('merezhyvo:pw:unlock-required', handler as EventListener);
  }, [fetchPasswordStatus]);

  useEffect(() => {
    return () => {
      if (globalToastTimerRef.current) {
        window.clearTimeout(globalToastTimerRef.current);
        globalToastTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    void fetchPasswordStatus();
  }, [fetchPasswordStatus]);

  const handlePasswordPromptAction = useCallback(
    async (action: PasswordCaptureAction) => {
      if (!passwordPrompt) return;
      const api = window.merezhyvo?.passwords;
      if (!api) {
        showGlobalToast('Unable to reach passwords service');
        return;
      }
      setPasswordPromptBusy(true);
      try {
        const result = await api.captureAction({
          captureId: passwordPrompt.captureId,
          action,
          entryId: passwordPrompt.entryId
        });
        if (result?.ok) {
          if (action === 'update') {
            showGlobalToast('Password updated');
          } else if (action === 'never') {
            showGlobalToast('This site will not ask again');
          } else {
            showGlobalToast('Password saved');
          }
          setPasswordPrompt(null);
        } else {
          showGlobalToast(result?.error ?? 'Unable to save password');
        }
      } catch {
        showGlobalToast('Unable to save password');
      } finally {
        setPasswordPromptBusy(false);
      }
    },
    [passwordPrompt, showGlobalToast]
  );

  const handlePasswordPromptClose = useCallback(() => {
    setPasswordPrompt(null);
    setPasswordPromptBusy(false);
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

  const openInNewTab = useCallback(
    (url: string) => {
      newTabAction(url);
      setShowTabsPanel(false);
      blurActiveInWebview();
    },
    [newTabAction, blurActiveInWebview]
  );

  const openInActiveTab = useCallback(
    (url: string) => {
      navigateActiveAction(url);
      setShowTabsPanel(false);
      blurActiveInWebview();
    },
    [navigateActiveAction, blurActiveInWebview]
  );

  const openBookmarksPage = useCallback(() => openInNewTab('mzr://bookmarks'), [openInNewTab]);
  const openHistoryPage = useCallback(() => openInNewTab('mzr://history'), [openInNewTab]);
  const openPasswordsFromSettings = useCallback(() => {
    closeSettingsModal();
    openInNewTab('mzr://passwords');
  }, [closeSettingsModal, openInNewTab]);
  const openLicensesPage = useCallback(() => openInNewTab('mzr://licenses'), [openInNewTab]);
  const openLicensesFromSettings = useCallback(() => {
    closeSettingsModal();
    openLicensesPage();
  }, [closeSettingsModal, openLicensesPage]);

  const closeUnlockModal = useCallback(() => {
    setShowUnlockModal(false);
    setUnlockError(null);
  }, []);

  const handlePasswordUnlock = useCallback(
    async (master: string, durationMinutes?: number) => {
      const api = window.merezhyvo?.passwords;
      if (!api) {
        setUnlockError(t('passwordUnlock.error.unavailable'));
        return false;
      }
      setUnlockSubmitting(true);
      setUnlockError(null);
      try {
        const result = await api.unlock(master, durationMinutes);
    if (result?.ok) {
      await fetchPasswordStatus();
      setShowUnlockModal(false);
      setUnlockPayload(null);
      if (pendingSettingsReopen) {
        setPendingSettingsReopen(false);
        setSettingsScrollTarget('passwords');
        setTimeout(() => {
          openSettingsModal();
        }, 0);
      }
      window.dispatchEvent(new CustomEvent('merezhyvo:pw:unlocked'));
      return true;
    }
        setUnlockError(t('passwordUnlock.error.invalid'));
        return false;
      } catch (err) {
        setUnlockError(t('passwordUnlock.error.generic'));
        return false;
      } finally {
        setUnlockSubmitting(false);
      }
    },
    [fetchPasswordStatus, pendingSettingsReopen, openSettingsModal, t]
  );

  const handleCloseTab = useCallback((id: string) => {
    if (!id) return;
    closeTabAction(id);
  }, [closeTabAction]);

  const serviceUrl = (activeTab?.url ?? '').trim().toLowerCase();
  const isBookmarksService = serviceUrl.startsWith('mzr://bookmarks');
  const isHistoryService = serviceUrl.startsWith('mzr://history');
  const isPasswordsService = serviceUrl.startsWith('mzr://passwords');
  const isLicensesService = serviceUrl.startsWith('mzr://licenses');
  const showServiceOverlay =
    mainViewMode === 'browser' &&
    (isBookmarksService || isHistoryService || isPasswordsService || isLicensesService);
  let serviceContent = null;
  if (showServiceOverlay) {
    if (isBookmarksService) {
      serviceContent = <BookmarksPage mode={mode} openInTab={openInActiveTab} openInNewTab={openInNewTab} />;
    } else if (isHistoryService) {
      serviceContent = <HistoryPage mode={mode} openInTab={openInActiveTab} openInNewTab={openInNewTab} />;
    } else if (isPasswordsService) {
      serviceContent = <PasswordsPage mode={mode} openInTab={openInActiveTab} openInNewTab={openInNewTab} />;
    } else if (isLicensesService) {
      serviceContent = <LicensesPage mode={mode} />;
    }
  }

  const handleCleanCloseTab = useCallback(async (id: string) => {
    if (!id) return false;
    const tab = tabs.find((item) => item.id === id) ?? null;
    const url = tab?.url?.trim() ?? '';
    let webContentsId: number | null = null;
    try {
      const entry = tabViewsRef.current.get(id);
      const view = entry?.view ?? null;
      if (view && typeof view.getWebContentsId === 'function') {
        const maybeId = view.getWebContentsId();
        if (typeof maybeId === 'number' && Number.isFinite(maybeId)) {
          webContentsId = maybeId;
        }
      }
    } catch {
      webContentsId = null;
    }
    try {
      if (url) {
        const result = await ipc.tabs.cleanData({
          url,
          webContentsId: typeof webContentsId === 'number' ? webContentsId : undefined
        });
        try {
          const parsed = new URL(url);
          const origin = `${parsed.protocol}//${parsed.host}`;
          await window.merezhyvo?.history?.remove?.({ origin });
        } catch {
          // ignore parse/remove errors
        }
        closeTabAction(id);
        return Boolean(result?.ok);
      }
      closeTabAction(id);
      return true;
    } catch {
      closeTabAction(id);
      return false;
    }
  }, [tabs, closeTabAction]);

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
  const tabLoadingOverlay = status === 'error'
    ? null
    : activeTabIsLoading
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
  const webviewVisibility = status === 'error' ? 'hidden' : 'visible';

  const errorOverlay = pageError && status === 'error' ? (
    <div
      style={{
        ...styles.webviewErrorOverlay,
        ...(mode === 'mobile' ? styles.webviewErrorOverlayMobile : null)
      }}
      role="alert"
      aria-live="assertive"
    >
      <div
        style={{
          ...styles.webviewErrorTitle,
          ...(mode === 'mobile' ? styles.webviewErrorTitleMobile : null)
        }}
      >
        {t('webview.error.title')}
      </div>
      <div
        style={{
          ...styles.webviewErrorSubtitle,
          ...(mode === 'mobile' ? styles.webviewErrorSubtitleMobile : null)
        }}
      >
        {t('webview.error.subtitle')}
        {pageError.url ? (
          <div
            style={{
              ...styles.webviewErrorUrl,
              ...(mode === 'mobile' ? styles.webviewErrorUrlMobile : null)
            }}
            title={pageError.url}
          >
            {pageError.url}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => {
          setPageError(null);
          lastFailedUrlRef.current = null;
          ignoreUrlChangeRef.current = false;
          handleReload();
        }}
        style={{
          ...styles.webviewErrorButton,
          ...(mode === 'mobile' ? styles.webviewErrorButtonMobile : null)
        }}
      >
        {t('webview.error.retry')}
      </button>
    </div>
  ) : null;

  useEffect(() => {
    if (mode !== 'mobile') return;
    setKbVisible(false);
  }, [mode, activeId, mainViewMode]);

  useEffect(() => {
    if (status !== 'error' || !pageError) return;
    const view = webviewRef.current;
    if (!view) return;
    const title = t('webview.error.title');
    const subtitle = t('webview.error.subtitle');
    const urlDisplayValue = pageError.url || lastFailedUrlRef.current || '';
    const urlDisplay = urlDisplayValue
      ? `<div style="margin-top:12px;padding:10px 14px;border-radius:12px;background:rgba(15,23,42,0.7);border:1px solid rgba(148,163,184,0.4);font-size:14px;word-break:break-all;color:#f8fafc;">${urlDisplayValue}</div>`
      : '';
    const reloadLabel = t('webview.error.retry');
    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <style>
          :root {
            color-scheme: dark;
          }
          body {
            margin:0;
            min-height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            background: radial-gradient(circle at 20% 20%, rgba(37,156,235,0.08), rgba(5,7,15,0.9));
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color:#e2e8f0;
            padding:20px;
            text-align:center;
          }
          .card {
            max-width: 640px;
            width: 100%;
            background: rgba(5,7,15,0.65);
            border: 1px solid rgba(148,163,184,0.35);
            border-radius: 18px;
            padding: 28px;
            box-shadow: 0 14px 42px rgba(0,0,0,0.35);
          }
          h1 {
            margin: 0 0 12px;
            font-size: 22px;
            color: #f8fafc;
          }
          p {
            margin: 0;
            font-size: 15px;
            line-height: 1.6;
            color: rgba(226,232,240,0.85);
          }
          button {
            margin-top: 18px;
            padding: 12px 18px;
            border-radius: 12px;
            border: 1px solid rgba(37,156,235,0.9);
            background: rgba(37,156,235,0.16);
            color: #f8fafc;
            font-size: 15px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>${title}</h1>
          <p>${subtitle}</p>
          ${urlDisplay}
          <button onclick="location.reload()">${reloadLabel}</button>
        </div>
      </body>
      </html>
    `;
    try {
      ignoreUrlChangeRef.current = true;
      view.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    } catch {
      // ignore
    }
  }, [pageError, status, t]);

  const toolbarRef = useRef<HTMLDivElement>(null!);
  const messengerToolbarRef = useRef<HTMLDivElement>(null!);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [messengerToolbarHeight, setMessengerToolbarHeight] = useState(0);
  useEffect(() => {
    if (isHtmlFullscreen) {
      setToolbarHeight(0);
      return undefined;
    }
    const node = toolbarRef.current;
    if (!node) {
      setToolbarHeight(0);
      return;
    }
    const update = () => {
      try {
        const rect = node.getBoundingClientRect();
        setToolbarHeight(rect.height || 0);
      } catch {
        setToolbarHeight(0);
      }
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => update());
      observer.observe(node);
      return () => {
        observer.disconnect();
        setToolbarHeight(0);
      };
    }
    const id = window.setInterval(update, 200);
    return () => {
      window.clearInterval(id);
      setToolbarHeight(0);
    };
  }, [mode, uiScale, mainViewMode, isHtmlFullscreen]);

  useEffect(() => {
    if (isHtmlFullscreen) {
      setMessengerToolbarHeight(0);
      return undefined;
    }
    const node = messengerToolbarRef.current;
    if (!node) {
      setMessengerToolbarHeight(0);
      return;
    }
    const update = () => {
      try {
        const rect = node.getBoundingClientRect();
        setMessengerToolbarHeight(rect.height || 0);
      } catch {
        setMessengerToolbarHeight(0);
      }
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => update());
      observer.observe(node);
      return () => {
        observer.disconnect();
        setMessengerToolbarHeight(0);
      };
    }
    const id = window.setInterval(update, 200);
    return () => {
      window.clearInterval(id);
      setMessengerToolbarHeight(0);
    };
  }, [mode, uiScale, mainViewMode, isHtmlFullscreen]);

  const keyboardOffset = kbVisible ? Math.max(0, keyboardHeight) : 0;
  const contentTop = mainViewMode === 'messenger' ? messengerToolbarHeight : toolbarHeight;
  const contentBottom = kbVisible ? keyboardOffset : zoomBarHeight;
  const contentStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'absolute',
      top: `${contentTop}px`,
      bottom: `${contentBottom}px`,
      left: 0,
      right: 0,
      overflow: 'hidden'
    }),
    [contentTop, contentBottom]
  );

  if (accessBlocked) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          margin: 0,
          padding: 0,
          background: 'linear-gradient(180deg, #0057b7 50%, #ffd700 50%)'
        }}
      />
    );
  }

  return (
    <div style={containerStyle} className={`app app--${mode}`}>
      <div id="chromeScaleComp">
        <div id="chromeRoot">
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
              inputFocused={isEditing}
              onBack={handleBack}
              onForward={handleForward}
              onReload={handleReload}
              onSubmit={handleSubmit}
              onInputChange={(value) => setInputValue(value)}
              onInputPointerDown={handleInputPointerDown}
              onInputFocus={handleInputFocus}
              onInputBlur={handleInputBlur}
              onOpenTabsPanel={openTabsPanel}
              onToggleTor={handleToggleTor}
              onOpenSettings={openSettingsModal}
              onEnterMessengerMode={handleEnterMessengerMode}
              downloadIndicatorState={downloadIndicatorState}
              onDownloadIndicatorClick={handleDownloadIndicatorClick}
              toolbarRef={toolbarRef}
              suggestions={urlSuggestions}
              onSelectSuggestion={handleSuggestionSelect}
            />
          )}

          {!isHtmlFullscreen && mainViewMode === 'messenger' && (
            <MessengerToolbar
              mode={mode}
              messengers={orderedMessengers}
              activeMessengerId={activeMessengerId}
              onSelectMessenger={handleMessengerSelect}
              onExit={exitMessengerMode}
              toolbarRef={messengerToolbarRef}
            />
          )}

          {!isHtmlFullscreen && (
            <ZoomBar
              ref={zoomBarRef}
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
              onCleanClose={handleCleanCloseTab}
              onCloseTab={handleCloseTab}
              onOpenBookmarks={openBookmarksPage}
              onOpenHistory={openHistoryPage}
              displayTitle={displayTitleForTab}
              displaySubtitle={displaySubtitleForTab}
              fallbackInitial={fallbackInitialForTab}
            />
          )}

          {showSettingsModal && (
            <SettingsModal
              mode={mode}
              backdropStyle={modalBackdropStyle}
              appInfo={appInfo}
              torEnabled={torEnabled}
              torCurrentIp={torIp}
              torIpLoading={torIpLoading}
              torKeepEnabledDraft={torKeepEnabledDraft}
              torConfigSaving={torConfigSaving}
              torConfigFeedback={torConfigFeedback}
              onTorKeepChange={handleTorKeepChange}
              onClose={closeSettingsModal}
              onOpenPasswords={openPasswordsFromSettings}
              messengerItems={orderedMessengers}
              messengerOrderSaving={messengerOrderSaving}
              messengerOrderMessage={messengerOrderMessage}
              onMessengerMove={handleMessengerMove}
              onRequestPasswordUnlock={requestPasswordUnlock}
              scrollToSection={settingsScrollTarget}
              onScrollSectionHandled={() => setSettingsScrollTarget(null)}
              onOpenLicenses={openLicensesFromSettings}
              downloadsDefaultDir={downloadsDefaultDir}
              downloadsConcurrent={downloadsConcurrent}
              downloadsSaving={downloadsSaving}
              onDownloadsConcurrentChange={handleDownloadsConcurrentChange}
              onDownloadsSave={handleSaveDownloadSettings}
              onCopyDownloadsCommand={handleCopyDownloadsCommand}
              downloadsCommand={downloadsCommand}
              uiScale={uiScale}
              onUiScaleChange={applyUiScale}
              onUiScaleReset={handleUiScaleReset}
              onOpenTorLink={handleOpenTorProjectLink}
            />
          )}

          <PasswordCapturePrompt
            open={Boolean(passwordPrompt)}
            mode={mode}
            payload={passwordPrompt}
            busy={passwordPromptBusy}
            onAction={handlePasswordPromptAction}
            onClose={handlePasswordPromptClose}
          />

          <PasswordUnlockModal
            open={showUnlockModal}
            mode={mode}
            payload={unlockPayload ?? undefined}
            onClose={closeUnlockModal}
            onUnlock={handlePasswordUnlock}
            error={unlockError}
            submitting={unlockSubmitting}
            defaultDuration={passwordStatus?.autoLockMinutes ?? 15}
          />

      {globalToast && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: mode === 'mobile' ? '110px' : '70px',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#fff',
            padding: mode === 'mobile' ? '34px 32px' : '10px 20px',
            borderRadius: '999px',
            fontSize: mode === 'mobile' ? '34px' : '16px',
            zIndex: 5000,
            maxWidth: '80vw',
            textAlign: 'center'
          }}
        >
          {globalToast}
        </div>
      )}
      {downloadToast && (
        <div style={styles.downloadToast}>{downloadToast}</div>
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
            onHeightChange={handleKeyboardHeightChange}
          />
      <FileDialogHost mode={mode} onCopyCommand={handleCopyDocumentsCommand} />
        </div>
      </div>

      <div id="contentRoot" style={contentStyle}>
        {/* <div style={WEBVIEW_WRAPPER_STYLE}> */}
          <WebViewPane
            webviewHostRef={webviewHostRef}
            backgroundHostRef={backgroundHostRef}
            webviewStyle={styles.webviewMount}
            webviewHostStyle={{
              // ...styles.webviewHost,
              height: webviewHostHeight,
              visibility: webviewVisibility
            }}
            backgroundStyle={styles.backgroundShelf}
            overlay={tabLoadingOverlay}
          />
          {errorOverlay}
          {serviceContent && (
            <div style={SERVICE_OVERLAY_STYLE} className="service-scroll">
              {serviceContent}
            </div>
          )}
        {/* </div> */}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const { url: parsedStartUrl, hasStartParam } = useMemo(() => parseStartUrl(), []);
  const initialUrl = useMemo(() => normalizeAddress(parsedStartUrl), [parsedStartUrl]);
  const mode = useMerezhyvoMode();

  return (
    <MainBrowserApp
      initialUrl={initialUrl}
      mode={mode}
      hasStartParam={hasStartParam}
    />
  );
};

export default App;
