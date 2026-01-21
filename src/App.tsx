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
import Toolbar from './components/toolbar/Toolbar';
import { MessengerToolbar } from './components/messenger/MessengerToolbar';
import WebViewPane from './components/webview/WebViewPane';
import ZoomBar from './components/zoom/ZoomBar';
import { SettingsModal } from './components/modals/settingsModal/SettingsModal';
import { TabsPanel } from './components/modals/tabsPanel/TabsPanel';
import { tabsPanelStyles } from './components/modals/tabsPanel/tabsPanelStyles';
import CouponsFloatingButton from './components/coupons/CouponsFloatingButton';
import CouponsPopup from './components/coupons/CouponsPopup';
import type { WebViewHandle, StatusState } from './components/webview/WebViewHost';
import { styles } from './styles/styles';
import { getThemeVars } from './styles/theme';
import BookmarksPage from './pages/bookmarks/BookmarksPage';
import HistoryPage from './pages/history/HistoryPage';
import LicensesPage from './pages/licenses/LicensesPage';
import PasswordsPage from './pages/passwords/PasswordsPage';
import SecurityExceptionsPage from './pages/security/SecurityExceptionsPage';
import SiteDataPage from './pages/siteData/SiteDataPage';
import PrivacyInfoPage from './pages/privacy/PrivacyInfoPage';
import CouponsInfoPage from './pages/coupons/CouponsInfoPage';
import StartPage from './pages/start/StartPage';
import NetworkInfoPage from './pages/networkInfo/NetworkInfoPage';
import PasswordCapturePrompt from './components/modals/PasswordCapturePrompt';
import PasswordUnlockModal from './components/modals/PasswordUnlockModal';
import TorDisableDialog from './components/modals/TorDisableDialog';
import TorKeepEnabledDialog from './components/modals/TorKeepEnabledDialog';
import { useMerezhyvoMode } from './hooks/useMerezhyvoMode';
import { useDownloadIndicators } from './hooks/useDownloadIndicators';
import { useAppInfo } from './hooks/useAppInfo';
import { useGlobalToast } from './hooks/useGlobalToast';
import { useHttpsSecurity } from './hooks/useHttpsSecurity';
import { useCookiePrivacy } from './hooks/useCookiePrivacy';
import { useCoupons } from './hooks/useCoupons';
import { useMobileSoftKeyboard } from './hooks/useMobileSoftKeyboard';
import { useUrlSuggestions } from './hooks/useUrlSuggestions';
import { useToolbarHeights } from './hooks/useToolbarHeights';
import { useMessengerMode } from './hooks/useMessengerMode';
import { usePasswordFlows } from './hooks/usePasswordFlows';
import { usePowerBlocker } from './hooks/usePowerBlocker';
import { useTabDestroy } from './hooks/useTabDestroy';
import { useTabRefs } from './hooks/useTabRefs';
import { useTrackerBlocking } from './hooks/useTrackerBlocking';
import { useWebviewMounts } from './hooks/useWebviewMounts';
import { useWebviewListeners } from './hooks/useWebviewListeners';
import { useTabViewLifecycle } from './hooks/useTabViewLifecycle';
import ContextMenuPanel from './components/context-menu/ContextMenuPanel';
import { JsDialogHost } from './components/modals/jsDialog/JsDialogHost';
import { useI18n } from './i18n/I18nProvider';
import { ipc } from './services/ipc/ipc';
import { torService } from './services/tor/tor';
import { windowHelpers } from './services/window/window';
import { getTabsState, useTabsStore, tabsActions } from './store/tabs';
import { DEFAULT_URL, normalizeAddress, normalizeNavigationTarget, parseStartUrl, toHttpUrl } from './utils/navigation';
import { deriveErrorType, HTTP_ERROR_TYPE, isLikelyCertError, isSubdomainOrSame, normalizeHost } from './utils/security';
import { useTorSettings } from './hooks/useTorSettings';
import KeyboardPane from './components/keyboard/KeyboardPane';
import { nextLayoutId } from './components/keyboard/layouts';
import type { GetWebview } from './components/keyboard/inject';
import { makeMainInjects, makeWebInjects, probeWebEditable } from './components/keyboard/inject';
import type {
  Mode,
  Tab,
  MessengerId,
  CertificateInfo,
  HttpsMode,
  SslException,
  WebrtcMode,
  CookiePrivacySettings,
  CookieBlockStatus,
  ThemeName,
  SecureDnsMode,
  SecureDnsProvider,
  SecureDnsSettings
} from './types/models';
import type { ContextMenuState } from './types/preload';
import type { NavigationState } from './types/navigation';
import { sanitizeMessengerSettings } from './shared/messengers';
import { setupHostRtlDirection } from './keyboard/hostRtl';
import { isCtxtExcludedSite } from './helpers/websiteCtxtExclusions';
import FileDialogHost from './components/fileDialog/FileDialog';
import { WebviewErrorOverlay } from './components/overlays/WebviewErrorOverlay';
import { WebviewLoadingOverlay } from './components/overlays/WebviewLoadingOverlay';
import { CertOverlay } from './components/overlays/CertOverlay';
import { useUiScale } from './hooks/useUiScale';
import { useKeyboardLayouts } from './hooks/useKeyboardLayouts';
import { useTheme } from './hooks/useTheme';
import { useWebviewZoom } from './hooks/useWebviewZoom';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from './utils/zoom';
// import { PermissionPrompt } from './components/modals/permissions/PermissionPrompt';
// import { ToastCenter } from './components/notifications/ToastCenter';

type ActiveInputTarget = 'url' | null;

type LastLoadedInfo = {
  id: string | null;
  url: string | null;
};

type KeyboardDirection = 'ArrowLeft' | 'ArrowRight';

type SecurityIndicatorState = 'ok' | 'warn' | 'notice';

type MainBrowserAppProps = {
  initialUrl: string;
  mode: Mode;
  hasStartParam: boolean;
};

const formatDisplayUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      const origin = parsed.origin;
      return origin.endsWith('/') ? origin : `${origin}/`;
    }
  } catch {
    return trimmed;
  }
  return trimmed;
};

type SubmitEvent = FormEvent<HTMLFormElement> | { preventDefault: () => void } | undefined;

const buildWebviewBaseCss = (vars: Record<string, string>) => `
  :root, html { color-scheme: ${vars['color-scheme'] ?? 'dark'}; color:#0f111a; background:#e5e7eb; }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: ${vars['scrollbar-track'] ?? 'var(--mzr-scrollbar-track)'}; }
  ::-webkit-scrollbar-thumb {
    background: ${vars['scrollbar-thumb'] ?? 'var(--mzr-accent)'};
    border-radius: 999px;
    border: 2px solid ${vars['scrollbar-track'] ?? 'var(--mzr-scrollbar-track)'};
  }
  ::-webkit-scrollbar-thumb:hover { background: ${vars['scrollbar-thumb-hover'] ?? vars['scrollbar-thumb'] ?? 'var(--mzr-accent-strong)'}; }
  input, textarea, [contenteditable='true'] {
    caret-color: ${vars['accent-strong'] ?? 'var(--mzr-accent-strong)'}; !important;
    caret-shape: block !important;
  }
  :root {
    --mzr-caret-accent: ${vars['accent-strong'] ?? 'var(--mzr-accent-strong)'};
    --mzr-focus-ring:   ${vars['focus-ring'] ?? '#60a5fa'};
    --mzr-sel-bg:       ${vars['selection-bg'] ?? 'rgba(34,211,238,.28)'};
    --mzr-sel-fg:       ${vars['selection-fg'] ?? 'var(--mzr-surface-muted)'};
  }
  html, body, * {
    -webkit-touch-callout: none !important;
  }
  input, textarea, [contenteditable="true"] {
    -webkit-user-select: text !important;
    user-select: text !important;
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
`;


const SERVICE_OVERLAY_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'var(--mzr-overlay)',
  padding: '24px',
  overflow: 'auto',
  zIndex: 5
};


// const WEBVIEW_WRAPPER_STYLE: React.CSSProperties = {
//   position: 'relative',
//   flex: 1
// };

const MainBrowserApp: React.FC<MainBrowserAppProps> = ({ initialUrl, mode, hasStartParam }) => {
  const [activeViewRevision, setActiveViewRevision] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeInputRef = useRef<ActiveInputTarget>(null);
  const webviewReadyRef = useRef<boolean>(false);
  const activeWcIdRef = useRef<number | null>(null);
  const webviewFocusedRef = useRef<boolean>(false);
  const { t } = useI18n();

  const { ready: tabsReady, tabs, activeId, activeTab } = useTabsStore();

  const [inputValue, setInputValue] = useState<string>(() => formatDisplayUrl(initialUrl));
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const isEditingRef = useRef<boolean>(false);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [status, setStatus] = useState<StatusState>('loading');
  const [webviewReady, setWebviewReady] = useState<boolean>(false);

  const [showTabsPanel, setShowTabsPanel] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [settingsScrollTarget, setSettingsScrollTarget] = useState<'passwords' | 'network' | null>(null);
  const { globalToast, showGlobalToast } = useGlobalToast();
  const {
    accessBlocked,
    torEnabled,
    torKeepEnabled,
    torKeepEnabledDraft,
    torConfigSaving,
    torConfigFeedback,
    torIp,
    torIpLoading,
    setTorKeepEnabled,
    setTorKeepEnabledDraft,
    setTorConfigFeedback,
    refreshTorIp,
    handleTorKeepChange,
    handleToggleTor
  } = useTorSettings({ showGlobalToast });
  const [secureDnsEnabled, setSecureDnsEnabled] = useState<boolean>(false);
  const [secureDnsMode, setSecureDnsMode] = useState<SecureDnsMode>('automatic');
  const [secureDnsProvider, setSecureDnsProvider] = useState<SecureDnsProvider>('auto');
  const [secureDnsNextdnsId, setSecureDnsNextdnsId] = useState<string>('');
  const [secureDnsCustomUrl, setSecureDnsCustomUrl] = useState<string>('');
  const [secureDnsError, setSecureDnsError] = useState<string>('');
  const [showTorDisableDialog, setShowTorDisableDialog] = useState<boolean>(false);
  const [showTorKeepWarning, setShowTorKeepWarning] = useState<boolean>(false);
  const [torDisableBusy, setTorDisableBusy] = useState<boolean>(false);
  const [kbVisible, setKbVisible] = useState<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [zoomBarHeight, setZoomBarHeight] = useState<number>(0);
  const [ctxMenuVisible, setCtxMenuVisible] = useState<boolean>(false);
  const [ctxMenuState, setCtxMenuState] = useState<ContextMenuState | null>(null);
  const [ctxMenuHeight, setCtxMenuHeight] = useState<number>(0);
  const { enabledKbLayouts, kbLayout, setKbLayout } = useKeyboardLayouts();
  const [downloadsConcurrent, setDownloadsConcurrent] = useState<1 | 2 | 3>(2);
  const [downloadsSaving, setDownloadsSaving] = useState<boolean>(false);
  
  const { cookiePrivacy, setCookiePrivacy, handleCookieBlockChange } = useCookiePrivacy();
  const { downloadIndicatorState, downloadToast, handleDownloadIndicatorClick } = useDownloadIndicators();
  const [pageError, setPageError] = useState<{ url: string | null } | null>(null);
  const [certStatus, setCertStatus] = useState<CertificateInfo | null>(null);
  const [displayCert, setDisplayCert] = useState<CertificateInfo | null>(null);
  const [rememberExceptionChecked, setRememberExceptionChecked] = useState<boolean>(false);
  const {
    httpsMode,
    setHttpsMode,
    httpsModeRef,
    sslExceptions,
    setSslExceptions,
    hasSslException,
    shouldBlockCert
  } = useHttpsSecurity();
  const {
    status: trackerStatus,
    refreshStatus: refreshTrackerStatus,
    setTrackersEnabledGlobal,
    setAdsEnabledGlobal,
    setTrackersSiteAllowed,
    setAdsSiteAllowed,
    setBlockingMode
  } = useTrackerBlocking();
  const [cookieStatus, setCookieStatus] = useState<CookieBlockStatus>({
    blockThirdParty: false,
    exceptionAllowed: false,
    siteHost: null,
    blockedTotal: 0
  });
  const [webrtcMode, setWebrtcMode] = useState<WebrtcMode>('always_on');
  const certBypassRef = useRef<Set<string>>(new Set());
  const certStatusRef = useRef<CertificateInfo | null>(null);
  const blockingCertRef = useRef<CertificateInfo | null>(null);
  const storedInvalidCertRef = useRef<Map<string, CertificateInfo>>(new Map());
  const navigationStateRef = useRef<
    Map<string, { originalUrl: string; upgradedFromHttp: boolean; triedHttpFallback: boolean }>
  >(new Map());
  const allowHttpOnceRef = useRef<Set<string>>(new Set());
  const autoContinuedCertRef = useRef<Set<number>>(new Set());
  const [securityPopoverOpen, setSecurityPopoverOpen] = useState<boolean>(false);
  const lastFailedUrlRef = useRef<string | null>(null);
  const ignoreUrlChangeRef = useRef(false);
  const pendingTorCloseAllRef = useRef<boolean>(false);
  const pendingTorReloadRef = useRef<boolean>(false);
  const torKickTimerRef = useRef<number | null>(null);
  const kickActiveTabLoadRef = useRef<((attempt?: number) => void) | null>(null);
  const [suspendTabLifecycle, setSuspendTabLifecycle] = useState<boolean>(false);
  const suspendTabLifecycleRef = useRef<boolean>(false);
  const torCloseAllResumeIdRef = useRef<string | null>(null);
  const [messengerOrderSaving, setMessengerOrderSaving] = useState<boolean>(false);
  const [messengerOrderMessage, setMessengerOrderMessage] = useState<string>('');
  const { uiScale, setUiScale, applyUiScale, handleUiScaleReset } = useUiScale(1);
  const { theme, setTheme } = useTheme('dark');
  const themeVars = useMemo(() => getThemeVars(theme), [theme]);
  const webviewBaseCss = useMemo(() => buildWebviewBaseCss(themeVars), [themeVars]);
  const webviewBaseCssRef = useRef<string>(webviewBaseCss);
  useEffect(() => { webviewBaseCssRef.current = webviewBaseCss; }, [webviewBaseCss]);
  const { urlSuggestions, clearUrlSuggestions } = useUrlSuggestions(inputValue);
  const normalizeCtxState = useCallback((raw: unknown): ContextMenuState => {
    const source = (raw ?? {}) as Partial<ContextMenuState>;
    return {
      canBack: !!source.canBack,
      canForward: !!source.canForward,
      hasSelection: !!source.hasSelection,
      isEditable: !!source.isEditable,
      canPaste: !!source.canPaste,
      linkUrl: typeof source.linkUrl === 'string' ? source.linkUrl : '',
      mediaType: typeof source.mediaType === 'string' ? source.mediaType : undefined,
      mediaSrc: typeof source.mediaSrc === 'string' ? source.mediaSrc : undefined,
      pageUrl: typeof source.pageUrl === 'string' ? source.pageUrl : undefined,
      autofill: source.autofill
    };
  }, []);

  const ctxFocusRef = useRef<{ wasWebview: boolean; el: HTMLElement | null }>({
    wasWebview: false,
    el: null
  });
  const ctxMenuGuardRef = useRef<boolean>(false);
  const ctxMenuGuardTimerRef = useRef<number | null>(null);
  const clearCtxMenuGuardTimer = useCallback(() => {
    if (ctxMenuGuardTimerRef.current !== null) {
      window.clearTimeout(ctxMenuGuardTimerRef.current);
      ctxMenuGuardTimerRef.current = null;
    }
  }, []);
  const scheduleCtxMenuGuardRelease = useCallback(() => {
    clearCtxMenuGuardTimer();
    ctxMenuGuardTimerRef.current = window.setTimeout(() => {
      ctxMenuGuardRef.current = false;
      ctxMenuGuardTimerRef.current = null;
    }, 220);
  }, [clearCtxMenuGuardTimer]);

  useEffect(() => {
    const api = window.merezhyvo?.contextMenu;
    if (!api) return;
    const handleShow = async () => {
      try {
        const activeEl = document.activeElement as HTMLElement | null;
        const wasWebview =
          webviewFocusedRef.current ||
          (activeEl?.tagName?.toLowerCase?.() === 'webview') ||
          false;
        ctxFocusRef.current = {
          wasWebview,
          el: wasWebview ? null : activeEl
        };
        clearCtxMenuGuardTimer();
        ctxMenuGuardRef.current = true;
        // Hide software keyboard to avoid overlapping the menu; keep focus on the field.
        setKbVisible(false);
        const raw = await api.getState?.();
        setCtxMenuState(normalizeCtxState(raw));
        setCtxMenuVisible(true);
      } catch {
        setCtxMenuState(null);
        setCtxMenuVisible(true);
      }
    };
    const offShow = api.onShow?.(() => {
      void handleShow();
    });
    const offHide = api.onHide?.(() => {
      setCtxMenuVisible(false);
      setCtxMenuHeight(0);
      scheduleCtxMenuGuardRelease();
    });
    return () => {
      clearCtxMenuGuardTimer();
      try {
        if (offShow) offShow();
      } catch {
        // noop
      }
      try {
        if (offHide) offHide();
      } catch {
        // noop
      }
    };
  }, [normalizeCtxState, clearCtxMenuGuardTimer, scheduleCtxMenuGuardRelease]);

  const oskPressGuardRef = useRef(false);

  const appInfo = useAppInfo();
  const lastEditableMainRef = useRef<HTMLElement | null>(null);

  const tabsReadyRef = useRef<boolean>(tabsReady);
  const tabsRef = useRef<Tab[]>(tabs);
  const previousActiveTabRef = useRef<Tab | null>(activeTab ?? null);
  const webviewHostRef = useRef<HTMLDivElement | null>(null);
  const backgroundHostRef = useRef<HTMLDivElement | null>(null);
  const zoomBarRef = useRef<HTMLDivElement | null>(null);
  const [isHtmlFullscreen, setIsHtmlFullscreen] = useState<boolean>(false);
  const {
    tabViewsRef,
    backgroundTabRef,
    fullscreenTabRef,
    playingTabsRef,
    webviewHandleRef,
    webviewRef
  } = useTabRefs();
  const { updatePowerBlocker } = usePowerBlocker(playingTabsRef);
  const {
    mountInBackgroundHost,
    applyActiveStyles,
    installShadowStyles
  } = useWebviewMounts(webviewHostRef, backgroundHostRef);

  const startUrlAppliedRef = useRef<boolean>(false);
  const activeIdRef = useRef<string | null>(activeId);
  const activeTabRef = useRef<Tab | null>(activeTab ?? null);
  const lastLoadedRef = useRef<LastLoadedInfo>({ id: null, url: null });
  const lastNewWindowRef = useRef<{ url: string; at: number } | null>(null);

  const isServiceTab = (tab: Tab): boolean => (tab.url ?? '').trim().toLowerCase().startsWith('mzr://');
  const pinnedTabs = useMemo(() => tabs.filter((tab) => tab.pinned && !isServiceTab(tab)), [tabs]);
  const regularTabs = useMemo(() => tabs.filter((tab) => !tab.pinned && !isServiceTab(tab)), [tabs]);
  const tabCount = pinnedTabs.length + regularTabs.length;
  const activeTabIsLoading = !!activeTab?.isLoading;
  const activeUrl = (activeTab?.url && activeTab.url.trim()) ? activeTab.url : DEFAULT_URL;
  const activeHost = normalizeHost(activeTab?.url);
  const {
    newTab: newTabAction,
    closeTab: closeTabAction,
    closeAllTabs: closeAllTabsAction,
    activateTab: activateTabAction,
    pinTab: pinTabAction,
    navigateActive: navigateActiveAction,
    reloadActive: reloadActiveAction,
    updateMeta: updateMetaAction
  } = tabsActions;

  const openUrlInNewTab = useCallback((rawUrl: string) => {
    const url = rawUrl.trim();
    if (!url) return;
    const now = Date.now();
    const last = lastNewWindowRef.current;
    if (last && last.url === url && now - last.at < 400) {
      return;
    }
    lastNewWindowRef.current = { url, at: now };
    newTabAction(url);
  }, [newTabAction]);

  
  useEffect(() => {
    ipc.notifyTabsReady();
  }, []);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { tabsReadyRef.current = tabsReady; }, [tabsReady]);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);
  useEffect(() => {
    if (!suspendTabLifecycle) return;
    const resumeId = torCloseAllResumeIdRef.current;
    if (!resumeId) return;
    if (activeId !== resumeId) return;
    suspendTabLifecycleRef.current = false;
    torCloseAllResumeIdRef.current = null;
    setSuspendTabLifecycle(false);
  }, [activeId, suspendTabLifecycle]);
  const isYouTubeTab = useCallback((tabId: string) => {
    return tabsRef.current.some((tab) => tab.id === tabId && tab.isYouTube);
  }, []);
  useEffect(() => {
    if (fullscreenTabRef.current && fullscreenTabRef.current !== activeId) {
      fullscreenTabRef.current = null;
      setIsHtmlFullscreen(false);
    }
  }, [activeId, fullscreenTabRef]);
  const handleDownloadsConcurrentChange = useCallback(
    async (value: 1 | 2 | 3) => {
      const clamped = Math.min(3, Math.max(1, value)) as 1 | 2 | 3;
      setDownloadsConcurrent(clamped);
      if (downloadsSaving) return;
      setDownloadsSaving(true);
      try {
        await window.merezhyvo?.downloads?.settings.set?.({
          concurrent: clamped
        });
        showGlobalToast(t('settings.downloads.saved'));
      } catch (err) {
        console.error('[merezhyvo] downloads settings save failed', err);
        showGlobalToast(t('settings.downloads.saveError'));
      } finally {
        setDownloadsSaving(false);
      }
    },
    [downloadsSaving, showGlobalToast, t]
  );

  const handleHttpsModeChange = useCallback(
    async (modeValue: HttpsMode) => {
      const normalized = modeValue === 'preferred' ? 'preferred' : 'strict';
      setHttpsMode(normalized);
      try {
        const res = await ipc.settings.https.setMode(normalized);
        const nextMode = res && typeof res === 'object' && (res as { httpsMode?: unknown }).httpsMode === 'preferred'
          ? 'preferred'
          : 'strict';
        setHttpsMode(nextMode);
      } catch (err) {
        console.error('[merezhyvo] https mode update failed', err);
        showGlobalToast('Failed to update HTTPS mode.');
      }
    },
    [setHttpsMode, showGlobalToast]
  );

  const handleWebrtcModeChange = useCallback(
    async (modeValue: WebrtcMode) => {
      const normalized: WebrtcMode =
        modeValue === 'always_off' || modeValue === 'off_with_tor' ? modeValue : 'always_on';
      setWebrtcMode(normalized);
      try {
        const res = await ipc.settings.webrtc.setMode(normalized);
        const next =
          res && typeof res === 'object' && typeof (res as { mode?: unknown }).mode === 'string'
            ? (res as { mode: WebrtcMode }).mode
            : normalized;
        setWebrtcMode(next === 'always_off' || next === 'off_with_tor' ? next : 'always_on');
      } catch (err) {
        console.error('[merezhyvo] webrtc mode update failed', err);
        showGlobalToast('Failed to update WebRTC mode.');
      }
    },
    [showGlobalToast]
  );

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

  const copyTextToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    return fallbackCopy(text);
  }, []);

  const handleCopyUrl = useCallback(async (value: string) => {
    const text = value.trim();
    if (!text) return;
    const ok = await copyTextToClipboard(text);
    if (ok) {
      showGlobalToast(t('address.toast.copied'));
    }
  }, [copyTextToClipboard, showGlobalToast, t]);

  const {
    couponsPopupVisible,
    couponsPopupCountry,
    couponsPopupState,
    couponActionState,
    pendingCouponState,
    savingsSettings,
    couponsButtonVisible,
    effectiveSavingsCountry,
    popupHost,
    popupOrigin,
    isCouponsInfoService,
    applySavingsSettings,
    markSavingsLoaded,
    handleSavingsEnabledChange,
    handleSavingsCountryChange,
    handleCouponsCountryChange,
    handleOpenCouponsPopup,
    handleFindCoupons,
    closeCouponsPopup,
    handleApplyCoupon,
    handleInsertCoupon,
    handleReportInvalidCoupon,
    handleCouponsPositionChange,
    performCatalogFetch,
    handleCouponsDomReady
  } = useCoupons({
    activeTab,
    activeUrl,
    activeHost,
    activeIdRef,
    tabViewsRef,
    webviewRef,
    appVersion: appInfo.version,
    torEnabled,
    torKeepEnabled,
    showGlobalToast,
    t,
    newTabAction,
    copyTextToClipboard
  });

  const copyCommand = useCallback(
    async (command: string) => {
      const success = await copyTextToClipboard(command);
      showGlobalToast(success ? 'Copied' : 'Couldn\'t copy command');
    },
    [copyTextToClipboard, showGlobalToast]
  );

  const downloadsCommand = window.merezhyvo?.paths?.downloadsSymlinkCommand ?? '';

  const handleCopyDownloadsCommand = useCallback(() => {
    const command = window.merezhyvo?.paths?.downloadsSymlinkCommand;
    if (!command) {
      showGlobalToast('Couldn\'t copy command');
      return;
    }
    void copyCommand(command);
  }, [copyCommand, showGlobalToast]);

  const handleCopyDocumentsCommand = useCallback(() => {
    const command = window.merezhyvo?.paths?.documentsSymlinkCommand;
    if (!command) {
      showGlobalToast('Couldn\'t copy command');
      return;
    }
    void copyCommand(command);
  }, [copyCommand, showGlobalToast]);

  const handleThemeChange = useCallback(
    (value: ThemeName) => {
      setTheme(value);
    },
    [setTheme]
  );

  const handleWebZoomMobileChange = useCallback(async (value: number) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
    setWebZoomDefaults((prev) => ({ ...prev, mobile: clamped }));
    try {
      await ipc.ui.update({ webZoomMobile: clamped });
    } catch {
      // ignore persistence failure
    }
  }, []);

  const handleWebZoomDesktopChange = useCallback(async (value: number) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
    setWebZoomDefaults((prev) => ({ ...prev, desktop: clamped }));
    try {
      await ipc.ui.update({ webZoomDesktop: clamped });
    } catch {
      // ignore persistence failure
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSettingsState = async () => {
      try {
        const state = await ipc.settings.loadState();
        if (!state || cancelled) return;
        const keepEnabled = Boolean(state.tor?.keepEnabled);
        setTorKeepEnabled(keepEnabled);
        setTorKeepEnabledDraft(keepEnabled);
        const downloads = state.downloads ?? { concurrent: 2 };
        setDownloadsConcurrent(
          downloads.concurrent === 1 || downloads.concurrent === 3 ? downloads.concurrent : 2
        );
        setUiScale(state.ui?.scale ?? 1);
        setWebZoomDefaults({
          mobile: typeof state.ui?.webZoomMobile === 'number' ? state.ui.webZoomMobile : 2.3,
          desktop: typeof state.ui?.webZoomDesktop === 'number' ? state.ui.webZoomDesktop : 1.0
        });
        const themePref = state.ui?.theme === 'light' ? 'light' : 'dark';
        setTheme(themePref);
        setHttpsMode(state.httpsMode === 'preferred' ? 'preferred' : 'strict');
        setSslExceptions(Array.isArray(state.sslExceptions) ? state.sslExceptions : []);
        const wm = state.webrtcMode;
        setWebrtcMode(
          wm === 'always_off' || wm === 'off_with_tor'
            ? wm
            : 'always_on'
        );
        const cookies = state.privacy?.cookies;
        const thirdPartyBlock = typeof cookies?.blockThirdParty === 'boolean' ? cookies.blockThirdParty : false;
        const exceptions = cookies?.exceptions?.thirdPartyAllow ?? {};
        setCookiePrivacy({ blockThirdParty: thirdPartyBlock, exceptions: { thirdPartyAllow: { ...exceptions } } });
        const secureDns = state.network?.secureDns;
        setSecureDnsEnabled(Boolean(secureDns?.enabled));
        setSecureDnsMode(secureDns?.mode === 'secure' ? 'secure' : 'automatic');
        const provider = secureDns?.provider;
        setSecureDnsProvider(
          provider === 'cloudflare' ||
          provider === 'quad9' ||
          provider === 'google' ||
          provider === 'mullvad' ||
          provider === 'nextdns' ||
          provider === 'custom'
            ? provider
            : 'auto'
        );
        setSecureDnsNextdnsId(typeof secureDns?.nextdnsId === 'string' ? secureDns.nextdnsId : '');
        setSecureDnsCustomUrl(typeof secureDns?.customUrl === 'string' ? secureDns.customUrl : '');
        setSecureDnsError('');
        const savingsFromState = state.savings ?? null;
        if (!cancelled) {
          applySavingsSettings(savingsFromState);
        }
        try {
          const savingsDirect = await ipc.settings.savings.get();
          if (!cancelled && savingsDirect) {
            applySavingsSettings(savingsDirect);
          }
        } catch {
          // ignore fallback to state
        } finally {
          if (!cancelled) {
            markSavingsLoaded(true);
          }
        }
      } catch {
        if (!cancelled) {
          setTorKeepEnabled(false);
          setTorKeepEnabledDraft(false);
          setDownloadsConcurrent(2);
          setUiScale(1);
          setWebZoomDefaults({ mobile: 2.3, desktop: 1.0 });
          setTheme('dark');
          setHttpsMode('strict');
          setSslExceptions([]);
          setWebrtcMode('always_on');
          setCookiePrivacy({ blockThirdParty: false, exceptions: { thirdPartyAllow: {} } });
          setSecureDnsEnabled(false);
          setSecureDnsMode('automatic');
          setSecureDnsProvider('auto');
          setSecureDnsNextdnsId('');
          setSecureDnsCustomUrl('');
          setSecureDnsError('');
          applySavingsSettings(null);
          markSavingsLoaded(true);
        }
      }
    };
    loadSettingsState();
    return () => {
      cancelled = true;
    };
  }, [
    setTorKeepEnabled,
    setTorKeepEnabledDraft,
    setDownloadsConcurrent,
    setUiScale,
    setTheme,
    setHttpsMode,
    setSslExceptions,
    setWebrtcMode,
    setCookiePrivacy,
    setSecureDnsEnabled,
    setSecureDnsMode,
    setSecureDnsProvider,
    setSecureDnsNextdnsId,
    setSecureDnsCustomUrl,
    setSecureDnsError,
    applySavingsSettings,
    markSavingsLoaded
  ]);

  const getActiveWebview: GetWebview = useCallback((): WebviewTag | null => {
    const handle = webviewHandleRef.current;
    if (handle && typeof handle.getWebView === 'function') {
      const element = handle.getWebView();
      if (element) return element;
    }
    return webviewRef.current ?? null;
  }, [webviewHandleRef, webviewRef]);

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

  const getWebContentsIdSafe = useCallback((view?: WebviewTag | null): number | null => {
    if (!view || typeof view.getWebContentsId !== 'function') return null;
    try {
      const id = view.getWebContentsId();
      return typeof id === 'number' && Number.isFinite(id) ? id : null;
    } catch {
      return null;
    }
  }, []);

  const getActiveWebContentsId = useCallback((): number | null => {
    const view = getActiveWebview();
    return getWebContentsIdSafe(view);
  }, [getActiveWebview, getWebContentsIdSafe]);

  const focusEditableInWebview = useCallback(async () => {
    const wv = getActiveWebview();
    if (!wv) return;
    const script = `(function(){
      try {
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
        var active = document.activeElement;
        if (isEditable(active)) { active.focus(); return true; }
        var last = window.__mzrLastEditable;
        if (isEditable(last)) { last.focus(); return true; }
        return false;
      } catch { return false; }
    })();`;
    try { await wv.executeJavaScript(script, false); } catch { /* ignore */ }
  }, [getActiveWebview]);

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

  const {
    mainViewMode,
    messengerSettingsState,
    setMessengerSettingsState,
    messengerSettingsRef,
    messengerTabIdsRef,
    pendingMessengerTabIdRef,
    lastMessengerIdRef,
    activeMessengerId,
    setActiveMessengerId,
    orderedMessengers,
    exitMessengerMode,
    handleEnterMessengerMode,
    handleMessengerSelect,
    exitIfNoMessengers
  } = useMessengerMode({
    activeId,
    mode,
    getActiveWebview,
    blurActiveInWebview,
    resetEditingState,
    setInputValue
  });

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

  const isEditableElement = useCallback((element: Element | null) => {
    if (!element) return false;
    if (element === inputRef.current) return true;
    return windowHelpers.isEditableElement(element);
  }, [inputRef]);

  const isEditableMainNow = useCallback(() => {
    const el = document.activeElement as HTMLElement | null;
    if (el && el.tagName && el.tagName.toLowerCase() === 'webview') {
      return false;
    }
    if (webviewFocusedRef.current) {
      return false;
    }
    if (isEditableElement(el)) return true;
    return false;
  }, [isEditableElement]);

  const focusLastMainEditable = useCallback(() => {
    const last = lastEditableMainRef.current;
    if (!last || !document.contains(last)) {
      lastEditableMainRef.current = null;
      return;
    }
    try {
      last.focus({ preventScroll: true });
    } catch {
      try { last.focus(); } catch {}
    }
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

  const closeKeyboard = useCallback(() => {
    setKbVisible(false);
    oskPressGuardRef.current = true;
    window.setTimeout(() => { oskPressGuardRef.current = false; }, 300);
    const active = document.activeElement as HTMLElement | null;
    if (active && isEditableElement(active)) {
      try { active.blur(); } catch {}
    }
    blurActiveInWebview();
  }, [blurActiveInWebview, isEditableElement]);

  const injectText = React.useCallback(async (text: string) => {
    if (isEditableMainNow()) {
      focusLastMainEditable();
      injectTextToMain(text);
      return;
    }
    const ok = await probeWebEditable(getActiveWebview);
    await injectTextToWeb(text);
    if (!ok) {
      // best-effort: even if probe failed, we tried to inject via web
    }
  }, [focusLastMainEditable, getActiveWebview, injectTextToMain, injectTextToWeb, isEditableMainNow]);

  const injectBackspace = React.useCallback(async () => {
    if (isEditableMainNow()) {
      focusLastMainEditable();
      injectBackspaceToMain();
      return;
    }
    await injectBackspaceToWeb();
  }, [focusLastMainEditable, injectBackspaceToMain, injectBackspaceToWeb, isEditableMainNow]);

  const injectEnter = React.useCallback(async () => {
    if (isEditableMainNow()) {
      focusLastMainEditable();
      injectEnterToMain();
      return;
    }
    await injectEnterToWeb();
  }, [focusLastMainEditable, injectEnterToMain, injectEnterToWeb, isEditableMainNow]);

  const injectArrow = React.useCallback(async (dir: KeyboardDirection) => {
    if (isEditableMainNow()) {
      focusLastMainEditable();
      injectArrowToMain(dir);
      return;
    }
    await injectArrowToWeb(dir);
  }, [focusLastMainEditable, injectArrowToMain, injectArrowToWeb, isEditableMainNow]);

  const getActiveWebviewHandle = useCallback((): WebViewHandle | null => webviewHandleRef.current, [webviewHandleRef]);
  const destroyTabView = useTabDestroy({
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
  });

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
  }, [webviewHandleRef, webviewRef]);

  const attachWebviewListeners = useWebviewListeners({
    baseCssRef: webviewBaseCssRef,
    updateMetaAction,
    playingTabsRef,
    updatePowerBlocker,
    isYouTubeTab,
    backgroundTabRef,
    destroyTabView,
    fullscreenTabRef,
    setIsHtmlFullscreen,
    webviewFocusedRef,
    openNewTab: openUrlInNewTab
  });

  useEffect(() => {
    tabViewsRef.current.forEach((entry) => {
      const view = (entry.handle && typeof entry.handle.getWebView === 'function')
        ? entry.handle.getWebView()
        : entry.view;
      if (!view) return;
      try {
        const maybe = view.insertCSS(webviewBaseCss);
        if (maybe && typeof maybe.catch === 'function') {
          maybe.catch(() => {});
        }
      } catch {
        // ignore
      }
    });
  }, [tabViewsRef, webviewBaseCss]);

  const forceNavigateTab = useCallback((tabId: string, targetUrl: string) => {
    if (!tabId || !targetUrl) return;
    const trimmed = targetUrl.trim();
    if (!trimmed) return;
    const entry = tabViewsRef.current.get(tabId);
    if (!entry) return;
    lastLoadedRef.current = { id: tabId, url: trimmed };
    updateMetaAction(tabId, { url: trimmed, isLoading: true });
    if (entry.handle) {
      entry.handle.loadURL(trimmed);
    } else if (entry.view) {
      try {
        entry.view.loadURL(trimmed);
      } catch {
        try { entry.view.setAttribute('src', trimmed); } catch {}
      }
    }
    if (activeIdRef.current === tabId) {
      setStatus('loading');
      webviewReadyRef.current = false;
      setWebviewReady(false);
    }
  }, [tabViewsRef, updateMetaAction]);

  const handleNavigationStart = useCallback((tabId: string, payload: { url: string; isInPage: boolean }) => {
    if (!tabId || !payload || payload.isInPage) return;
    setDisplayCert(null);
    setCertStatus(null);
    certStatusRef.current = null;
    blockingCertRef.current = null;
    const url = payload.url || '';
    const protocol = (() => {
      try { return new URL(url).protocol; } catch { return ''; }
    })();
    if (protocol === 'http:') {
      const host = normalizeHost(url);
      const placeholder: CertificateInfo = {
        state: 'missing',
        url,
        host,
        error: HTTP_ERROR_TYPE,
        updatedAt: Date.now()
      };
      blockingCertRef.current = placeholder;
      setDisplayCert(placeholder);
      certStatusRef.current = placeholder;
      setCertStatus(placeholder);
      if (httpsModeRef.current === 'strict' && !hasSslException(host, HTTP_ERROR_TYPE)) {
        setStatus('error');
        setWebviewReady(false);
      }
    }
    const existing = navigationStateRef.current.get(tabId);
    if (
      existing?.upgradedFromHttp &&
      existing.originalUrl &&
      !existing.triedHttpFallback &&
      protocol === 'https:' &&
      existing.originalUrl.replace(/^http:/i, 'https:') === url
    ) {
      return;
    }
    if (protocol === 'http:') {
      if (allowHttpOnceRef.current.has(tabId)) {
        allowHttpOnceRef.current.delete(tabId);
        navigationStateRef.current.set(tabId, {
          originalUrl: url,
          upgradedFromHttp: false,
          triedHttpFallback: existing?.triedHttpFallback ?? false
        });
        return;
      }
      const upgraded = url.replace(/^http:/i, 'https:');
      navigationStateRef.current.set(tabId, { originalUrl: url, upgradedFromHttp: true, triedHttpFallback: false });
      forceNavigateTab(tabId, upgraded);
      return;
    }

    navigationStateRef.current.set(tabId, {
      originalUrl: url,
      upgradedFromHttp: existing?.upgradedFromHttp ?? false,
      triedHttpFallback: existing?.triedHttpFallback ?? false
    });
  }, [forceNavigateTab, hasSslException, httpsModeRef]);

  const handleNavigationError = useCallback(
    (tabId: string, payload: { errorCode: number; errorDescription: string; validatedURL: string; isMainFrame: boolean }) => {
      if (!tabId || !payload?.isMainFrame) return;
      if (isLikelyCertError(payload.errorCode, payload.errorDescription)) return;
      const meta = navigationStateRef.current.get(tabId);
      const validatedUrl = payload.validatedURL || '';
      const originalUrl = meta?.originalUrl || validatedUrl;
      const upgradedFromHttp = meta?.upgradedFromHttp ?? originalUrl.toLowerCase().startsWith('http://');
      const triedFallback = meta?.triedHttpFallback ?? false;
      const protocol = (() => {
        try { return new URL(validatedUrl || originalUrl).protocol; } catch { return ''; }
      })();
      if (!upgradedFromHttp) return;
      if (protocol && protocol !== 'https:') return;
      if (triedFallback) return;

      const host = normalizeHost(originalUrl) ?? normalizeHost(validatedUrl);
      const hasException = hasSslException(host, HTTP_ERROR_TYPE);
      const fallbackUrl = toHttpUrl(originalUrl, validatedUrl);
      if (!fallbackUrl) return;

      const mode = httpsModeRef.current;
      const shouldAutoFallback = mode === 'preferred' || hasException;
      allowHttpOnceRef.current.add(tabId);
      navigationStateRef.current.set(tabId, {
        originalUrl,
        upgradedFromHttp: true,
        triedHttpFallback: true
      });
      if (shouldAutoFallback || mode === 'strict') {
        forceNavigateTab(tabId, fallbackUrl);
      }
    },
    [forceNavigateTab, hasSslException, httpsModeRef]
  );

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
      const currentCert = certStatusRef.current;
      const isBlockingCert = currentCert ? shouldBlockCert(currentCert) : false;
      if (!isBlockingCert) {
        setCertStatus(null);
        if (currentCert?.state === 'ok') {
          blockingCertRef.current = null;
        }
      }
      if (activeIdRef.current) {
        certBypassRef.current.delete(activeIdRef.current);
      }
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
  }, [activeIdRef, mode, refreshNavigationState, shouldBlockCert, updateMetaAction, inputValue]);

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
    try {
      const proto = new URL(cleanUrl).protocol;
      if (proto === 'http:') {
        const host = normalizeHost(cleanUrl);
        const placeholder: CertificateInfo = {
          state: 'missing',
          url: cleanUrl,
          host,
          error: HTTP_ERROR_TYPE,
          updatedAt: Date.now()
        };
        blockingCertRef.current = placeholder;
        certStatusRef.current = placeholder;
        setCertStatus(placeholder);
        setDisplayCert(placeholder);
        if (httpsModeRef.current === 'strict' && !hasSslException(host, HTTP_ERROR_TYPE)) {
          setStatus('error');
          setWebviewReady(false);
        }
      }
    } catch {
      // ignore URL parse errors
    }
    updateMetaAction(tabId, {
      url: cleanUrl,
      discarded: false,
      lastUsedAt: Date.now()
    });
    if (activeIdRef.current === tabId && !isEditingRef.current) {
      setInputValue(formatDisplayUrl(cleanUrl));
      lastLoadedRef.current = { id: tabId, url: cleanUrl };
    }
  }, [updateMetaAction, hasSslException, httpsModeRef]);

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
    handleCouponsDomReady(tabId);
  }, [activeIdRef, handleCouponsDomReady, ensureSelectionCssInjected, tabViewsRef]);
  
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

  const [webZoomDefaults, setWebZoomDefaults] = useState<{ mobile: number; desktop: number }>({ mobile: 2.3, desktop: 1.0 });

  const {
    zoomLevel,
    zoomDisplay,
    setZoomClamped,
    applyZoomToView,
    getStoredZoomForTab
  } = useWebviewZoom({
    mode,
    activeTab,
    activeId,
    tabs,
    tabsReady,
    activeTabRef,
    activeViewRevision,
    webviewReady,
    getActiveWebview,
    updateTabZoom: (tabId, patch) => updateMetaAction(tabId, patch),
    defaults: webZoomDefaults
  });

  const refreshCookieStatus = useCallback(async (webContentsId?: number | null) => {
    try {
      const result = await window.merezhyvo?.cookies?.getStatus?.({ webContentsId: webContentsId ?? null });
      if (result) {
        setCookieStatus(result as CookieBlockStatus);
      }
    } catch (err) {
      console.error('[merezhyvo] cookies refresh failed', err);
    }
  }, []);

  useEffect(() => {
    const off = window.merezhyvo?.cookies?.onStats?.((payload) => {
      if (!payload) return;
      setCookieStatus(payload as CookieBlockStatus);
    });
    return () => {
      try {
        off?.();
      } catch {
        // noop
      }
    };
  }, []);

  useEffect(() => {
    void refreshCookieStatus(activeWcIdRef.current ?? null);
  }, [activeViewRevision, refreshCookieStatus]);

  useEffect(() => {
    void refreshTrackerStatus(activeWcIdRef.current ?? null);
  }, [activeViewRevision, refreshTrackerStatus]);

  const handleZoomSliderChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { valueAsNumber, value } = event.target;
    const candidate = Number.isFinite(valueAsNumber) ? valueAsNumber : Number(value);
    setZoomClamped(candidate);
  }, [setZoomClamped]);

  useEffect(() => {
    const currentTabs = tabsRef.current;
    for (const [tabId, entry] of tabViewsRef.current.entries()) {
      const tab = currentTabs.find((t) => t.id === tabId) || null;
      const targetZoom = getStoredZoomForTab(tab, mode);
      try {
        entry.render?.(mode, targetZoom);
      } catch {}
    }
  }, [mode, getStoredZoomForTab, tabViewsRef]);

  const refreshCertStatus = useCallback(
    async (wcId: number | null) => {
      if (!wcId) {
        return;
      }
      try {
        const next = await window.merezhyvo?.certificates?.getStatus?.(wcId);
        if (wcId !== activeWcIdRef.current) return;
        const current = certStatusRef.current;
        const activeTabId = activeIdRef.current;
        const bypassed = activeTabId ? certBypassRef.current.has(activeTabId) : false;
        const hasBlocking =
          (current && (current.state === 'invalid' || current.state === 'missing')) ||
          (blockingCertRef.current && (blockingCertRef.current.state === 'invalid' || blockingCertRef.current.state === 'missing'));
        if (bypassed && hasBlocking && (!next || next.state === 'ok' || next.state === 'unknown')) {
          return;
        }
        if ((!next || next.state === 'unknown') && current && (current.state === 'invalid' || current.state === 'missing')) {
          return;
        }
        setCertStatus(next ?? null);
        certStatusRef.current = next ?? null;
        let nextBlocking: CertificateInfo | null = blockingCertRef.current ?? null;
        if (next && (next.state === 'invalid' || next.state === 'missing')) {
          nextBlocking = next;
        } else if (next && next.state === 'ok') {
          nextBlocking = null;
          const activeTabIdCurrent = activeIdRef.current;
          if (activeTabIdCurrent) {
            certBypassRef.current.delete(activeTabIdCurrent);
          }
        }
        blockingCertRef.current = nextBlocking;
        setDisplayCert(nextBlocking ?? next ?? null);
  } catch {
        if (wcId === activeWcIdRef.current && !(certStatusRef.current && (certStatusRef.current.state === 'invalid' || certStatusRef.current.state === 'missing'))) {
          setCertStatus(null);
          certStatusRef.current = null;
        }
      }
    },
    []
  );

  useTabViewLifecycle({
    mode,
    tabs,
    activeTab,
    tabsReady,
    torEnabled,
    suspendTabLifecycle,
    refs: {
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
      tabsRef,
      suspendTabLifecycleRef
    },
    handlers: {
      handleHostCanGo,
      handleHostStatus,
      handleHostUrlChange,
      handleHostDomReady,
      handleNavigationStart,
      handleNavigationError,
      attachWebviewListeners,
      installShadowStyles,
      applyActiveStyles,
      refreshNavigationState,
      refreshCertStatus,
      updateMetaAction,
      applyZoomToView,
      getStoredZoomForTab,
      getWebContentsIdSafe,
      destroyTabView
    },
    setters: {
      setStatus,
      setWebviewReady,
      setActiveViewRevision
    }
  });

  const upsertSslException = useCallback(
    async (host: string | null | undefined, errorType: string | null | undefined, enabled: boolean) => {
      const normalizedHost = host ? host.toLowerCase() : '';
      if (!normalizedHost || !errorType) return;
      if (enabled) {
        setSslExceptions((prev) => {
          if (prev.some((item) => item.host === normalizedHost && item.errorType === errorType)) {
            return prev;
          }
          return [...prev, { host: normalizedHost, errorType }];
        });
        try {
          const res = await ipc.settings.https.addException({ host: normalizedHost, errorType });
          if (res && typeof res === 'object' && Array.isArray((res as { sslExceptions?: unknown }).sslExceptions)) {
            setSslExceptions((res as { sslExceptions: SslException[] }).sslExceptions);
          }
        } catch (err) {
          console.error('[merezhyvo] add ssl exception failed', err);
          showGlobalToast('Failed to save exception.');
        }
      } else {
        setSslExceptions((prev) => prev.filter((item) => !(item.host === normalizedHost && item.errorType === errorType)));
        try {
          const res = await ipc.settings.https.removeException({ host: normalizedHost, errorType });
          if (res && typeof res === 'object' && Array.isArray((res as { sslExceptions?: unknown }).sslExceptions)) {
            setSslExceptions((res as { sslExceptions: SslException[] }).sslExceptions);
          }
        } catch (err) {
          console.error('[merezhyvo] remove ssl exception failed', err);
          showGlobalToast('Failed to update exception.');
        }
      }
      const wcId = activeWcIdRef.current;
      if (wcId) {
        void refreshCertStatus(wcId);
      }
    },
    [refreshCertStatus, setSslExceptions, showGlobalToast]
  );

  useEffect(() => {
    const isCertificateInfo = (value: unknown): value is CertificateInfo =>
      typeof value === 'object' &&
      value !== null &&
      typeof (value as CertificateInfo).state === 'string' &&
      Number.isFinite((value as CertificateInfo).updatedAt);

    const off = window.merezhyvo?.certificates?.onUpdate?.((payload) => {
      if (!payload) return;
      const wrapped = typeof payload === 'object' && payload !== null
        ? (payload as { wcId?: number; webContentsId?: number; info?: CertificateInfo })
        : {};
      const wcIdCandidate =
        typeof wrapped.webContentsId === 'number'
          ? wrapped.webContentsId
          : typeof wrapped.wcId === 'number'
            ? wrapped.wcId
            : null;
      const next = wrapped.info ?? (isCertificateInfo(payload) ? payload : null);
      const isActiveMatch = (() => {
        const id = wcIdCandidate ?? null;
        if (!id || !activeIdRef.current) return false;
        const entry = tabViewsRef.current.get(activeIdRef.current);
        const wc = getWebContentsIdSafe(entry?.view);
        if (wc && wc === id) {
          activeWcIdRef.current = wc;
          return true;
        }
        return id === activeWcIdRef.current;
      })();
      const hostFromNext = normalizeHost(next?.host ?? next?.url);
      const blockingRefHost = blockingCertRef.current?.host ?? normalizeHost(blockingCertRef.current?.url);
      const currentHost = certStatusRef.current?.host ?? normalizeHost(certStatusRef.current?.url);
      const activeHost = normalizeHost(activeTabRef.current?.url);
      const lookupHost = hostFromNext ?? blockingRefHost ?? currentHost ?? activeHost;
      if (wcIdCandidate && isActiveMatch) {
        const current = certStatusRef.current;
        const blockingPrev = blockingCertRef.current;
        const blockingPrevHost = blockingPrev?.host ?? normalizeHost(blockingPrev?.url);
        const blockingPrevIsProblem =
          blockingPrev && (blockingPrev.state === 'invalid' || blockingPrev.state === 'missing');
        const storedInvalid = lookupHost ? storedInvalidCertRef.current.get(lookupHost) ?? null : null;
        const storedInvalidIsProblem =
          storedInvalid && (storedInvalid.state === 'invalid' || storedInvalid.state === 'missing');
        if ((!next || next.state === 'unknown') && current && (current.state === 'invalid' || current.state === 'missing')) {
          return;
        }
        const activeTabId = activeIdRef.current;
        const bypassed = activeTabId ? certBypassRef.current.has(activeTabId) : false;
        const hadBlocking =
          (current?.state === 'invalid' || current?.state === 'missing') ||
          blockingPrevIsProblem ||
          storedInvalidIsProblem;
        const bypassedByException = hadBlocking && !shouldBlockCert(current ?? blockingPrev ?? storedInvalid ?? next ?? null);
        const shouldIgnoreOk =
          (bypassed || bypassedByException) &&
          next?.state === 'ok' &&
          hadBlocking;
        const forceKeepBlocking =
          next?.state === 'ok' &&
          ((blockingPrevIsProblem &&
            blockingPrevHost &&
            hasSslException(blockingPrevHost, deriveErrorType(blockingPrev ?? null))) ||
            (storedInvalidIsProblem &&
              lookupHost &&
              hasSslException(lookupHost, deriveErrorType(storedInvalid ?? null))));
        const nextState =
          shouldIgnoreOk || forceKeepBlocking
            ? storedInvalid ?? blockingPrev ?? current ?? next ?? null
            : next ?? null;
        let safeNextState: CertificateInfo | null = nextState ?? null;
        const safeHost = safeNextState?.host ?? normalizeHost(safeNextState?.url) ?? lookupHost ?? null;
        if (safeNextState && !safeNextState.host && safeHost) {
          safeNextState = { ...safeNextState, host: safeHost };
        }

        setCertStatus(safeNextState);
        certStatusRef.current = safeNextState;
        let nextBlocking: CertificateInfo | null = blockingPrev ?? storedInvalid ?? null;
        if (safeNextState && (safeNextState.state === 'invalid' || safeNextState.state === 'missing')) {
          nextBlocking = safeNextState;
          if (safeHost) {
            storedInvalidCertRef.current.set(safeHost, safeNextState);
          }
        } else if (safeNextState && safeNextState.state === 'ok' && !shouldIgnoreOk && !forceKeepBlocking) {
          const blockingErrorType = deriveErrorType(blockingPrev ?? null);
          const preserveBlocking =
            blockingPrevIsProblem &&
            (bypassed || hasSslException(blockingPrevHost, blockingErrorType)) &&
            (!safeHost || !blockingPrevHost || blockingPrevHost === safeHost);
          if (preserveBlocking && blockingPrev) {
            nextBlocking = blockingPrev;
            setCertStatus(blockingPrev);
            certStatusRef.current = blockingPrev;
          } else {
            nextBlocking = null;
          }
          if (safeHost) {
            const stored = storedInvalidCertRef.current.get(safeHost);
            const storedErrorType = deriveErrorType(stored ?? null);
            const keepStored =
              stored &&
              hasSslException(safeHost, storedErrorType) &&
              (!blockingPrevHost || blockingPrevHost === safeHost);
            if (keepStored) {
              nextBlocking = stored;
              setCertStatus(stored);
              certStatusRef.current = stored;
            } else {
              storedInvalidCertRef.current.delete(safeHost);
            }
          }
        }
        blockingCertRef.current = nextBlocking;
        setDisplayCert(nextBlocking ?? safeNextState ?? null);
        if (safeNextState?.state === 'invalid' || safeNextState?.state === 'missing') {
          const currentActiveTabId = activeIdRef.current;
          const blockNow = shouldBlockCert(safeNextState);
          const bypass = currentActiveTabId ? certBypassRef.current.has(currentActiveTabId) : false;
          if (currentActiveTabId) {
            updateMetaAction(currentActiveTabId, { isLoading: false });
          }
          if (blockNow && !bypass) {
            setStatus('error');
            setWebviewReady(false);
          } else {
            setStatus('ready');
            webviewReadyRef.current = true;
            setWebviewReady(true);
          }
        }
        if (next?.state === 'ok' && !shouldIgnoreOk) {
          const activeTabIdCurrent = activeIdRef.current;
          if (activeTabIdCurrent) {
            certBypassRef.current.delete(activeTabIdCurrent);
          }
        }
      }
    });
    return () => {
      if (typeof off === 'function') {
        try { off(); } catch {}
      }
    };
  }, [getWebContentsIdSafe, hasSslException, shouldBlockCert, tabViewsRef, updateMetaAction]);

  const blockingActive =
    blockingCertRef.current &&
    (blockingCertRef.current.state === 'invalid' || blockingCertRef.current.state === 'missing')
      ? blockingCertRef.current
      : null;
  const storedInvalidForDisplay = (() => {
    const host =
      blockingActive?.host ??
      displayCert?.host ??
      certStatus?.host ??
      normalizeHost(displayCert?.url ?? certStatus?.url) ??
      normalizeHost(activeTabRef.current?.url);
    return host ? storedInvalidCertRef.current.get(host) ?? null : null;
  })();
  let displayCertEffective =
    blockingActive ??
    storedInvalidForDisplay ??
    displayCert ??
    blockingCertRef.current ??
    certStatus ??
    null;
  const certHost =
    displayCertEffective?.host ??
    storedInvalidForDisplay?.host ??
    normalizeHost(displayCertEffective?.url ?? storedInvalidForDisplay?.url) ??
    normalizeHost(activeTabRef.current?.url);
  const certErrorType = deriveErrorType(displayCertEffective ?? storedInvalidForDisplay ?? null);
  const certCandidate =
    blockingActive ? blockingActive : displayCertEffective ?? certStatus ?? blockingCertRef.current;
  const certBlock = certCandidate ? shouldBlockCert(certCandidate) : false;
  const certExceptionAllowed = hasSslException(certHost, certErrorType);
  if (certExceptionAllowed && (!displayCertEffective || displayCertEffective.state === 'ok')) {
    const fallback: CertificateInfo = {
      state: 'invalid',
      host: certHost ?? null,
      url: displayCertEffective?.url ?? activeTabRef.current?.url ?? null,
      error: certErrorType ?? null,
      updatedAt: Date.now()
    };
    displayCertEffective = fallback;
  }
  const certWarning =
    certCandidate &&
    (certCandidate.state === 'invalid' || certCandidate.state === 'missing') &&
    certBlock &&
    !certBypassRef.current.has(activeId ?? '');
  const certProblem = Boolean(
    displayCertEffective && (displayCertEffective.state === 'invalid' || displayCertEffective.state === 'missing')
  );
  const activeSecurityHost = certHost ?? normalizeHost(activeTab?.url);
  const cookieExceptionsMap = cookiePrivacy.exceptions?.thirdPartyAllow ?? {};
  const hasCookieException =
    Boolean(cookiePrivacy.blockThirdParty) &&
    Boolean(activeSecurityHost) &&
    ((activeSecurityHost && cookieExceptionsMap[activeSecurityHost]) ||
      Object.keys(cookieExceptionsMap).some(
        (key) => key && activeSecurityHost && isSubdomainOrSame(activeSecurityHost, key)
      ));
  const trackerExceptionAllowed = Boolean(trackerStatus.trackersEnabledGlobal && trackerStatus.trackersAllowedForSite);
  const adsExceptionAllowed = Boolean(trackerStatus.adsEnabledGlobal && trackerStatus.adsAllowedForSite);
  const securityState: SecurityIndicatorState = certProblem
    ? 'warn'
    : hasCookieException || trackerExceptionAllowed || adsExceptionAllowed
      ? 'notice'
      : 'ok';
  const cookieBlockedTotal = useMemo(() => {
    if (!cookieStatus.siteHost || !activeSecurityHost) return 0;
    if (!isSubdomainOrSame(activeSecurityHost, cookieStatus.siteHost)) return 0;
    return cookieStatus.blockedTotal ?? 0;
  }, [activeSecurityHost, cookieStatus.blockedTotal, cookieStatus.siteHost]);
  const siteCookiePolicy = useMemo(
    () => ({
      blockThirdParty: cookiePrivacy.blockThirdParty,
      exceptionAllowed: hasCookieException,
      host: activeSecurityHost ?? null,
      blockedTotal: cookiePrivacy.blockThirdParty && !hasCookieException ? cookieBlockedTotal : 0
    }),
    [cookiePrivacy.blockThirdParty, hasCookieException, activeSecurityHost, cookieBlockedTotal]
  );
  const securityInfo = useMemo(() => {
    if (!displayCertEffective) return null;
    return {
      state: displayCertEffective.state,
      url: displayCertEffective.url ?? null,
      host: displayCertEffective.host ?? null,
      error: displayCertEffective.error ?? null,
      issuer: displayCertEffective.certificate?.issuerName ?? null,
      subject: displayCertEffective.certificate?.subjectName ?? null,
      validFrom: displayCertEffective.certificate?.validStart ?? null,
      validTo: displayCertEffective.certificate?.validExpiry ?? null,
      fingerprint: displayCertEffective.certificate?.fingerprint ?? null
    };
  }, [displayCertEffective]);

  const handleToggleCertException = useCallback(
    (nextValue: boolean) => {
      if (!displayCertEffective) return;
      void upsertSslException(certHost, certErrorType, nextValue);
    },
    [displayCertEffective, certHost, certErrorType, upsertSslException]
  );

  useEffect(() => {
    certStatusRef.current = certStatus;
    if (certStatus && (certStatus.state === 'invalid' || certStatus.state === 'missing')) {
      blockingCertRef.current = certStatus;
      return;
    }
    if (certStatus && certStatus.state === 'ok') {
      const blocking = blockingCertRef.current;
      const blockingIsProblem = blocking && (blocking.state === 'invalid' || blocking.state === 'missing');
      const statusHost = certStatus.host ?? normalizeHost(certStatus.url);
      const blockingHost = blocking?.host ?? normalizeHost(blocking?.url);
      const sameHost = blockingHost && statusHost ? blockingHost === statusHost : false;
      if (blockingIsProblem && (sameHost || !statusHost)) {
        // keep previous blocking info so the shield stays red for this host
        return;
      }
      if (!blockingIsProblem) {
        blockingCertRef.current = null;
      }
    }
  }, [certStatus]);

  useEffect(() => {
    if (!displayCert) {
      const wcId = activeWcIdRef.current;
      if (wcId) {
        void refreshCertStatus(wcId);
      }
    }
  }, [displayCert, refreshCertStatus]);

  useEffect(() => {
    const wcId = activeWcIdRef.current;
    const candidate = certStatus ?? blockingCertRef.current;
    if (!candidate || candidate.state !== 'invalid' || !wcId) return;
    const block = shouldBlockCert(candidate);
    if (!block) {
      if (!autoContinuedCertRef.current.has(wcId)) {
        autoContinuedCertRef.current.add(wcId);
        void window.merezhyvo?.certificates?.continue?.(wcId).catch(() => {
          autoContinuedCertRef.current.delete(wcId);
        });
      }
    } else {
      autoContinuedCertRef.current.delete(wcId);
    }
  }, [certStatus, shouldBlockCert]);

  useEffect(() => {
    setSecurityPopoverOpen(false);
  }, [activeId, mainViewMode, certStatus, certWarning]);

  useEffect(() => {
    if (!certWarning) return;
    if (!certCandidate?.url) return;
    if (isEditingRef.current) return;
    setInputValue(formatDisplayUrl(certCandidate.url));
  }, [certWarning, certCandidate]);

  useEffect(() => {
    if (!certWarning) {
      setRememberExceptionChecked(false);
    }
  }, [certWarning]);

  useEffect(() => {
    const wcId = activeWcIdRef.current;
    if (wcId) {
      void refreshCertStatus(wcId);
    }
  }, [httpsMode, sslExceptions, refreshCertStatus]);

  useEffect(() => {
    const off = ipc.onOpenUrl((arg) => {
      const { url } =
        typeof arg === 'string' ? { url: arg } : (arg || {});
      if (!url) return;
      openUrlInNewTab(String(url));
    });
    return () => {
      if (typeof off === 'function') {
        try {
          off();
        } catch {}
      }
    };
  }, [openUrlInNewTab]);

  useEffect(() => {
    if (!tabsReady) return;
    if (isEditingRef.current) return;
    setInputValue(formatDisplayUrl(activeUrl));
  }, [tabsReady, activeUrl]);

  useEffect(() => {
    const url = (activeTab?.url || '').trim().toLowerCase();
    if (!url.startsWith('mzr://start')) return;
    if (isEditingRef.current) return;
    const node = inputRef.current;
    if (!node) return;
    if (document.activeElement !== node) return;
    requestAnimationFrame(() => {
      if (!isEditingRef.current) {
        try { node.blur(); } catch {}
      }
    });
  }, [activeTab?.url]);

  useEffect(() => {
    if (!tabsReady || !hasStartParam) return;
    if (startUrlAppliedRef.current) return;
    startUrlAppliedRef.current = true;
    const trimmed = (initialUrl || '').trim();
    if (!trimmed) return;
    navigateActiveAction(trimmed);
  }, [tabsReady, hasStartParam, initialUrl, navigateActiveAction]);

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

  useEffect(() => {
    messengerSettingsRef.current = messengerSettingsState;
  }, [messengerSettingsRef, messengerSettingsState]);

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

    const nextSettings = { ...currentSettings, order: nextOrder };
    messengerSettingsRef.current = nextSettings;
    setMessengerSettingsState(nextSettings);
    setMessengerOrderSaving(true);
    setMessengerOrderMessage('');

    try {
      const saved = await ipc.settings.messenger.update({ order: nextOrder, hideToolbar: nextSettings?.hideToolbar });
      if (saved && Array.isArray(saved.order)) {
        messengerSettingsRef.current = saved;
        setMessengerSettingsState(saved);
        setMessengerOrderMessage('Messenger order saved');
      } else {
        setMessengerOrderMessage('Unable to save messenger order');
      }
    } catch {
      const rollback = { ...(currentSettings ?? {}), order: previousOrder };
      messengerSettingsRef.current = rollback;
      setMessengerSettingsState(rollback);
      setMessengerOrderMessage('Failed to save messenger order');
    } finally {
      setMessengerOrderSaving(false);
    }
  }, [messengerSettingsRef, setMessengerOrderMessage, setMessengerOrderSaving, setMessengerSettingsState]);

  const handleToggleMessengerToolbarVisibility = useCallback(
    async (hide: boolean) => {
      const currentSettings = messengerSettingsRef.current;
      const nextSettings = { ...(currentSettings ?? {}), hideToolbar: hide };
      messengerSettingsRef.current = nextSettings;
      setMessengerSettingsState(nextSettings);
      try {
        const saved = await ipc.settings.messenger.update(nextSettings);
        messengerSettingsRef.current = saved;
        setMessengerSettingsState(saved);
      } catch {
        // keep optimistic state
      }
    },
    [messengerSettingsRef, setMessengerSettingsState]
  );

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
  }, [
    activeId,
    activeMessengerId,
    exitMessengerMode,
    mainViewMode,
    tabs,
    messengerTabIdsRef,
    pendingMessengerTabIdRef,
    setActiveMessengerId,
    lastMessengerIdRef
  ]);

  useEffect(() => {
    exitIfNoMessengers();
  }, [exitIfNoMessengers]);

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
  }, [closeTabAction, messengerTabIdsRef, pendingMessengerTabIdRef]);
  const openSettingsModal = useCallback(() => {
    activeInputRef.current = null;
    setShowSettingsModal(true);
    blurActiveInWebview();
  }, [blurActiveInWebview]);

  const closeSettingsModal = useCallback(() => {
    setShowSettingsModal(false);
    setSettingsScrollTarget(null);
  }, []);

  const handleOpenTorProjectLink = useCallback(() => {
    closeSettingsModal();
    newTabAction('https://www.torproject.org');
  }, [closeSettingsModal, newTabAction]);

  const handleTorToggleRequest = useCallback(() => {
    if (torEnabled) {
      if (torKeepEnabled) {
        setShowTorKeepWarning(true);
        return;
      }
      if (!torDisableBusy) {
        setShowTorDisableDialog(true);
      }
      return;
    }
    void handleToggleTor();
  }, [handleToggleTor, torDisableBusy, torEnabled, torKeepEnabled]);

  const handleTorDisableCancel = useCallback(() => {
    if (torDisableBusy) return;
    setShowTorDisableDialog(false);
  }, [torDisableBusy]);

  const handleTorKeepWarningCancel = useCallback(() => {
    setShowTorKeepWarning(false);
  }, []);

  const handleTorKeepWarningOpenSettings = useCallback(() => {
    setShowTorKeepWarning(false);
    setSettingsScrollTarget('network');
    setShowSettingsModal(true);
  }, []);


  const wipeTorSession = useCallback(async (): Promise<boolean> => {
    const result = await torService.clearSession();
    if (!result?.ok) {
      showGlobalToast(t('tor.disable.wipeFailed'));
      return false;
    }
    return true;
  }, [showGlobalToast, t]);


  const finalizeTorCloseAll = useCallback(() => {
    pendingTorCloseAllRef.current = false;
    pendingTorReloadRef.current = false;
    suspendTabLifecycleRef.current = true;
    torCloseAllResumeIdRef.current = null;
    setSuspendTabLifecycle(true);
    previousActiveTabRef.current = null;
    for (const tabId of Array.from(tabViewsRef.current.keys())) {
      destroyTabView(tabId, { keepMeta: true });
    }
    activeWcIdRef.current = null;
    webviewHandleRef.current = null;
    webviewRef.current = null;
    webviewReadyRef.current = false;
    setWebviewReady(false);
    setStatus('loading');
    navigationStateRef.current.clear();
    allowHttpOnceRef.current.clear();
    lastLoadedRef.current = { id: null, url: null };
    lastFailedUrlRef.current = null;
    ignoreUrlChangeRef.current = false;
    certBypassRef.current.clear();
    blockingCertRef.current = null;
    backgroundTabRef.current = null;
    fullscreenTabRef.current = null;
    playingTabsRef.current.clear();
    setIsHtmlFullscreen(false);
    setCertStatus(null);
    setPageError(null);
    closeAllTabsAction();
    const nextState = getTabsState();
    tabsReadyRef.current = nextState.ready;
    tabsRef.current = nextState.tabs;
    activeIdRef.current = nextState.activeId;
    activeTabRef.current = nextState.tabs.find((tab) => tab.id === nextState.activeId) ?? null;
    previousActiveTabRef.current = activeTabRef.current;
    torCloseAllResumeIdRef.current = nextState.activeId;
    updatePowerBlocker();
    if (torKickTimerRef.current) {
      window.clearTimeout(torKickTimerRef.current);
      torKickTimerRef.current = null;
    }
    torKickTimerRef.current = window.setTimeout(() => {
      kickActiveTabLoadRef.current?.(0);
    }, 120);
  }, [
    activeIdRef,
    activeTabRef,
    activeWcIdRef,
    allowHttpOnceRef,
    backgroundTabRef,
    blockingCertRef,
    certBypassRef,
    closeAllTabsAction,
    destroyTabView,
    fullscreenTabRef,
    kickActiveTabLoadRef,
    playingTabsRef,
    setIsHtmlFullscreen,
    lastLoadedRef,
    navigationStateRef,
    previousActiveTabRef,
    setCertStatus,
    setPageError,
    setStatus,
    setWebviewReady,
    tabsRef,
    tabsReadyRef,
    tabViewsRef,
    torKickTimerRef,
    updatePowerBlocker,
    webviewHandleRef,
    webviewReadyRef,
    webviewRef,
    torCloseAllResumeIdRef,
    suspendTabLifecycleRef,
    setSuspendTabLifecycle
  ]);

  const handleTorDisableChoice = useCallback(
    async (modeChoice: 'close' | 'keep') => {
      if (torDisableBusy) return;
      const closeTabs = modeChoice === 'close';
      if (closeTabs) {
        suspendTabLifecycleRef.current = true;
        torCloseAllResumeIdRef.current = null;
        setSuspendTabLifecycle(true);
      }
      pendingTorCloseAllRef.current = closeTabs;
      pendingTorReloadRef.current = !closeTabs;
      setTorDisableBusy(true);
      const wiped = await wipeTorSession();
      if (!wiped) {
        pendingTorCloseAllRef.current = false;
        pendingTorReloadRef.current = false;
        if (closeTabs) {
          suspendTabLifecycleRef.current = false;
          setSuspendTabLifecycle(false);
        }
        setTorDisableBusy(false);
        return;
      }
      try {
        const state = await torService.toggle();
        if (state?.enabled) {
          showGlobalToast(t('tor.disable.toggleFailed'));
          pendingTorCloseAllRef.current = false;
          pendingTorReloadRef.current = false;
          if (closeTabs) {
            suspendTabLifecycleRef.current = false;
            setSuspendTabLifecycle(false);
          }
          setTorDisableBusy(false);
          return;
        }
      } catch (err) {
        console.error('[merezhyvo] tor disable failed', err);
        showGlobalToast(t('tor.disable.toggleFailed'));
        pendingTorCloseAllRef.current = false;
        pendingTorReloadRef.current = false;
        if (closeTabs) {
          suspendTabLifecycleRef.current = false;
          setSuspendTabLifecycle(false);
        }
        setTorDisableBusy(false);
        return;
      }
      setShowTorDisableDialog(false);
      setTorDisableBusy(false);
    },
    [
      showGlobalToast,
      t,
      torDisableBusy,
      setShowTorDisableDialog,
      setSuspendTabLifecycle,
      setTorDisableBusy,
      wipeTorSession
    ]
  );

  const handleTorDisableCloseAll = useCallback(() => {
    void handleTorDisableChoice('close');
  }, [handleTorDisableChoice]);

  const handleTorDisableKeepTabs = useCallback(() => {
    void handleTorDisableChoice('keep');
  }, [handleTorDisableChoice]);

  const {
    passwordStatus,
    passwordPrompt,
    passwordPromptBusy,
    showUnlockModal,
    unlockPayload,
    unlockError,
    unlockSubmitting,
    requestPasswordUnlock,
    handlePasswordPromptAction,
    handlePasswordPromptClose,
    handlePasswordUnlock,
    closeUnlockModal
  } = usePasswordFlows({
    t,
    showGlobalToast,
    closeSettingsModal,
    openSettingsModal,
    setSettingsScrollTarget
  });

  const reloadActiveTabViews = useCallback(() => {
    const entries = Array.from(tabViewsRef.current.entries());
    if (!entries.length) return;
    const activeIdCurrent = activeIdRef.current;
    for (const [tabId, entry] of entries) {
      const tab = tabsRef.current.find((item) => item.id === tabId);
      if (!tab) continue;
      const targetUrl = (tab.url && tab.url.trim()) ? tab.url.trim() : DEFAULT_URL;
      if (targetUrl.toLowerCase().startsWith('mzr://')) continue;
      if (tabId === activeIdCurrent) {
        setStatus('loading');
        webviewReadyRef.current = false;
        setWebviewReady(false);
      }
      const handle = entry.handle;
      const view = entry.view;
      if (handle) {
        try {
          const webview = handle.getWebView?.() || view;
          if (webview && 'isConnected' in webview && !webview.isConnected) {
            handle.loadURL(targetUrl);
          } else {
            handle.reload();
          }
        } catch {
          try { handle.loadURL(targetUrl); } catch {}
        }
      } else if (view) {
        try {
          if ('isConnected' in view && !view.isConnected) {
            view.setAttribute('src', targetUrl);
          } else if (typeof view.reload === 'function') {
            view.reload();
          } else {
            view.loadURL(targetUrl);
          }
        } catch {
          try { view.setAttribute('src', targetUrl); } catch {}
        }
      }
    }
  }, [activeIdRef, setStatus, setWebviewReady, tabViewsRef, tabsRef, webviewReadyRef]);

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
  }, [showSettingsModal, closeSettingsModal, torKeepEnabled, setTorConfigFeedback, setTorKeepEnabledDraft]);

  useEffect(() => {
    if (torEnabled) return;
    setShowTorDisableDialog(false);
    setTorDisableBusy(false);
    setShowTorKeepWarning(false);
    if (pendingTorCloseAllRef.current) {
      finalizeTorCloseAll();
      pendingTorReloadRef.current = false;
      return;
    }
    if (pendingTorReloadRef.current) {
      pendingTorReloadRef.current = false;
      reloadActiveTabViews();
    }
  }, [finalizeTorCloseAll, reloadActiveTabViews, torDisableBusy, torEnabled]);

  useEffect(() => { isEditingRef.current = isEditing; }, [isEditing]);

  useEffect(() => {
    refreshNavigationState();
  }, [activeId, refreshNavigationState, tabsReady]);

  useEffect(() => {
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && target.tagName && target.tagName.toLowerCase() !== 'webview') {
        webviewFocusedRef.current = false;
      }
      if (isEditableElement(target)) {
        lastEditableMainRef.current = target;
      }
    };
    document.addEventListener('focusin', handleFocusIn, true);
    return () => {
      document.removeEventListener('focusin', handleFocusIn, true);
    };
  }, [isEditableElement]);

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

  useMobileSoftKeyboard({
    mode,
    isEditableElement,
    getActiveWebview,
    activeId,
    activeViewRevision,
    setKbVisible,
    oskPressGuardRef,
    ctxMenuGuardRef
  });
  const navigateToUrl = useCallback(
    (raw: string) => {
      const handle = getActiveWebviewHandle();
      const view = (handle && typeof handle.getWebView === 'function')
        ? handle.getWebView()
        : getActiveWebview();
      if (!handle && !view) return;
      const normalized = normalizeNavigationTarget(raw);
      const target = normalizeAddress(normalized.targetUrl);
      setInputValue(target);
      setStatus('loading');
      webviewReadyRef.current = false;
      setWebviewReady(false);
      const activeIdCurrent = activeIdRef.current;
      if (activeIdCurrent) {
        navigationStateRef.current.set(activeIdCurrent, {
          originalUrl: normalized.originalUrl,
          upgradedFromHttp: normalized.upgradedFromHttp,
          triedHttpFallback: false
        });
        allowHttpOnceRef.current.delete(activeIdCurrent);
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
      clearUrlSuggestions();
      navigateToUrl(url);
    },
    [clearUrlSuggestions, navigateToUrl]
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

  const kickActiveTabLoad = useCallback((attempt = 0) => {
    if (attempt > 12) {
      return;
    }
    const handle = getActiveWebviewHandle();
    const view = (handle && typeof handle.getWebView === 'function')
      ? handle.getWebView()
      : getActiveWebview();
    if (!handle && !view) {
      torKickTimerRef.current = window.setTimeout(() => kickActiveTabLoad(attempt + 1), 80);
      return;
    }
    if (view && 'isConnected' in view && !view.isConnected) {
      torKickTimerRef.current = window.setTimeout(() => kickActiveTabLoad(attempt + 1), 80);
      return;
    }
    const activeUrlCurrent = (activeTabRef.current?.url || '').trim() || DEFAULT_URL;
    setStatus('loading');
    reloadActiveAction();
    webviewReadyRef.current = false;
    setWebviewReady(false);
    try {
      if (handle) {
        try {
          handle.loadURL(activeUrlCurrent);
        } catch {
          const fallbackView = handle.getWebView?.();
          try { fallbackView?.setAttribute?.('src', activeUrlCurrent); } catch {}
        }
      } else if (view) {
        try {
          const result = view.loadURL(activeUrlCurrent);
          if (result && typeof result.catch === 'function') {
            result.catch(() => {});
          }
        } catch {
          try { view.setAttribute('src', activeUrlCurrent); } catch {}
        }
      }
    } catch {
      torKickTimerRef.current = window.setTimeout(() => kickActiveTabLoad(attempt + 1), 80);
    }
  }, [
    activeTabRef,
    getActiveWebview,
    getActiveWebviewHandle,
    reloadActiveAction,
    setStatus,
    setWebviewReady,
    webviewReadyRef
  ]);

  useEffect(() => {
    kickActiveTabLoadRef.current = kickActiveTabLoad;
  }, [kickActiveTabLoad]);

  const validateSecureDnsSettings = useCallback((settings: SecureDnsSettings): string => {
    if (!settings.enabled) return '';
    if (settings.provider === 'nextdns' && !(settings.nextdnsId ?? '').trim()) {
      return t('settings.network.secureDns.error.nextdns');
    }
    if (settings.provider === 'custom') {
      const rawUrl = (settings.customUrl ?? '').trim();
      if (!rawUrl) return t('settings.network.secureDns.error.custom');
      try {
        const url = new URL(rawUrl);
        if (url.protocol !== 'https:') {
          return t('settings.network.secureDns.error.custom');
        }
      } catch {
        return t('settings.network.secureDns.error.custom');
      }
    }
    return '';
  }, [t]);

  const applySecureDnsUpdate = useCallback(
    async (patch: Partial<SecureDnsSettings>) => {
      const next: SecureDnsSettings = {
        enabled: patch.enabled ?? secureDnsEnabled,
        mode: patch.mode ?? secureDnsMode,
        provider: patch.provider ?? secureDnsProvider,
        nextdnsId: patch.nextdnsId ?? secureDnsNextdnsId,
        customUrl: patch.customUrl ?? secureDnsCustomUrl
      };
      const validationError = validateSecureDnsSettings(next);
      if (validationError) {
        setSecureDnsError(validationError);
        return;
      }
      setSecureDnsError('');
      try {
        const res = await ipc.settings.secureDns.update(patch);
        if (res?.ok) {
          const settings = res.settings ?? next;
          setSecureDnsEnabled(settings.enabled);
          setSecureDnsMode(settings.mode);
          setSecureDnsProvider(settings.provider);
          setSecureDnsNextdnsId(settings.nextdnsId ?? '');
          setSecureDnsCustomUrl(settings.customUrl ?? '');
          showGlobalToast(t('settings.network.applied'));
          handleReload();
          return;
        }
        if (res?.error) {
          console.error('[merezhyvo] secure dns update failed', res.error);
        }
      } catch (err) {
        console.error('[merezhyvo] secure dns update failed', err);
      }
    },
    [
      handleReload,
      secureDnsCustomUrl,
      secureDnsEnabled,
      secureDnsMode,
      secureDnsNextdnsId,
      secureDnsProvider,
      showGlobalToast,
      t,
      validateSecureDnsSettings
    ]
  );

  const handleSecureDnsEnabledChange = useCallback((value: boolean) => {
    setSecureDnsEnabled(value);
    void applySecureDnsUpdate({ enabled: value });
  }, [applySecureDnsUpdate]);

  const handleSecureDnsModeChange = useCallback((value: SecureDnsMode) => {
    setSecureDnsMode(value);
    void applySecureDnsUpdate({ mode: value });
  }, [applySecureDnsUpdate]);

  const handleSecureDnsProviderChange = useCallback((value: SecureDnsProvider) => {
    setSecureDnsProvider(value);
    void applySecureDnsUpdate({ provider: value });
  }, [applySecureDnsUpdate]);

  const handleSecureDnsNextdnsIdChange = useCallback((value: string) => {
    setSecureDnsNextdnsId(value);
    if (secureDnsError) {
      setSecureDnsError('');
    }
  }, [secureDnsError]);

  const handleSecureDnsNextdnsIdCommit = useCallback(() => {
    void applySecureDnsUpdate({ nextdnsId: secureDnsNextdnsId });
  }, [applySecureDnsUpdate, secureDnsNextdnsId]);

  const handleSecureDnsCustomUrlChange = useCallback((value: string) => {
    setSecureDnsCustomUrl(value);
    if (secureDnsError) {
      setSecureDnsError('');
    }
  }, [secureDnsError]);

  const handleSecureDnsCustomUrlCommit = useCallback(() => {
    void applySecureDnsUpdate({ customUrl: secureDnsCustomUrl });
  }, [applySecureDnsUpdate, secureDnsCustomUrl]);

  const handleToggleCookieException = useCallback(
    async (allow: boolean) => {
      const host = activeSecurityHost;
      if (!host) return;
      try {
        const next = await window.merezhyvo?.settings?.cookies?.setException?.(host, allow);
        if (next) {
          setCookiePrivacy(next as CookiePrivacySettings);
          window.dispatchEvent(new CustomEvent('merezhyvo:cookies:updated', { detail: next }));
        }
        handleReload();
      } catch (err) {
        console.error('[merezhyvo] cookie exception toggle failed', err);
      }
    },
    [activeSecurityHost, handleReload, setCookiePrivacy]
  );

  const handleToggleTrackerException = useCallback(
    async (allow: boolean) => {
      const host = trackerStatus.siteHost;
      if (!host) return;
      try {
        await setTrackersSiteAllowed(host, allow);
        await refreshTrackerStatus(activeWcIdRef.current ?? null);
        handleReload();
      } catch (err) {
        console.error('[merezhyvo] tracker exception toggle failed', err);
      }
    },
    [handleReload, refreshTrackerStatus, setTrackersSiteAllowed, trackerStatus.siteHost]
  );

  const handleToggleAdsException = useCallback(
    async (allow: boolean) => {
      const host = trackerStatus.siteHost;
      if (!host) return;
      try {
        await setAdsSiteAllowed(host, allow);
        await refreshTrackerStatus(activeWcIdRef.current ?? null);
        handleReload();
      } catch (err) {
        console.error('[merezhyvo] ads exception toggle failed', err);
      }
    },
    [handleReload, refreshTrackerStatus, setAdsSiteAllowed, trackerStatus.siteHost]
  );

  const handleInputPointerDown = useCallback((_: ReactPointerEvent<HTMLInputElement>) => {
    activeInputRef.current = 'url';
  }, []);

  const handleInputFocus = useCallback((event: ReactFocusEvent<HTMLInputElement>) => {
    isEditingRef.current = true;
    setIsEditing(true);
    activeInputRef.current = 'url';
    const activeUrlCurrent = (activeTabRef.current?.url || '').trim() || DEFAULT_URL;
    setInputValue(activeUrlCurrent);
    event.target.select();
  }, []);

  const handleInputBlur = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    isEditingRef.current = false;
    setIsEditing(false);
    if (activeInputRef.current === 'url') activeInputRef.current = null;
    const activeUrlCurrent = (activeTabRef.current?.url || '').trim() || DEFAULT_URL;
    setInputValue(formatDisplayUrl(activeUrlCurrent));
  }, []);

  const handleKeyboardHeightChange = useCallback((height: number) => {
    setKeyboardHeight(height > 0 ? height : 0);
  }, []);

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

  const handleContextMenuClose = useCallback(() => {
    try {
      window.merezhyvo?.contextMenu?.close?.();
    } catch {
      // noop
    }
    setCtxMenuVisible(false);
    setCtxMenuHeight(0);
    scheduleCtxMenuGuardRelease();
  }, [scheduleCtxMenuGuardRelease]);

  const handleContextMenuAction = useCallback(
    async (id: string) => {
      const restoreFocus = async () => {
        if (ctxFocusRef.current.wasWebview) {
          const wv = getActiveWebview();
          try { wv?.focus?.(); } catch {}
          await focusEditableInWebview();
        } else if (ctxFocusRef.current.el && document.contains(ctxFocusRef.current.el)) {
          try { ctxFocusRef.current.el.focus({ preventScroll: true }); } catch {
            try { ctxFocusRef.current.el.focus(); } catch {}
          }
        }
      };
      await restoreFocus();
      if (id === 'paste') {
        setKbVisible(false);
        setTimeout(() => {
          try { window.merezhyvo?.contextMenu?.click?.(id); } catch {}
          handleContextMenuClose();
        }, 80);
        return;
      }
      try {
        window.merezhyvo?.contextMenu?.click?.(id);
      } catch {
        // noop
      }
      handleContextMenuClose();
    },
    [getActiveWebview, handleContextMenuClose, focusEditableInWebview]
  );
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
  }, [closeTabAction, tabViewsRef]);

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
  const closeServicePage = useCallback(() => {
    if (!activeTab) return;
    const currentId = activeTab.id;
    const nonService = tabs.find(
      (tab) =>
        tab.id !== currentId &&
        typeof tab.url === 'string' &&
        !tab.url.toLowerCase().startsWith('mzr://')
    );
    if (nonService) {
      activateTabAction(nonService.id);
    } else {
      newTabAction(DEFAULT_URL);
    }
    closeTabAction(currentId);
    setSecurityPopoverOpen(false);
    setShowTabsPanel(false);
  }, [activeTab, tabs, activateTabAction, newTabAction, closeTabAction]);
  const normalizeSiteDataHost = useCallback((host?: string | null) => {
    if (!host) return '';
    let safe = host.trim().toLowerCase();
    if (!safe) return '';
    if (safe.toLowerCase().startsWith('www.') && safe.length > 4) {
      safe = safe.slice(4);
    }
    return safe;
  }, []);
  const openSecurityExceptionsFromSettings = useCallback(() => {
    closeSettingsModal();
    openInNewTab('mzr://security-exceptions');
  }, [closeSettingsModal, openInNewTab]);
  const openSiteDataFromSettings = useCallback(() => {
    closeSettingsModal();
    openInNewTab('mzr://site-data');
  }, [closeSettingsModal, openInNewTab]);
  const openPrivacyInfoFromSettings = useCallback(() => {
    closeSettingsModal();
    openInNewTab('mzr://privacy-info');
  }, [closeSettingsModal, openInNewTab]);
  const openNetworkInfoFromSettings = useCallback(() => {
    closeSettingsModal();
    openInNewTab('mzr://network-info');
  }, [closeSettingsModal, openInNewTab]);
  const handleNetworkSectionOpen = useCallback(() => {
    if (!torEnabled) return;
    void refreshTorIp();
  }, [torEnabled, refreshTorIp]);
  const openSiteDataPage = useCallback(
    (host?: string | null) => {
      const targetHost = normalizeSiteDataHost(host);
      const url = targetHost ? `mzr://site-data?host=${encodeURIComponent(targetHost)}` : 'mzr://site-data';
      openInNewTab(url);
      setSecurityPopoverOpen(false);
    },
    [normalizeSiteDataHost, openInNewTab]
  );
  const openTrackersExceptionsFromPopover = useCallback(() => {
    openInNewTab('mzr://security-exceptions#trackers');
    setSecurityPopoverOpen(false);
  }, [openInNewTab]);
  const openPrivacyInfoFromPopover = useCallback(() => {
    openInNewTab('mzr://privacy-info');
    setSecurityPopoverOpen(false);
  }, [openInNewTab]);
  const handleOpenCouponsInfoFromSettings = useCallback(() => {
    closeSettingsModal();
    openInNewTab('mzr://coupons-info');
  }, [closeSettingsModal, openInNewTab]);
  const handleOpenCouponsInfoFromPopup = useCallback(() => {
    closeCouponsPopup();
    openInNewTab('mzr://coupons-info');
  }, [closeCouponsPopup, openInNewTab]);

  const handleCloseTab = useCallback((id: string) => {
    if (!id) return;
    closeTabAction(id);
  }, [closeTabAction]);

  const serviceUrl = (activeTab?.url ?? '').trim().toLowerCase();
  const isBookmarksService = serviceUrl.startsWith('mzr://bookmarks');
  const isHistoryService = serviceUrl.startsWith('mzr://history');
  const isPasswordsService = serviceUrl.startsWith('mzr://passwords');
  const isLicensesService = serviceUrl.startsWith('mzr://licenses');
  const isSecurityExceptionsService = serviceUrl.startsWith('mzr://security-exceptions');
  const isSiteDataService = serviceUrl.startsWith('mzr://site-data');
  const isPrivacyInfoService = serviceUrl.startsWith('mzr://privacy-info');
  const isStartService = serviceUrl.startsWith('mzr://start');
  const isNetworkInfoService = serviceUrl.startsWith('mzr://network-info') || serviceUrl.startsWith('mzr://tor-info');
  const showServiceOverlay =
    mainViewMode === 'browser' &&
    (isStartService || isBookmarksService || isHistoryService || isPasswordsService || isLicensesService || isSecurityExceptionsService || isSiteDataService || isPrivacyInfoService || isNetworkInfoService || isCouponsInfoService);
  let serviceContent = null;
  if (showServiceOverlay) {
    if (isStartService) {
      serviceContent = <StartPage mode={mode} openInTab={openInActiveTab} openInNewTab={openInNewTab} onClose={closeServicePage} />;
    } else if (isBookmarksService) {
      serviceContent = <BookmarksPage mode={mode} openInTab={openInActiveTab} openInNewTab={openInNewTab} onClose={closeServicePage} />;
    } else if (isHistoryService) {
      serviceContent = <HistoryPage mode={mode} openInTab={openInActiveTab} openInNewTab={openInNewTab} onClose={closeServicePage} />;
    } else if (isPasswordsService) {
      serviceContent = <PasswordsPage mode={mode} openInTab={openInActiveTab} openInNewTab={openInNewTab} onClose={closeServicePage} />;
    } else if (isLicensesService) {
      serviceContent = <LicensesPage mode={mode} onClose={closeServicePage} />;
    } else if (isSecurityExceptionsService) {
      serviceContent = (
        <SecurityExceptionsPage
          mode={mode}
          openInTab={openInActiveTab}
          openInNewTab={openInNewTab}
          serviceUrl={activeTab?.url}
          onClose={closeServicePage}
        />
      );
    } else if (isSiteDataService) {
      serviceContent = (
        <SiteDataPage
          mode={mode}
          openInTab={openInActiveTab}
          openInNewTab={openInNewTab}
          serviceUrl={activeTab?.url}
          onClose={closeServicePage}
        />
      );
    } else if (isPrivacyInfoService) {
      serviceContent = <PrivacyInfoPage mode={mode} openInTab={openInActiveTab} openInNewTab={openInNewTab} serviceUrl={activeTab?.url} onClose={closeServicePage} />;
    } else if (isCouponsInfoService) {
          serviceContent = (
            <CouponsInfoPage
              mode={mode}
              openInTab={openInActiveTab}
              openInNewTab={openInNewTab}
              serviceUrl={activeTab?.url}
              onClose={closeServicePage}
              savingsSettings={savingsSettings}
              effectiveCountry={effectiveSavingsCountry}
              onCountryChange={handleSavingsCountryChange}
              performCatalogFetch={performCatalogFetch}
            />
          );
    } else if (isNetworkInfoService) {
      serviceContent = <NetworkInfoPage mode={mode} openInTab={openInActiveTab} openInNewTab={openInNewTab} serviceUrl={activeTab?.url} onClose={closeServicePage} />;
    }
  }

  useEffect(() => {
    const wcId = getActiveWebContentsId();
    activeWcIdRef.current = wcId;
    void refreshCertStatus(wcId);
  }, [activeId, activeViewRevision, getActiveWebContentsId, refreshCertStatus]);

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
  }, [closeTabAction, tabViewsRef, tabs]);

  const handleTogglePin = useCallback((id: string) => {
    if (!id) return;
    pinTabAction(id);
  }, [pinTabAction]);

  const handleNewTab = useCallback(() => {
    newTabAction(DEFAULT_URL);
    setShowTabsPanel(false);
    blurActiveInWebview();
    if (!DEFAULT_URL.toLowerCase().startsWith('mzr://start')) {
      requestAnimationFrame(() => {
        try { inputRef.current?.focus?.(); } catch {}
      });
    }
  }, [blurActiveInWebview, newTabAction]);

  const statusLabelMap: Record<StatusState, string> = {
    loading: 'Loading',
    ready: 'Ready',
    error: 'Failed to load'
  };
  const tabLoadingOverlay = (
    <WebviewLoadingOverlay
      mode={mode}
      status={status}
      activeTabIsLoading={activeTabIsLoading}
    />
  );
  const webviewOverlay = (
    <>
      {tabLoadingOverlay}
      <CouponsFloatingButton
        mode={mode}
        visible={couponsButtonVisible}
        containerRef={webviewHostRef}
        position={savingsSettings.floatingButtonPos}
        resetKey={activeHost}
        onPositionChange={handleCouponsPositionChange}
        onClick={handleOpenCouponsPopup}
      />
    </>
  );
  const webviewVisibility = status === 'error' || certWarning ? 'hidden' : 'visible';

  const handleErrorRetry = useCallback(() => {
    setPageError(null);
    lastFailedUrlRef.current = null;
    ignoreUrlChangeRef.current = false;
    handleReload();
  }, [handleReload]);

  const errorOverlay = (
    <WebviewErrorOverlay
      mode={mode}
      status={status}
      pageError={pageError}
      title={t('webview.error.title')}
      subtitle={t('webview.error.subtitle')}
      retryLabel={t('webview.error.retry')}
      onRetry={handleErrorRetry}
    />
  );

  const overlayCert = displayCertEffective ?? certStatus ?? blockingCertRef.current;
  const handleCertCancel = useCallback(() => {
    if (activeId) closeTabAction(activeId);
  }, [activeId, closeTabAction]);

  const handleCertProceed = useCallback(async () => {
    if (!activeId) return;
    if (rememberExceptionChecked && certHost && certErrorType) {
      void upsertSslException(certHost, certErrorType, true);
    }
    certBypassRef.current.add(activeId);
    const wcId = activeWcIdRef.current;
    if (certStatus?.state === 'invalid' && wcId) {
      try {
        await window.merezhyvo?.certificates?.continue?.(wcId);
      } catch {
        // ignore
      }
      setStatus('loading');
      setWebviewReady(false);
      return;
    }
    setCertStatus(null);
    setStatus('loading');
    setWebviewReady(false);
    setRememberExceptionChecked(false);
  }, [activeId, certErrorType, certHost, certStatus, rememberExceptionChecked, setCertStatus, setStatus, setWebviewReady, upsertSslException]);

  const certOverlay = certWarning && overlayCert ? (
    <CertOverlay
      mode={mode}
      cert={overlayCert}
      rememberChecked={rememberExceptionChecked}
      onRememberChange={setRememberExceptionChecked}
      onCancel={handleCertCancel}
      onProceed={handleCertProceed}
      title={overlayCert.state === 'missing' ? t('cert.title.missing') : t('cert.title.invalid')}
      description={
        overlayCert.state === 'missing'
          ? t('cert.desc.missing')
          : overlayCert.error
            ? overlayCert.error
            : t('cert.desc.invalid')
      }
      rememberLabel={t('cert.actions.remember')}
      cancelLabel={t('cert.actions.cancel')}
      proceedLabel={t('cert.actions.proceed')}
      issuerLabel={t('cert.details.issuer')}
      subjectLabel={t('cert.details.subject')}
      serialLabel={t('cert.details.serial')}
      validFromLabel={t('cert.details.validFrom')}
      validToLabel={t('cert.details.validTo')}
      fingerprintLabel={t('cert.details.fingerprint')}
    />
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
    const baseBg = themeVars['bg'] ?? '#0F1525';
    const accentTint = themeVars['accent-tint'] ?? 'rgba(37, 99, 235, 0.12)';
    const borderStrong = themeVars['border-strong'] ?? themeVars['border'] ?? 'rgba(148,163,184,0.35)';
    const textPrimary = themeVars['text-primary'] ?? '#EAF0FF';
    const textSecondary = themeVars['text-secondary'] ?? '#B9C3D8';
    const surface = themeVars['surface'] ?? '#121826';
    const surfaceMuted = themeVars['surface-muted'] ?? '#0b1020';
    const accent = themeVars['accent'] ?? '#235CDC';
    const accentStrong = themeVars['accent-strong'] ?? '#1d4ed8';
    const urlDisplay = urlDisplayValue
      ? `<div style="margin-top:12px;padding:10px 14px;border-radius:12px;background:${surfaceMuted};border:1px solid ${borderStrong};font-size:14px;word-break:break-all;color:${textPrimary};">${urlDisplayValue}</div>`
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
            color-scheme: ${themeVars['color-scheme'] ?? 'dark'};
            --mzr-bg: ${baseBg};
            --mzr-surface: ${surface};
            --mzr-border: ${borderStrong};
            --mzr-text-primary: ${textPrimary};
            --mzr-text-secondary: ${textSecondary};
            --mzr-accent: ${accent};
            --mzr-accent-strong: ${accentStrong};
            --mzr-accent-tint: ${accentTint};
          }
          body {
            margin:0;
            min-height:100vh;
            display:flex;
            align-items:center;
            justify-content:center;
            background: radial-gradient(circle at 20% 20%, var(--mzr-accent-tint), var(--mzr-bg));
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color:var(--mzr-text-secondary);
            padding:20px;
            text-align:center;
          }
          .card {
            max-width: 640px;
            width: 100%;
            background: var(--mzr-surface);
            border: 1px solid var(--mzr-border);
            border-radius: 18px;
            padding: 28px;
            box-shadow: 0 14px 42px rgba(0,0,0,0.35);
          }
          h1 {
            margin: 0 0 12px;
            font-size: 22px;
            color: var(--mzr-text-primary);
          }
          p {
            margin: 0;
            font-size: 15px;
            line-height: 1.6;
            color: var(--mzr-text-secondary);
          }
          button {
            margin-top: 18px;
            padding: 12px 18px;
            border-radius: 12px;
            border: 1px solid var(--mzr-accent-strong);
            background: var(--mzr-accent-tint);
            color: var(--mzr-text-primary);
            font-size: 15px;
            cursor: pointer;
          }
          button:hover {
            background: var(--mzr-accent);
            color: #f8fafc;
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
  }, [pageError, status, t, themeVars, webviewRef]);

  const {
    toolbarRef,
    messengerToolbarRef,
    toolbarHeight,
    messengerToolbarHeight
  } = useToolbarHeights({ mode, uiScale, mainViewMode, isHtmlFullscreen });

  const keyboardOffset = kbVisible ? Math.max(0, keyboardHeight) : 0;
  const contentTop = mainViewMode === 'messenger' ? messengerToolbarHeight : toolbarHeight;
  const ctxMenuOffset = ctxMenuVisible ? Math.max(0, ctxMenuHeight) : 0;
  const contentBottom = Math.max(kbVisible ? keyboardOffset : zoomBarHeight, ctxMenuOffset);
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
              onInputChange={(value: string) => setInputValue(value)}
              onInputPointerDown={handleInputPointerDown}
              onInputFocus={handleInputFocus}
              onInputBlur={handleInputBlur}
              onOpenTabsPanel={openTabsPanel}
              onNewTab={handleNewTab}
              onToggleTor={handleTorToggleRequest}
              onOpenSettings={openSettingsModal}
              onEnterMessengerMode={handleEnterMessengerMode}
              showMessengerButton={!messengerSettingsState?.hideToolbar}
              downloadIndicatorState={downloadIndicatorState}
              onDownloadIndicatorClick={handleDownloadIndicatorClick}
              toolbarRef={toolbarRef}
              suggestions={urlSuggestions}
              onSelectSuggestion={handleSuggestionSelect}
              onCopyUrl={handleCopyUrl}
              securityState={securityState}
              securityInfo={securityInfo}
              securityOpen={securityPopoverOpen}
              onToggleSecurity={() => setSecurityPopoverOpen((prev) => !prev)}
              certExceptionAllowed={certExceptionAllowed}
              onToggleCertException={handleToggleCertException}
              cookiePolicy={siteCookiePolicy}
              onToggleCookieException={handleToggleCookieException}
              onOpenSiteData={openSiteDataPage}
              onOpenSecurityExceptions={() => openInNewTab('mzr://security-exceptions')}
              onOpenPrivacyInfo={openPrivacyInfoFromPopover}
              trackerStatus={trackerStatus}
              onToggleTrackerException={handleToggleTrackerException}
              onToggleAdsException={handleToggleAdsException}
              onOpenTrackersExceptions={openTrackersExceptionsFromPopover}
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
              securityState={securityState}
              securityInfo={securityInfo}
              certExceptionAllowed={certExceptionAllowed}
              onToggleCertException={handleToggleCertException}
              cookiePolicy={siteCookiePolicy}
              onToggleCookieException={handleToggleCookieException}
              onOpenSiteData={openSiteDataPage}
              onOpenPrivacyInfo={openPrivacyInfoFromPopover}
              onOpenSecurityExceptions={() => openInNewTab('mzr://security-exceptions')}
              trackerStatus={trackerStatus}
              onToggleTrackerException={handleToggleTrackerException}
              onToggleAdsException={handleToggleAdsException}
              onOpenTrackersExceptions={openTrackersExceptionsFromPopover}
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
              onNetworkSectionOpen={handleNetworkSectionOpen}
              secureDnsEnabled={secureDnsEnabled}
              secureDnsMode={secureDnsMode}
              secureDnsProvider={secureDnsProvider}
              secureDnsNextdnsId={secureDnsNextdnsId}
              secureDnsCustomUrl={secureDnsCustomUrl}
              secureDnsError={secureDnsError}
              onSecureDnsEnabledChange={handleSecureDnsEnabledChange}
              onSecureDnsModeChange={handleSecureDnsModeChange}
              onSecureDnsProviderChange={handleSecureDnsProviderChange}
              onSecureDnsNextdnsIdChange={handleSecureDnsNextdnsIdChange}
              onSecureDnsNextdnsIdCommit={handleSecureDnsNextdnsIdCommit}
              onSecureDnsCustomUrlChange={handleSecureDnsCustomUrlChange}
              onSecureDnsCustomUrlCommit={handleSecureDnsCustomUrlCommit}
              onClose={closeSettingsModal}
              onOpenPasswords={openPasswordsFromSettings}
              messengerItems={orderedMessengers}
              messengerOrderSaving={messengerOrderSaving}
              messengerOrderMessage={messengerOrderMessage}
              onMessengerMove={handleMessengerMove}
              hideMessengerToolbar={Boolean(messengerSettingsState?.hideToolbar)}
              onToggleMessengerToolbar={handleToggleMessengerToolbarVisibility}
              onRequestPasswordUnlock={requestPasswordUnlock}
              scrollToSection={settingsScrollTarget}
              onScrollSectionHandled={() => setSettingsScrollTarget(null)}
              onOpenLicenses={openLicensesFromSettings}
              downloadsConcurrent={downloadsConcurrent}
              downloadsSaving={downloadsSaving}
              onDownloadsConcurrentChange={handleDownloadsConcurrentChange}
              onCopyDownloadsCommand={handleCopyDownloadsCommand}
              downloadsCommand={downloadsCommand}
              savingsEnabled={savingsSettings.enabled}
              savingsCountrySaved={savingsSettings.countrySaved}
              onSavingsEnabledChange={handleSavingsEnabledChange}
              onSavingsCountryChange={handleSavingsCountryChange}
              uiScale={uiScale}
              webZoomMobileDefault={webZoomDefaults.mobile}
              webZoomDesktopDefault={webZoomDefaults.desktop}
              onWebZoomMobileChange={handleWebZoomMobileChange}
              onWebZoomDesktopChange={handleWebZoomDesktopChange}
              theme={theme}
              onUiScaleChange={applyUiScale}
              onUiScaleReset={handleUiScaleReset}
              onThemeChange={handleThemeChange}
              onOpenTorLink={handleOpenTorProjectLink}
              onOpenNetworkInfo={openNetworkInfoFromSettings}
              httpsMode={httpsMode}
              onHttpsModeChange={handleHttpsModeChange}
              webrtcMode={webrtcMode}
              onWebrtcModeChange={handleWebrtcModeChange}
              cookiesBlockThirdParty={cookiePrivacy.blockThirdParty}
              onCookieBlockChange={handleCookieBlockChange}
              onOpenSecurityExceptions={openSecurityExceptionsFromSettings}
              onOpenSiteData={openSiteDataFromSettings}
              onOpenPrivacyInfo={openPrivacyInfoFromSettings}
              onOpenCouponsInfo={handleOpenCouponsInfoFromSettings}
              blockingMode={trackerStatus.blockingMode}
              onBlockingModeChange={setBlockingMode}
              trackersEnabled={trackerStatus.trackersEnabledGlobal}
              adsEnabled={trackerStatus.adsEnabledGlobal}
              onTrackersEnabledChange={setTrackersEnabledGlobal}
              onAdsEnabledChange={setAdsEnabledGlobal}
              onOpenTrackersExceptions={openSecurityExceptionsFromSettings}
            />
          )}

          <TorDisableDialog
            open={showTorDisableDialog}
            mode={mode}
            busy={torDisableBusy}
            onCloseAll={handleTorDisableCloseAll}
            onKeepTabs={handleTorDisableKeepTabs}
            onCancel={handleTorDisableCancel}
          />
          <TorKeepEnabledDialog
            open={showTorKeepWarning}
            mode={mode}
            onCancel={handleTorKeepWarningCancel}
            onOpenSettings={handleTorKeepWarningOpenSettings}
          />

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
          <CouponsPopup
            mode={mode}
            visible={couponsPopupVisible}
            host={popupHost}
            pageOrigin={popupOrigin}
            country={couponsPopupCountry}
            status={couponsPopupState.status}
            data={couponsPopupState.data}
            errorMessage={couponsPopupState.errorMessage}
            syncingUntil={couponsPopupState.syncingUntil ?? null}
            onCountryChange={handleCouponsCountryChange}
            onFindCoupons={handleFindCoupons}
            onClose={closeCouponsPopup}
            pendingCoupon={pendingCouponState}
            couponActionState={couponActionState}
            activeHost={activeHost ?? ''}
            onApplyCoupon={handleApplyCoupon}
            onInsertCoupon={handleInsertCoupon}
            onReportInvalid={handleReportInvalidCoupon}
            onOpenCouponsInfo={handleOpenCouponsInfoFromPopup}
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

          <ContextMenuPanel
            visible={ctxMenuVisible}
            mode={mode}
            state={ctxMenuState}
            onClose={handleContextMenuClose}
            onAction={handleContextMenuAction}
            onHeightChange={setCtxMenuHeight}
          />

          <KeyboardPane
            visible={kbVisible}
            layoutId={kbLayout}
            enabledLayouts={enabledKbLayouts}
            context="text"
            theme={theme}
            themeVars={themeVars}
            injectText={injectText}
            injectBackspace={injectBackspace}
            injectEnter={injectEnter}
            injectArrow={injectArrow}
            onSetLayout={setKbLayout}
            onEnterShouldClose={onEnterShouldClose}
            onClose={closeKeyboard}
            onCycleLayout={() => setKbLayout(prev => nextLayoutId(prev, enabledKbLayouts))}
            onHeightChange={handleKeyboardHeightChange}
            onInteractionStart={() => {
              oskPressGuardRef.current = true;
              if (!isEditableMainNow()) {
                try { getActiveWebview()?.focus?.(); } catch {}
              }
            }}
            onInteractionEnd={() => {
              window.setTimeout(() => { oskPressGuardRef.current = false; }, 150);
              if (!isEditableMainNow()) {
                try { getActiveWebview()?.focus?.(); } catch {}
              }
            }}
          />
      <FileDialogHost mode={mode} onCopyCommand={handleCopyDocumentsCommand} />
      <JsDialogHost mode={mode} />
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
            overlay={webviewOverlay}
          />
          {errorOverlay}
          {serviceContent && (
        <div style={SERVICE_OVERLAY_STYLE} className="service-scroll">
          {serviceContent}
        </div>
      )}
          {certOverlay}
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
