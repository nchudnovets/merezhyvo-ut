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
import CouponsPopup, { type CouponsPopupStatus } from './components/coupons/CouponsPopup';
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
import { JsDialogHost } from './components/modals/jsDialog/JsDialogHost';
import { useI18n } from './i18n/I18nProvider';
import { ipc } from './services/ipc/ipc';
import { torService } from './services/tor/tor';
import { windowHelpers } from './services/window/window';
import { fetchCouponsForPage } from './services/coupons/api';
import { getCachedCouponsForPage, setCachedCouponsForPage } from './services/coupons/cache';
import { getTabsState, useTabsStore, tabsActions } from './store/tabs';
import { DEFAULT_URL, normalizeAddress, normalizeNavigationTarget, parseStartUrl, toHttpUrl } from './utils/navigation';
import { deriveErrorType, HTTP_ERROR_TYPE, isLikelyCertError, isSubdomainOrSame, normalizeHost } from './utils/security';
import { getPopupCountry } from './utils/savings';
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
  SecureDnsSettings,
  SavingsSettings,
  CouponsForPageResponse,
  CouponEntry,
  PendingCoupon
} from './types/models';
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
import { DEFAULT_SAVINGS_CATALOG, DEFAULT_SAVINGS_SETTINGS, getEffectiveCountry, mergeSavingsSettings, normalizeCountryCode } from './utils/savings';
import { fetchMerchantsCatalog, reportInvalidCoupon } from './services/coupons/api';
// import { PermissionPrompt } from './components/modals/permissions/PermissionPrompt';
// import { ToastCenter } from './components/notifications/ToastCenter';

type ActiveInputTarget = 'url' | null;

type LastLoadedInfo = {
  id: string | null;
  url: string | null;
};

type KeyboardDirection = 'ArrowLeft' | 'ArrowRight';

type SecurityIndicatorState = 'ok' | 'warn' | 'notice';
type CouponsPopupDataState = {
  status: CouponsPopupStatus;
  data?: CouponsForPageResponse;
  errorMessage?: string;
  syncingUntil?: string | null;
};

const deriveHostnameFromUrl = (value?: string | null): string => {
  if (!value) return '';
  try {
    const url = new URL(value);
    let host = url.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }
    return host;
  } catch {
    let safe = value.trim().toLowerCase();
    if (!safe) return '';
    const slashIndex = safe.indexOf('/');
    if (slashIndex !== -1) {
      safe = safe.slice(0, slashIndex);
    }
    if (safe.startsWith('www.')) {
      safe = safe.slice(4);
    }
    return safe;
  }
};

const deriveOriginFromUrl = (value?: string | null): string => {
  if (!value) return '';
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}`;
  } catch {
    const host = deriveHostnameFromUrl(value);
    return host ? `https://${host}` : '';
  }
};

type MainBrowserAppProps = {
  initialUrl: string;
  mode: Mode;
  hasStartParam: boolean;
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

const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
const PENDING_COUPON_TTL_MS = 2 * 60 * 60 * 1000;

const COUPON_FIELD_KEYWORDS = [
  'coupon', 'coupons', 'promo', 'promocode', 'promo code', 'discount', 'voucher', 'code', 'gift', 'deal'
];
const CART_PAGE_KEYWORDS = ['cart', 'checkout', 'basket', 'order', 'payment', 'bag'];

const isHostMatchingDomain = (host: string | null | undefined, domain: string): boolean => {
  if (!host || !domain) return false;
  const normalizedHost = host.toLowerCase();
  const normalizedDomain = domain.toLowerCase();
  if (normalizedHost === normalizedDomain) return true;
  if (normalizedHost.endsWith(`.${normalizedDomain}`)) return true;
  if (normalizedDomain.endsWith(`.${normalizedHost}`)) return true;
  return false;
};

const buildInsertCouponScript = (code: string, requireCheckoutKeywords: boolean, requireCouponKeywords: boolean): string => {
  const fieldKeywords = JSON.stringify(COUPON_FIELD_KEYWORDS);
  const pageKeywords = JSON.stringify(CART_PAGE_KEYWORDS);
  return `
    (() => {
      const couponCode = ${JSON.stringify(code)};
      if (!couponCode) {
        return { inserted: false, reason: 'empty_code' };
      }
      const keywords = ${fieldKeywords};
      const pageKeywords = ${pageKeywords};
      const requireCheckout = ${requireCheckoutKeywords ? 'true' : 'false'};
      const normalize = (value) => (value ? value.toLowerCase() : '');
      const path = normalize(location.pathname);
      const title = normalize(document.title);
      if (requireCheckout) {
        const matches = pageKeywords.some((keyword) => path.includes(keyword) || title.includes(keyword));
        if (!matches) {
          return { inserted: false, reason: 'not_cart' };
        }
      }
      const isTextInput = (el) => {
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'textarea') {
          return true;
        }
        if (tag !== 'input') {
          return false;
        }
        const type = (el.getAttribute('type') || '').toLowerCase();
        const blocked = ['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'hidden', 'image', 'range', 'color', 'date', 'time', 'datetime-local'];
        if (blocked.includes(type) || type === 'password') {
          return false;
        }
        return true;
      };
      const collectElements = () => Array.from(document.querySelectorAll('input, textarea')).filter(
        (el) => el && el instanceof HTMLElement && isTextInput(el)
      );
      const getLabelText = (el) => {
        if (el.labels && el.labels.length) {
          return Array.from(el.labels).map((label) => label.textContent || '').join(' ').toLowerCase();
        }
        const ancestor = el.closest('label');
        if (ancestor) {
          return (ancestor.textContent || '').toLowerCase();
        }
        return '';
      };
      const buildHaystack = (el) => {
        const pieces = [
          el.id,
          el.name,
          el.placeholder,
          el.getAttribute('aria-label'),
          el.getAttribute('title'),
          el.className,
          getLabelText(el)
        ];
        const haystack = pieces.filter(Boolean).join(' ').toLowerCase();
        return haystack;
      };
      const scoreElement = (el) => {
        const haystack = buildHaystack(el);
        let score = 0;
        keywords.forEach((keyword) => {
          if (haystack.includes(keyword)) {
            score += 10;
          }
        });
        return { score, haystack };
      };
      const attemptInsertion = () => {
        const elements = collectElements();
        if (!elements.length) {
          return { inserted: false, reason: 'no_candidates' };
        }
        const scored = elements.map((element) => ({ element, ...scoreElement(element) }));
        const priority = scored.filter((item) => item.score > 0);
        const candidates = priority.length ? priority : scored;
        let best = { element: null, score: -1 };
        for (const candidate of candidates) {
          if (candidate.score > best.score) {
            best = { element: candidate.element, score: candidate.score };
          }
        }
        const target = best.element || (candidates[0] && candidates[0].element);
        if (!target) {
          return { inserted: false, reason: 'no_target' };
        }
        if (${requireCouponKeywords ? 'true' : 'false'} && best.score <= 0) {
          return { inserted: false, reason: 'no_coupon_field' };
        }
        try {
          target.focus?.();
        } catch {}
        try {
          const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value');
          if (descriptor && typeof descriptor.set === 'function') {
            descriptor.set.call(target, couponCode);
          } else {
            target.value = couponCode;
          }
        } catch {}
        ['input', 'change', 'keyup'].forEach((eventName) => {
          try {
            target.dispatchEvent(new Event(eventName, { bubbles: true }));
          } catch {}
        });
        return { inserted: true, reason: 'inserted' };
      };
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const runAttempts = async () => {
        let result = { inserted: false, reason: 'no_attempt' };
        for (let attempt = 0; attempt < 4; attempt += 1) {
          result = attemptInsertion();
          if (result.inserted) {
            return result;
          }
          if (attempt < 3) {
            await delay(1000);
          }
        }
        return result;
      };
      return runAttempts();
    })();
  `;
};

const tryInsertCouponCode = async (
  view: WebviewTag,
  code: string,
  requireCheckoutKeywords = false,
  requireCouponKeywords = false
): Promise<{ inserted: boolean; reason?: string }> => {
  if (!code) {
    return { inserted: false, reason: 'empty_code' };
  }
  try {
    const script = buildInsertCouponScript(code, requireCheckoutKeywords, requireCouponKeywords);
    const result = await view.executeJavaScript(script, false);
    if (result && typeof result === 'object' && typeof (result as { inserted?: unknown }).inserted === 'boolean') {
      return {
        inserted: Boolean((result as { inserted: unknown }).inserted),
        reason: typeof (result as { reason?: unknown }).reason === 'string'
          ? (result as { reason: string }).reason
          : undefined
      };
    }
    return { inserted: false, reason: 'unexpected_result' };
  } catch {
    return { inserted: false, reason: 'exception' };
  }
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

  const [inputValue, setInputValue] = useState<string>(initialUrl);
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
  const { enabledKbLayouts, kbLayout, setKbLayout } = useKeyboardLayouts();
  const [downloadsConcurrent, setDownloadsConcurrent] = useState<1 | 2 | 3>(2);
  const [downloadsSaving, setDownloadsSaving] = useState<boolean>(false);
  const [couponsPopupVisible, setCouponsPopupVisible] = useState<boolean>(false);
  const [couponsPopupCountry, setCouponsPopupCountry] = useState<string>('US');
  const [couponsPopupState, setCouponsPopupState] = useState<CouponsPopupDataState>({ status: 'idle' });
  const [couponActionState, setCouponActionState] = useState<Record<string, { applying?: boolean; inserting?: boolean; reporting?: boolean }>>({});
  const [savingsSettings, setSavingsSettings] = useState<SavingsSettings>(DEFAULT_SAVINGS_SETTINGS);
  const savingsSettingsRef = useRef<SavingsSettings>(DEFAULT_SAVINGS_SETTINGS);
  const autoInsertKeyRef = useRef<string | null>(null);
  const [pendingCouponState, setPendingCouponState] = useState<PendingCoupon | null>(null);
  const [detectedCountry, setDetectedCountry] = useState<string>('US');
  const detectedCountryFetchRef = useRef<boolean>(false);
  const detectedCountryTimerRef = useRef<number | null>(null);
  const [savingsLoaded, setSavingsLoaded] = useState<boolean>(false);
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
  const torKickTimerRef = useRef<number | null>(null);
  const kickActiveTabLoadRef = useRef<((attempt?: number) => void) | null>(null);
  const catalogFetchInFlightRef = useRef<boolean>(false);
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

  const isServiceTab = (tab: Tab): boolean => (tab.url ?? '').trim().toLowerCase().startsWith('mzr://');
  const pinnedTabs = useMemo(() => tabs.filter((tab) => tab.pinned && !isServiceTab(tab)), [tabs]);
  const regularTabs = useMemo(() => tabs.filter((tab) => !tab.pinned && !isServiceTab(tab)), [tabs]);
  const tabCount = pinnedTabs.length + regularTabs.length;
  const activeTabIsLoading = !!activeTab?.isLoading;
  const activeUrl = (activeTab?.url && activeTab.url.trim()) ? activeTab.url : DEFAULT_URL;
  const activeHost = normalizeHost(activeTab?.url);
  const effectiveSavingsCountry = useMemo(
    () => getEffectiveCountry(savingsSettings.countrySaved, savingsSettings.lastPopupCountry, detectedCountry),
    [savingsSettings.countrySaved, savingsSettings.lastPopupCountry, detectedCountry]
  );
  const couponsButtonVisible = useMemo(() => {
    if (!savingsSettings.enabled) return false;
    if (activeUrl.toLowerCase().startsWith('mzr://')) return false;
    if (!activeHost) return false;
    const catalog = savingsSettings.catalog;
    if (!catalog || catalog.domains.length === 0) return false;
    if (catalog.country !== effectiveSavingsCountry) return false;
    return catalog.domains.some((domain) => (
      activeHost === domain ||
      activeHost.endsWith(`.${domain}`) ||
      domain.endsWith(`.${activeHost}`)
    ));
  }, [activeHost, activeUrl, effectiveSavingsCountry, savingsSettings.catalog, savingsSettings.enabled]);
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

  
  useEffect(() => {
    ipc.notifyTabsReady();
  }, []);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { tabsReadyRef.current = tabsReady; }, [tabsReady]);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);
  useEffect(() => { savingsSettingsRef.current = savingsSettings; }, [savingsSettings]);
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
  useEffect(() => { previousActiveTabRef.current = activeTab; }, [activeTab]);
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

  const updateSavingsSettings = useCallback(async (patch: Partial<SavingsSettings>) => {
    const payload = mergeSavingsSettings(savingsSettingsRef.current, patch);
    savingsSettingsRef.current = payload;
    setSavingsSettings(payload);
    try {
      const next = await ipc.settings.savings.update(payload);
      if (next) {
        savingsSettingsRef.current = next;
        setSavingsSettings(next);
        return next;
      }
    } catch (err) {
      console.error('[merezhyvo] savings settings update failed', err);
    }
    return savingsSettingsRef.current;
  }, []);

  useEffect(() => {
    const coupon = savingsSettings.pendingCoupon ?? null;
    if (!coupon) {
      setPendingCouponState(null);
      return;
    }
    const expires = Date.parse(coupon.expiresAt);
    if (!Number.isFinite(expires) || expires <= Date.now()) {
      void updateSavingsSettings({ pendingCoupon: null });
      setPendingCouponState(null);
      return;
    }
    setPendingCouponState(coupon);
  }, [savingsSettings.pendingCoupon, updateSavingsSettings]);

  useEffect(() => {
    autoInsertKeyRef.current = null;
  }, [pendingCouponState?.couponId]);

  const handleSavingsEnabledChange = useCallback(
    (value: boolean) => {
      void updateSavingsSettings({ enabled: value });
    },
    [updateSavingsSettings]
  );

  const handleSavingsCountryChange = useCallback(
    (value: string | null) => {
      const normalized = normalizeCountryCode(value);
      void updateSavingsSettings({
        countrySaved: normalized,
        catalog: { ...DEFAULT_SAVINGS_CATALOG, country: normalized }
      });
    },
    [updateSavingsSettings]
  );

  const performCatalogFetch = useCallback(async (country: string, etag: string | null) => {
    if (catalogFetchInFlightRef.current) return;
    catalogFetchInFlightRef.current = true;
    const attemptIso = new Date().toISOString();
    const baseCatalog = savingsSettingsRef.current.catalog;
    void updateSavingsSettings({
      catalog: {
        ...baseCatalog,
        country,
        lastFetchAttemptAt: attemptIso
      }
    });
    try {
      const result = await fetchMerchantsCatalog(country, etag ?? undefined, appInfo.version);
      const nowIso = new Date().toISOString();
      if (result.status === 'ok') {
        void updateSavingsSettings({
          catalog: {
            ...baseCatalog,
            country,
            domains: result.domains,
            etag: result.etag ?? baseCatalog.etag ?? null,
            updatedAt: nowIso,
            nextAllowedFetchAt: null,
            lastFetchAttemptAt: nowIso
          }
        });
      } else if (result.status === 'not_modified') {
        void updateSavingsSettings({
          catalog: {
            ...baseCatalog,
            country,
            etag: result.etag ?? etag ?? baseCatalog.etag ?? null,
            updatedAt: nowIso,
            nextAllowedFetchAt: null,
            lastFetchAttemptAt: nowIso
          }
        });
      } else if (result.status === 'syncing') {
        const nextAllowedFetchAt = new Date(Date.now() + result.retryAfterSeconds * 1000).toISOString();
        void updateSavingsSettings({
          catalog: {
            ...baseCatalog,
            country,
            nextAllowedFetchAt,
            lastFetchAttemptAt: nowIso
          }
        });
      }
    } finally {
      catalogFetchInFlightRef.current = false;
    }
  }, [appInfo.version, updateSavingsSettings]);

  useEffect(() => {
    if (!savingsLoaded) return;
    const catalog = savingsSettings.catalog;
    const now = Date.now();
    const nextAllowedAt = catalog.nextAllowedFetchAt ? Date.parse(catalog.nextAllowedFetchAt) : 0;
    if (Number.isFinite(nextAllowedAt) && nextAllowedAt > now) return;
    if (catalog.country && catalog.country !== effectiveSavingsCountry) {
      void updateSavingsSettings({
        catalog: { ...DEFAULT_SAVINGS_CATALOG, country: effectiveSavingsCountry }
      });
      return;
    }
    const updatedAt = catalog.updatedAt ? Date.parse(catalog.updatedAt) : 0;
    const isFresh = catalog.country === effectiveSavingsCountry
      && Number.isFinite(updatedAt)
      && now - updatedAt < CATALOG_TTL_MS;
    if (isFresh) return;
    void performCatalogFetch(effectiveSavingsCountry, catalog.etag);
  }, [
    effectiveSavingsCountry,
    performCatalogFetch,
    savingsLoaded,
    savingsSettings.catalog,
    updateSavingsSettings
  ]);

  const handleOpenCouponsPopup = useCallback(() => {
    const nextCountry = getPopupCountry(savingsSettings, detectedCountry);
    setCouponsPopupCountry(nextCountry);
    setCouponsPopupState({ status: 'idle' });
    setCouponsPopupVisible(true);
    if (!savingsSettings.countrySaved) {
      void updateSavingsSettings({ lastPopupCountry: nextCountry });
    }
  }, [detectedCountry, savingsSettings, updateSavingsSettings]);

  const handleCouponsCountryChange = useCallback((value: string) => {
    setCouponsPopupCountry(value);
    setCouponsPopupState({ status: 'idle' });
    void updateSavingsSettings({ lastPopupCountry: value });
  }, [updateSavingsSettings]);

  const handleFindCoupons = useCallback(async () => {
    const hostname = deriveHostnameFromUrl(activeTab?.url);
    if (!hostname) {
      setCouponsPopupState({ status: 'error', errorMessage: t('coupons.popup.error') });
      return;
    }
    const nextRetry = savingsSettings.syncRetryByCountry[couponsPopupCountry];
    if (nextRetry && Date.parse(nextRetry) > Date.now()) {
      setCouponsPopupState({ status: 'syncing', syncingUntil: nextRetry });
      return;
    }
    setCouponsPopupState({ status: 'loading' });
    const currentUrl = activeTab?.url ?? '';
    const pageOrigin = deriveOriginFromUrl(currentUrl);
    if (!pageOrigin) {
      setCouponsPopupState({ status: 'error', errorMessage: t('coupons.popup.error') });
      return;
    }
    const result = await fetchCouponsForPage({
      country: couponsPopupCountry,
      url: pageOrigin,
      clientVersion: appInfo.version
    });
    if (result.status === 'ok') {
      setCachedCouponsForPage(couponsPopupCountry, hostname, result.data);
      setCouponsPopupState({ status: 'results', data: result.data });
      return;
    }
    if (result.status === 'syncing') {
      const until = new Date(Date.now() + result.retryAfterSeconds * 1000).toISOString();
      void updateSavingsSettings({ syncRetryByCountry: { [couponsPopupCountry]: until } });
      setCouponsPopupState({ status: 'syncing', syncingUntil: until });
      return;
    }
    setCouponsPopupState({ status: 'error', errorMessage: result.error });
  }, [
    activeTab?.url,
    appInfo.version,
    couponsPopupCountry,
    savingsSettings.syncRetryByCountry,
    t,
    updateSavingsSettings
  ]);

  const updateCouponActionState = useCallback((couponId: string, changes: Partial<{ applying?: boolean; inserting?: boolean; reporting?: boolean }>) => {
    setCouponActionState((prev) => {
      const entry = prev[couponId] ?? {};
      const nextEntry = { ...entry, ...changes };
      if (!nextEntry.applying && !nextEntry.inserting && !nextEntry.reporting) {
        const { [couponId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [couponId]: nextEntry };
    });
  }, []);

  const copyPendingCoupon = useCallback(async (code: string): Promise<boolean> => copyTextToClipboard(code), [copyTextToClipboard]);

  const buildPendingCouponPayload = useCallback((coupon: CouponEntry): PendingCoupon | null => {
    const promo = coupon.promocode?.trim() ?? '';
    if (!promo) return null;
    const domain = activeHost || deriveHostnameFromUrl(activeTab?.url);
    if (!domain) return null;
    const now = new Date();
    return {
      couponId: coupon.couponId,
      promocode: promo,
      source: coupon.source ?? '',
      domain,
      country: couponsPopupCountry,
      savedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + PENDING_COUPON_TTL_MS).toISOString()
    };
  }, [activeHost, activeTab?.url, couponsPopupCountry]);

  const handleApplyCoupon = useCallback(async (coupon: CouponEntry) => {
    const pending = buildPendingCouponPayload(coupon);
    const couponId = coupon.couponId;
    updateCouponActionState(couponId, { applying: true });
    try {
      const trackingUrl = coupon.trackingUrl?.trim();
      if (!trackingUrl) {
        showGlobalToast(t('coupons.popup.apply.trackingMissing'));
        return;
      }
      newTabAction(trackingUrl);
      closeCouponsPopup();
      if (pending) {
        const copied = await copyPendingCoupon(pending.promocode);
        void updateSavingsSettings({ pendingCoupon: pending });
        showGlobalToast(copied ? t('coupons.popup.apply.copied') : t('coupons.popup.apply.copyFailed'));
      } else {
        showGlobalToast(t('coupons.popup.apply.opened'));
      }
    } catch (err) {
      console.error('[merezhyvo] apply coupon failed', err);
      showGlobalToast(t('coupons.popup.apply.fail'));
    } finally {
      updateCouponActionState(couponId, { applying: false });
    }
  }, [buildPendingCouponPayload, copyPendingCoupon, newTabAction, showGlobalToast, t, updateCouponActionState, updateSavingsSettings]);

  const handleInsertCoupon = useCallback(async (coupon: CouponEntry) => {
    const couponId = coupon.couponId;
    if (!pendingCouponState?.promocode) return;
    const view = webviewRef.current;
    if (!view) return;
    updateCouponActionState(couponId, { inserting: true });
    try {
      const result = await tryInsertCouponCode(view, pendingCouponState.promocode, false, false);
      if (result.inserted) {
        showGlobalToast(t('coupons.popup.insert.success'));
      } else {
        const copied = await copyPendingCoupon(pendingCouponState.promocode);
        showGlobalToast(copied ? t('coupons.popup.insert.failure') : t('coupons.popup.apply.copyFailed'));
      }
    } catch (err) {
      console.error('[merezhyvo] insert coupon failed', err);
      const copied = await copyPendingCoupon(pendingCouponState.promocode);
      showGlobalToast(copied ? t('coupons.popup.insert.failure') : t('coupons.popup.apply.copyFailed'));
    } finally {
      updateCouponActionState(couponId, { inserting: false });
    }
  }, [copyPendingCoupon, pendingCouponState, showGlobalToast, t, updateCouponActionState, webviewRef]);

  const filterCouponGroup = useCallback((group: CouponGroup, couponId: string): CouponGroup => ({
    ...group,
    coupons: group.coupons.filter((entry) => entry.couponId !== couponId)
  }), []);

  const removeCouponFromResponse = useCallback((data: CouponsForPageResponse, couponId: string): CouponsForPageResponse => ({
    ...data,
    local: {
      fresh: filterCouponGroup(data.local.fresh, couponId),
      older: filterCouponGroup(data.local.older, couponId)
    },
    worldwide: {
      fresh: filterCouponGroup(data.worldwide.fresh, couponId),
      older: filterCouponGroup(data.worldwide.older, couponId)
    }
  }), [filterCouponGroup]);

  const getReportErrorMessageKey = useCallback((statusCode?: number): string => {
    if (statusCode === 401) return 'coupons.popup.report.error.unauthorized';
    if (statusCode === 429) return 'coupons.popup.report.error.tooManyRequests';
    if (statusCode && statusCode >= 500 && statusCode < 600) return 'coupons.popup.report.error.server';
    if (typeof statusCode === 'number') return 'coupons.popup.report.fail';
    return 'coupons.popup.report.error.network';
  }, []);

  const handleReportInvalidCoupon = useCallback(async (coupon: CouponEntry) => {
    if (!coupon.canReportInvalid || !coupon.reportToken) return;
    const couponId = coupon.couponId;
    updateCouponActionState(couponId, { reporting: true });
    try {
      const result = await reportInvalidCoupon(coupon.reportToken);
      if (result.status === 'ok') {
        setCouponsPopupState((prev) => {
          if (prev.status !== 'results' || !prev.data) return prev;
          return { ...prev, data: removeCouponFromResponse(prev.data, couponId) };
        });
        showGlobalToast(t('coupons.popup.report.success'));
      } else {
        const key = getReportErrorMessageKey(result.statusCode);
        showGlobalToast(t(key));
      }
    } catch (err) {
      console.error('[merezhyvo] report coupon failed', err);
      showGlobalToast(t('coupons.popup.report.fail'));
    } finally {
      updateCouponActionState(couponId, { reporting: false });
    }
  }, [getReportErrorMessageKey, removeCouponFromResponse, showGlobalToast, t, updateCouponActionState]);

  const attemptAutoInsertPendingCoupon = useCallback(async (tabId: string) => {
    const coupon = pendingCouponState;
    if (!coupon || !coupon.promocode) return;
    if (activeIdRef.current !== tabId) return;
    const entry = tabViewsRef.current.get(tabId);
    const view = entry?.view;
    if (!view) return;
    let url = '';
    try {
      const maybe = typeof view.getURL === 'function' ? view.getURL() : '';
      url = typeof maybe === 'string' ? maybe : '';
    } catch {
      url = '';
    }
    if (!url || url.startsWith('mzr://')) return;
    const host = normalizeHost(url);
    if (!isHostMatchingDomain(host, coupon.domain)) return;
    const key = `${coupon.couponId}::${host}::${url}`;
    if (autoInsertKeyRef.current === key) return;
    const result = await tryInsertCouponCode(view, coupon.promocode, true, true);
    if (result.inserted) {
      autoInsertKeyRef.current = key;
      showGlobalToast(t('coupons.popup.insert.success'));
    }
  }, [activeIdRef, autoInsertKeyRef, pendingCouponState, showGlobalToast, tabViewsRef, t]);

  useEffect(() => {
    const coupon = pendingCouponState;
    if (!coupon || !coupon.promocode) return;
    const tabId = activeIdRef.current;
    if (!tabId) return;
    const timer = window.setTimeout(() => {
      void attemptAutoInsertPendingCoupon(tabId);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activeTab?.url, attemptAutoInsertPendingCoupon, pendingCouponState]);
  useEffect(() => {
    if (!couponsPopupVisible) return;
    const hostname = deriveHostnameFromUrl(activeTab?.url);
    if (!hostname) {
      setCouponsPopupState({ status: 'idle' });
      return;
    }
    const cached = getCachedCouponsForPage(couponsPopupCountry, hostname);
    if (cached) {
      setCouponsPopupState({ status: 'results', data: cached.data });
      return;
    }
    const nextRetry = savingsSettings.syncRetryByCountry[couponsPopupCountry];
    if (nextRetry && Date.parse(nextRetry) > Date.now()) {
      setCouponsPopupState({ status: 'syncing', syncingUntil: nextRetry });
      return;
    }
    setCouponsPopupState({ status: 'idle' });
  }, [
    activeTab?.url,
    couponsPopupCountry,
    couponsPopupVisible,
    savingsSettings.syncRetryByCountry
  ]);

  const closeCouponsPopup = useCallback(() => {
    setCouponsPopupVisible(false);
    setCouponsPopupState({ status: 'idle' });
  }, []);

  const handleCouponsPositionChange = useCallback(
    (pos: { x: number; y: number }) => {
      void updateSavingsSettings({ floatingButtonPos: pos });
    },
    [updateSavingsSettings]
  );

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
        const savingsFromState = state.savings ?? DEFAULT_SAVINGS_SETTINGS;
        if (!cancelled) {
          setSavingsSettings(savingsFromState);
        }
        try {
          const savingsDirect = await ipc.settings.savings.get();
          if (!cancelled && savingsDirect) {
            setSavingsSettings(savingsDirect);
          }
        } catch {
          // ignore fallback to state
        } finally {
          if (!cancelled) {
            setSavingsLoaded(true);
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
          setSavingsSettings(DEFAULT_SAVINGS_SETTINGS);
          setSavingsLoaded(true);
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
    setSavingsSettings
  ]);

  useEffect(() => {
    if (!savingsLoaded || detectedCountryFetchRef.current) return;
    let cancelled = false;
    const loadDetectedCountry = async () => {
      let cachedCountry: string | null = null;
      try {
        const state = await ipc.settings.loadState();
        cachedCountry = normalizeCountryCode(state?.network?.detectedCountry);
        if (!cancelled && cachedCountry) {
          setDetectedCountry(cachedCountry);
        }
      } catch {
        // ignore cache read failures
      }
      try {
        const response = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to fetch country');
        const payload = (await response.json().catch(() => ({}))) as { country_code?: unknown; ip?: unknown };
        const code = normalizeCountryCode(payload.country_code);
        const ip = typeof payload.ip === 'string' ? payload.ip : null;
        if (!cancelled) {
          setDetectedCountry(code ?? cachedCountry ?? 'US');
        }
        if (code && ip) {
          void ipc.settings.network.updateDetected({
            detectedIp: ip,
            detectedCountry: code,
            detectedAt: new Date().toISOString()
          });
        }
      } catch {
        if (!cancelled && !cachedCountry) {
          setDetectedCountry('US');
        }
      }
    };
    const triggerFetch = () => {
      if (detectedCountryFetchRef.current) return;
      detectedCountryFetchRef.current = true;
      void loadDetectedCountry();
    };
    if (torKeepEnabled && !torEnabled) {
      if (detectedCountryTimerRef.current === null) {
        detectedCountryTimerRef.current = window.setTimeout(() => {
          detectedCountryTimerRef.current = null;
          triggerFetch();
        }, 5000);
      }
    } else {
      if (detectedCountryTimerRef.current !== null) {
        window.clearTimeout(detectedCountryTimerRef.current);
        detectedCountryTimerRef.current = null;
      }
      triggerFetch();
    }
    return () => {
      cancelled = true;
      if (detectedCountryTimerRef.current !== null) {
        window.clearTimeout(detectedCountryTimerRef.current);
        detectedCountryTimerRef.current = null;
      }
    };
  }, [savingsLoaded, torKeepEnabled, torEnabled]);

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
    webviewFocusedRef
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
      setInputValue(cleanUrl);
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
    void attemptAutoInsertPendingCoupon(tabId);
  }, [activeIdRef, attemptAutoInsertPendingCoupon, ensureSelectionCssInjected, tabViewsRef]);
  
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
      mountInBackgroundHost,
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
    setInputValue(certCandidate.url);
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
      setTorDisableBusy(true);
      const wiped = await wipeTorSession();
      if (!wiped) {
        pendingTorCloseAllRef.current = false;
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
    }
  }, [finalizeTorCloseAll, torDisableBusy, torEnabled]);

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
    oskPressGuardRef
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
    event.target.select();
  }, []);

  const handleInputBlur = useCallback((_: ReactFocusEvent<HTMLInputElement>) => {
    isEditingRef.current = false;
    setIsEditing(false);
    if (activeInputRef.current === 'url') activeInputRef.current = null;
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
  const isNetworkInfoService = serviceUrl.startsWith('mzr://network-info') || serviceUrl.startsWith('mzr://tor-info');
  const showServiceOverlay =
    mainViewMode === 'browser' &&
    (isBookmarksService || isHistoryService || isPasswordsService || isLicensesService || isSecurityExceptionsService || isSiteDataService || isPrivacyInfoService || isNetworkInfoService);
  let serviceContent = null;
  if (showServiceOverlay) {
    if (isBookmarksService) {
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
    requestAnimationFrame(() => {
      try { inputRef.current?.focus?.(); } catch {}
    });
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
            host={deriveHostnameFromUrl(activeTab?.url) || null}
            pageOrigin={deriveOriginFromUrl(activeTab?.url) || null}
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
            activeHost={activeHost}
            onApplyCoupon={handleApplyCoupon}
            onInsertCoupon={handleInsertCoupon}
            onReportInvalid={handleReportInvalidCoupon}
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
