import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WebviewTag } from 'electron';
import type {
  CouponEntry,
  CouponGroup,
  CouponsForPageResponse,
  PendingCoupon,
  SavingsFloatingButtonPosState,
  SavingsSettings,
  Tab
} from '../types/models';
import type { TabViewEntry } from '../types/tabView';
import type { CouponsPopupStatus } from '../components/coupons/CouponsPopup';
import { fetchCouponsForPage, fetchMerchantsCatalog, reportInvalidCoupon } from '../services/coupons/api';
import { getCachedCouponsForPage, setCachedCouponsForPage } from '../services/coupons/cache';
import { ipc } from '../services/ipc/ipc';
import { normalizeHost } from '../utils/security';
import {
  DEFAULT_SAVINGS_CATALOG,
  DEFAULT_SAVINGS_SETTINGS,
  getEffectiveCountry,
  getPopupCountry,
  mergeSavingsSettings,
  normalizeCountryCode
} from '../utils/savings';

type CouponsPopupDataState = {
  status: CouponsPopupStatus;
  data?: CouponsForPageResponse;
  errorMessage?: string;
  syncingUntil?: string | null;
};

type CouponActionState = Record<
  string,
  { applying?: boolean; inserting?: boolean; reporting?: boolean }
>;

const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
const PENDING_COUPON_TTL_MS = 2 * 60 * 60 * 1000;

const COUPON_FIELD_KEYWORDS = [
  'coupon', 'coupons', 'promo', 'promocode', 'promo code', 'discount', 'voucher', 'code', 'gift', 'deal'
];
const CART_PAGE_KEYWORDS = ['cart', 'checkout', 'basket', 'order', 'payment', 'bag'];

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

const normalizeMatchValue = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('www.') ? normalized.slice(4) : normalized;
};

const isHostMatchingDomain = (host: string | null | undefined, domain: string): boolean => {
  if (!host || !domain) return false;
  const normalizedHost = normalizeMatchValue(host);
  const normalizedDomain = normalizeMatchValue(domain);
  if (normalizedHost === normalizedDomain) return true;
  if (normalizedHost.endsWith(`.${normalizedDomain}`)) return true;
  if (normalizedDomain.endsWith(`.${normalizedHost}`)) return true;
  return false;
};

const buildInsertCouponScript = (
  code: string,
  requireCheckoutKeywords: boolean,
  requireCouponKeywords: boolean
): string => {
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

type UseCouponsArgs = {
  activeTab: Tab | null;
  activeUrl: string;
  activeHost: string | null;
  activeIdRef: React.MutableRefObject<string | null>;
  tabViewsRef: React.MutableRefObject<Map<string, TabViewEntry>>;
  webviewRef: React.MutableRefObject<WebviewTag | null>;
  appVersion: string;
  torEnabled: boolean;
  torKeepEnabled: boolean;
  showGlobalToast: (message: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  newTabAction: (url: string) => void;
  copyTextToClipboard: (text: string) => Promise<boolean>;
};

type UseCouponsResult = {
  couponsPopupVisible: boolean;
  couponsPopupCountry: string;
  couponsPopupState: CouponsPopupDataState;
  couponActionState: CouponActionState;
  pendingCouponState: PendingCoupon | null;
  savingsSettings: SavingsSettings;
  savingsLoaded: boolean;
  detectedCountry: string;
  couponsButtonVisible: boolean;
  effectiveSavingsCountry: string;
  popupHost: string | null;
  popupOrigin: string | null;
  isCouponsInfoService: boolean;
  applySavingsSettings: (next: SavingsSettings | null | undefined) => void;
  markSavingsLoaded: (value?: boolean) => void;
  handleSavingsEnabledChange: (value: boolean) => void;
  handleSavingsCountryChange: (value: string | null) => void;
  handleCouponsCountryChange: (value: string | null) => void;
  handleOpenCouponsPopup: () => void;
  handleFindCoupons: () => void;
  closeCouponsPopup: () => void;
  handleApplyCoupon: (coupon: CouponEntry) => void;
  handleInsertCoupon: (coupon: CouponEntry) => void;
  handleReportInvalidCoupon: (coupon: CouponEntry) => void;
  handleCouponsPositionChange: (pos: SavingsFloatingButtonPosState) => void;
  performCatalogFetch: (country: string, etag: string | null) => void;
  handleCouponsDomReady: (tabId: string) => void;
};

export const useCoupons = ({
  activeTab,
  activeUrl,
  activeHost,
  activeIdRef,
  tabViewsRef,
  webviewRef,
  appVersion,
  torEnabled,
  torKeepEnabled,
  showGlobalToast,
  t,
  newTabAction,
  copyTextToClipboard
}: UseCouponsArgs): UseCouponsResult => {
  const [couponsPopupVisible, setCouponsPopupVisible] = useState<boolean>(false);
  const [couponsPopupCountry, setCouponsPopupCountry] = useState<string>('US');
  const [couponsPopupState, setCouponsPopupState] = useState<CouponsPopupDataState>({ status: 'idle' });
  const [couponActionState, setCouponActionState] = useState<CouponActionState>({});
  const [savingsSettings, setSavingsSettings] = useState<SavingsSettings>(DEFAULT_SAVINGS_SETTINGS);
  const savingsSettingsRef = useRef<SavingsSettings>(DEFAULT_SAVINGS_SETTINGS);
  const autoInsertKeyRef = useRef<string | null>(null);
  const [pendingCouponState, setPendingCouponState] = useState<PendingCoupon | null>(null);
  const [detectedCountry, setDetectedCountry] = useState<string>('US');
  const detectedCountryFetchRef = useRef<boolean>(false);
  const detectedCountryTimerRef = useRef<number | null>(null);
  const [savingsLoaded, setSavingsLoaded] = useState<boolean>(false);
  const catalogFetchInFlightRef = useRef<boolean>(false);

  const applySavingsSettings = useCallback((next: SavingsSettings | null | undefined) => {
    const payload = next ?? DEFAULT_SAVINGS_SETTINGS;
    setSavingsSettings(payload);
    savingsSettingsRef.current = payload;
  }, []);

  const markSavingsLoaded = useCallback((value = true) => {
    setSavingsLoaded(value);
  }, []);

  useEffect(() => { savingsSettingsRef.current = savingsSettings; }, [savingsSettings]);

  const effectiveSavingsCountry = useMemo(
    () => getEffectiveCountry(savingsSettings.countrySaved, savingsSettings.lastPopupCountry, detectedCountry),
    [savingsSettings.countrySaved, savingsSettings.lastPopupCountry, detectedCountry]
  );

  const couponsButtonVisible = useMemo(() => {
    if (!savingsSettings.enabled) return false;
    if (activeUrl.toLowerCase().startsWith('mzr://')) return false;
    if (!activeHost) return false;
    const catalog = savingsSettings.catalog;
    if (!catalog || catalog.merchants.length === 0) return false;
    if (catalog.country !== effectiveSavingsCountry) return false;
    return catalog.merchants.some((merchant) => {
      const domain = merchant.domain;
      if (!domain) return false;
      return isHostMatchingDomain(activeHost, domain);
    });
  }, [activeHost, activeUrl, effectiveSavingsCountry, savingsSettings.catalog, savingsSettings.enabled]);

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
      const result = await fetchMerchantsCatalog(country, etag ?? undefined, appVersion);
      const nowIso = new Date().toISOString();
      if (result.status === 'ok') {
        void updateSavingsSettings({
          catalog: {
            ...baseCatalog,
            country,
            merchants: result.merchants,
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
  }, [appVersion, updateSavingsSettings]);

  const isCouponsInfoService = activeUrl.toLowerCase().startsWith('mzr://coupons-info');

  useEffect(() => {
    if (!savingsLoaded) return;
    const catalog = savingsSettings.catalog;
    const now = Date.now();
    const nextAllowedAt = catalog.nextAllowedFetchAt ? Date.parse(catalog.nextAllowedFetchAt) : 0;
    if (Number.isFinite(nextAllowedAt) && nextAllowedAt > now) return;
    if (catalog.country && catalog.country !== effectiveSavingsCountry) {
      if (isCouponsInfoService) return;
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
    isCouponsInfoService,
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

  const handleCouponsCountryChange = useCallback((value: string | null) => {
    const normalized = normalizeCountryCode(value) ?? '';
    setCouponsPopupCountry(normalized);
    setCouponsPopupState({ status: 'idle' });
    handleSavingsCountryChange(value);
  }, [handleSavingsCountryChange]);

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
      clientVersion: appVersion
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
    appVersion,
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

  const closeCouponsPopup = useCallback(() => {
    setCouponsPopupVisible(false);
    setCouponsPopupState({ status: 'idle' });
  }, []);

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
  }, [buildPendingCouponPayload, closeCouponsPopup, copyPendingCoupon, newTabAction, showGlobalToast, t, updateCouponActionState, updateSavingsSettings]);

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
    coupons: group.coupons.filter((entry: CouponEntry) => entry.couponId !== couponId)
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
      const result = await reportInvalidCoupon(coupon.reportToken, coupon.couponId);
      if (result.status === 'ok') {
        setCouponsPopupState((prev) => {
          if (prev.status !== 'results' || !prev.data) return prev;
          return { ...prev, data: removeCouponFromResponse(prev.data, couponId) };
        });
        showGlobalToast(t('coupons.popup.report.success'));
        void handleFindCoupons();
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
  }, [getReportErrorMessageKey, handleFindCoupons, removeCouponFromResponse, showGlobalToast, t, updateCouponActionState]);

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

  const handleCouponsDomReady = useCallback((tabId: string) => {
    void attemptAutoInsertPendingCoupon(tabId);
  }, [attemptAutoInsertPendingCoupon]);

  useEffect(() => {
    const coupon = pendingCouponState;
    if (!coupon || !coupon.promocode) return;
    const tabId = activeIdRef.current;
    if (!tabId) return;
    const timer = window.setTimeout(() => {
      void attemptAutoInsertPendingCoupon(tabId);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activeTab?.url, attemptAutoInsertPendingCoupon, pendingCouponState, activeIdRef]);

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

  const handleCouponsPositionChange = useCallback(
    (pos: SavingsFloatingButtonPosState) => {
      void updateSavingsSettings({ floatingButtonPos: pos });
    },
    [updateSavingsSettings]
  );

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

  const popupHost = useMemo(() => {
    const host = deriveHostnameFromUrl(activeTab?.url);
    return host || null;
  }, [activeTab?.url]);

  const popupOrigin = useMemo(() => {
    const origin = deriveOriginFromUrl(activeTab?.url);
    return origin || null;
  }, [activeTab?.url]);

  return {
    couponsPopupVisible,
    couponsPopupCountry,
    couponsPopupState,
    couponActionState,
    pendingCouponState,
    savingsSettings,
    savingsLoaded,
    detectedCountry,
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
  };
};
