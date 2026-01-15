import React, { useState } from 'react';
import type { Mode, CouponEntry, CouponsForPageResponse, PendingCoupon } from '../../types/models';
import { useI18n } from '../../i18n/I18nProvider';
import CountrySelect from './CountrySelect';

export type CouponsPopupStatus = 'idle' | 'loading' | 'syncing' | 'error' | 'results';

type CouponsPopupProps = {
  mode: Mode;
  visible: boolean;
  host: string | null;
  country: string;
  status: CouponsPopupStatus;
  data?: CouponsForPageResponse;
  errorMessage?: string;
  syncingUntil: string | null;
  onCountryChange: (value: string | null) => void;
  onFindCoupons: () => void;
  onClose: () => void;
  pendingCoupon: PendingCoupon | null;
  couponActionState: Record<string, { applying?: boolean; inserting?: boolean; reporting?: boolean }>;
  activeHost: string;
  onApplyCoupon: (coupon: CouponEntry) => void;
  onInsertCoupon: (coupon: CouponEntry) => void;
  onReportInvalid: (coupon: CouponEntry) => void;
  pageOrigin: string | null;
  onOpenCouponsInfo: () => void;
};

const formatHost = (host?: string | null): string => (host ? host : 'this site');

const formatSyncCountdown = (timestamp: string | null): string | null => {
  if (!timestamp) return null;
  const remaining = Date.parse(timestamp) - Date.now();
  if (remaining <= 0) return null;
  const minutes = Math.max(1, Math.ceil(remaining / 60000));
  return `${minutes}`;
};

const Spinner = () => (
  <svg width={48} height={48} viewBox="0 0 48 48" role="presentation" aria-hidden="true">
    <circle
      cx="24"
      cy="24"
      r="18"
      stroke="rgba(0,0,0,0.1)"
      strokeWidth="4"
      fill="none"
    />
    <path
      d="M24 6a18 18 0 0 1 0 36"
      stroke="var(--mzr-accent)"
      strokeWidth="4"
      strokeLinecap="round"
      fill="none"
    >
      <animateTransform
        attributeName="transform"
        attributeType="XML"
        type="rotate"
        from="0 24 24"
        to="360 24 24"
        dur="1s"
        repeatCount="indefinite"
      />
    </path>
  </svg>
);

const isHostMatchingDomain = (host: string, domain: string): boolean => {
  if (!host || !domain) return false;
  const normalizedHost = host.toLowerCase();
  const normalizedDomain = domain.toLowerCase();
  if (normalizedHost === normalizedDomain) return true;
  if (normalizedHost.endsWith(`.${normalizedDomain}`)) return true;
  if (normalizedDomain.endsWith(`.${normalizedHost}`)) return true;
  return false;
};

const CouponsPopup: React.FC<CouponsPopupProps> = ({
  mode,
  visible,
  host,
  pageOrigin,
  country,
  status,
  data,
  errorMessage,
  syncingUntil,
  onCountryChange,
  onFindCoupons,
  onClose,
  pendingCoupon,
  couponActionState,
  activeHost,
  onApplyCoupon,
  onInsertCoupon,
  onReportInvalid,
  onOpenCouponsInfo
}) => {
  const { t } = useI18n();
  const [olderExpanded, setOlderExpanded] = useState<boolean>(false);

  const localFreshCoupons = data?.local.fresh.coupons ?? [];
  const worldwideFreshCoupons = data?.worldwide.fresh.coupons ?? [];
  const localOlderCoupons = data?.local.older.coupons ?? [];
  const worldwideOlderCoupons = data?.worldwide.older.coupons ?? [];
  const combinedRecentCoupons = [...localFreshCoupons, ...worldwideFreshCoupons];
  const combinedOlderCoupons = [...localOlderCoupons, ...worldwideOlderCoupons];
  const hasFreshCoupons = combinedRecentCoupons.length > 0;
  const hasOlderCoupons = combinedOlderCoupons.length > 0;
  const hasAnyCoupons = hasFreshCoupons || hasOlderCoupons;
  const lookbackDaysValue =
    data?.local.fresh.lookbackDays ??
    data?.worldwide.fresh.lookbackDays ??
    data?.local.older.lookbackDays ??
    data?.worldwide.older.lookbackDays ??
    0;

  if (!visible) return null;

  const showSyncCountdown = formatSyncCountdown(syncingUntil);
  const readyToRetry = showSyncCountdown === null;

  const popupBackdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.4)',
    zIndex: 6000
  };

  const popupCardStyle: React.CSSProperties = {
    position: 'relative',
    maxHeight: '90vh',
    background: 'var(--mzr-surface)',
    borderRadius: 20,
    padding: 24,
    boxShadow: '0 16px 64px rgba(0,0,0,0.35)'
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  };

  const couponCardStyle: React.CSSProperties = {
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.08)',
    padding: '12px 16px',
    marginBottom: mode === 'mobile' ? 40 : 20,
    background: 'var(--mzr-surface-weak)'
  };

  const renderCouponCard = (coupon: CouponEntry, index: number): React.ReactNode => {
    const actionState = couponActionState[coupon.couponId] ?? {};
    let matchesPending = false;
    if (pendingCoupon && pendingCoupon.promocode && pendingCoupon.couponId === coupon.couponId) {
      const safeHost: string = activeHost ?? '';
      const safeDomain: string = pendingCoupon.domain ?? '';
      matchesPending = isHostMatchingDomain(safeHost, safeDomain);
    }
    const showInsertButton = matchesPending;
    const showMarkInvalid = Boolean(coupon.canReportInvalid && coupon.reportToken);
    const primaryDisabled = showInsertButton ? Boolean(actionState.inserting) : Boolean(actionState.applying);
    const primaryLabel = showInsertButton
      ? (actionState.inserting ? t('coupons.popup.button.inserting') : t('coupons.popup.button.insertCode'))
      : (actionState.applying ? t('coupons.popup.button.applying') : t('coupons.popup.button.apply'));
    const handlePrimaryAction = () => {
      if (showInsertButton) {
        onInsertCoupon(coupon);
        return;
      }
      onApplyCoupon(coupon);
    };
    const key = coupon.couponId ?? coupon.promocode ?? `coupon-${index}`;
    return (
      <div key={key} style={couponCardStyle}>
        <div style={{ fontWeight: 600, marginBottom: mode === 'mobile' ? 20 : 10, fontSize: mode === 'mobile' ? 42 : 20 }}>
          {coupon.userValue ?? coupon.name ?? coupon.promocode ?? t('coupons.popup.results.noCoupons')}
        </div>
        {coupon.promocode && (
          <div
            style={{
              fontSize: mode === 'mobile' ? 42 : 20,
              color: 'var(--mzr-text-muted)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: mode === 'mobile' ? 20 : 10
            }}>
            {coupon.promocode}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={primaryDisabled}
            style={{
              flex: 1,
              minWidth: 140,
              padding: '10px 14px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--mzr-accent)',
              color: '#fff',
              fontWeight: 600,
              fontSize: mode === 'mobile' ? 38 : 16,
              cursor: primaryDisabled ? 'not-allowed' : 'pointer',
              opacity: primaryDisabled ? 0.7 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            {primaryLabel}
          </button>
          {showMarkInvalid && (
            <button
              type="button"
              onClick={() => onReportInvalid(coupon)}
              disabled={Boolean(actionState.reporting)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid var(--mzr-border)',
                background: 'transparent',
                color: 'var(--mzr-text-primary)',
                fontWeight: 600,
                fontSize: mode === 'mobile' ? 38 : 16,
                cursor: actionState.reporting ? 'not-allowed' : 'pointer',
                opacity: actionState.reporting ? 0.7 : 1
              }}
            >
              {actionState.reporting ? t('coupons.popup.button.reporting') : t('coupons.popup.button.markInvalid')}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderCouponList = (coupons: CouponEntry[]): React.ReactNode => {
    if (!coupons || coupons.length === 0) {
      return (
        <p style={{ margin: 0, textAlign: 'center' }}>{t('coupons.popup.results.noCoupons')}</p>
      );
    }
    return coupons.map((coupon, index) => renderCouponCard(coupon, index));
  };

  const cardStyle = { ...popupCardStyle, width: mode === 'mobile' ? '90%' : 'min(620px, 90vw)' };
  const couponIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 198"
    preserveAspectRatio="xMidYMid meet"
    style={{
      width: mode === 'mobile' ? 120 : 65,
      height: mode === 'mobile' ? 110 : 60,
      display: 'block',
      shapeRendering: 'geometricPrecision',
      textRendering: 'geometricPrecision',
    }}
    fillRule="evenodd"
    clipRule="evenodd"
    aria-hidden="true"
    focusable="false"
  >
    <path
      opacity={0.992}
      fill="#235cdc"
      d="M255.5 33.5v29a19.555 19.555 0 0 0-4 3.5c-26.96 2.441-38.126 16.941-33.5 43.5 6.553 14.044 17.72 21.21 33.5 21.5a19.552 19.552 0 0 0 4 3.5v29c-5.15 15.316-15.484 25.483-31 30.5-45.665.5-91.332.667-137 .5.166-10.672 0-21.339-.5-32-.108-4.943-2.608-7.276-7.5-7-4.892-.276-7.392 2.057-7.5 7a512.462 512.462 0 0 0-.5 32c-13.67.167-27.337 0-41-.5-15.516-5.017-25.85-15.184-31-30.5v-29a19.564 19.564 0 0 0 4-3.5c26.96-2.441 38.126-16.941 33.5-43.5C30.447 73.456 19.28 66.29 3.5 66a19.567 19.567 0 0 0-4-3.5v-29C4.65 18.184 14.984 8.017 30.5 3c13.663-.5 27.33-.667 41-.5a512.47 512.47 0 0 0 .5 32c.108 4.943 2.608 7.276 7.5 7 4.892.276 7.392-2.057 7.5-7 .5-10.662.666-21.328.5-32 45.668-.167 91.335 0 137 .5 15.516 5.017 25.85 15.184 31 30.5zm-180 26a32.437 32.437 0 0 1 8 .5c1.167.5 2 1.333 2.5 2.5 2.12 8.395 1.954 16.728-.5 25-3.049 1.966-6.382 2.466-10 1.5-1.167-.5-2-1.333-2.5-2.5a57.84 57.84 0 0 1-1-20c.139-2.945 1.306-5.279 3.5-7zm56 8c10.676-.981 13.676 3.352 9 13-9.618 3.212-13.452-.121-11.5-10 .698-1.19 1.531-2.19 2.5-3zm48 0c9.165-1.67 12.665 1.998 10.5 11L131.5 137c-9.167 2.167-12.667-1.333-10.5-10.5a4870.281 4870.281 0 0 0 58.5-59zm-104 40a32.462 32.462 0 0 1 8 .5c1.167.5 2 1.333 2.5 2.5 2.12 8.395 1.954 16.728-.5 25-3.049 1.966-6.382 2.466-10 1.5-1.167-.5-2-1.333-2.5-2.5a57.84 57.84 0 0 1-1-20c.139-2.945 1.306-5.279 3.5-7zm96 16c10.676-.981 13.676 3.352 9 13-9.618 3.212-13.452-.121-11.5-10 .698-1.191 1.531-2.191 2.5-3z"
    />
  </svg>
);

  return (
    <div style={popupBackdropStyle} aria-live="polite">
      <div style={cardStyle}>
        <div style={{ ...sectionHeaderStyle, marginBottom: 16 }}>
          <div style={{display: 'flex', gap: mode === 'mobile' ? 20 : 10}}>
            <div>
              {couponIcon}
            </div>
          <div>
              <div style={{ fontSize: mode === 'mobile' ? 44 : 25, fontWeight: 700 }}>{t('coupons.popup.title', { host: '' })}</div>
              <div style={{ marginTop: mode === 'mobile' ? 15 : 5, fontSize: mode === 'mobile' ? 38 : 24, color: 'var(--mzr-text-muted)' }}>
                {formatHost(pageOrigin || host)}
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label={t('coupons.popup.close')}
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: mode === 'mobile' ? 44 : 25,
              cursor: 'pointer',
              color: 'var(--mzr-text-muted)'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: mode === 'mobile' ? 40 : 25 }}>
          <label style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 4 }}>
            <span style={{ fontSize: mode === 'mobile' ? 32 : 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mzr-text-muted)' }}>
              {t('settings.savings.country.label')}
            </span>
            <CountrySelect
              value={country}
              onChange={onCountryChange}
              chevronSize={mode === 'mobile' ? 36 : 14}
              selectStyle={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--mzr-border)',
                background: 'var(--mzr-surface)',
                color: 'var(--mzr-text-primary)',
                fontSize: mode === 'mobile' ? 36 : 16,
                outline: 'none',
                width: '100%'
              }}
            />
          </label>
        </div>

        <div style={{ marginBottom: 16, fontSize: mode === 'mobile' ? 38 : 16 }}>
          {status === 'idle' && (
            <>
              {/* <p>{t('coupons.popup.idle')}</p> */}
              <button
                type="button"
                onClick={onFindCoupons}
                style={{
                  marginTop: 12,
                  width: '100%',
                  padding: '12px',
                  borderRadius: 10,
                  border: 'none',
                  fontWeight: 600,
                  fontSize: mode === 'mobile' ? 38 : 16,
                  color: '#fff',
                  background: 'var(--mzr-accent)',
                  cursor: 'pointer'
                }}
              >
                {t('coupons.popup.find')}
              </button>
            </>
          )}
          {status === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <Spinner />
              <p>{t('coupons.popup.loading')}</p>
            </div>
          )}
          {status === 'syncing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p>{t('coupons.popup.syncing', { country })}</p>
              <p style={{ fontSize: mode === 'mobile' ? 32 : 12, color: 'var(--mzr-text-muted)' }}>
                {showSyncCountdown
                  ? t('coupons.popup.syncingCountdown', { minutes: showSyncCountdown })
                  : t('coupons.popup.syncingCountdown', { minutes: '??' })}
              </p>
              <button
                type="button"
                disabled
                style={{
                  marginTop: 6,
                  width: '100%',
                  padding: '10px',
                  borderRadius: 10,
                  border: 'none',
                  fontWeight: 600,
                  background: 'var(--mzr-border)',
                  color: 'var(--mzr-text-muted)',
                  cursor: 'not-allowed'
                }}
              >
                {t('coupons.popup.find')}
              </button>
              <button
                type="button"
                onClick={onFindCoupons}
                disabled={!readyToRetry}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 10,
                  border: '1px solid var(--mzr-border)',
                  background: 'var(--mzr-surface)',
                  color: readyToRetry ? 'var(--mzr-text-primary)' : 'var(--mzr-text-muted)',
                  fontWeight: 600,
                  cursor: readyToRetry ? 'pointer' : 'not-allowed'
                }}
              >
                {t('coupons.popup.tryAgain')}
              </button>
            </div>
          )}
          {status === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p>{t('coupons.popup.error')}</p>
              <p style={{ color: 'var(--mzr-text-muted)', fontSize: mode === 'mobile' ? 34 : 12 }}>{errorMessage}</p>
              <button
                type="button"
                onClick={onFindCoupons}
                style={{
                  marginTop: 6,
                  width: '100%',
                  padding: '10px',
                  borderRadius: 10,
                  border: 'none',
                  fontWeight: 600,
                  color: '#fff',
                  background: 'var(--mzr-accent)',
                  cursor: 'pointer'
                }}
              >
                {t('coupons.popup.retry')}
              </button>
            </div>
          )}
          {status === 'results' && data && (
            <div className="service-scroll"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: mode === 'mobile' ? 25 : 12,
                maxHeight: '60vh',
                overflowY: 'auto',
                paddingRight: mode === 'mobile' ? 20 : 10
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: mode === 'mobile' ? 38 : 16, fontWeight: 600, marginBottom: mode === 'mobile' ? 40 : 20 }}>
                  {t('coupons.popup.results.recentTitle', { lookbackDays: lookbackDaysValue })}
                </div>
                {renderCouponList(combinedRecentCoupons)}
              </div>
              <div style={{ marginBottom: 16, borderTop: '1px solid var(--mzr-border)', paddingTop: 12 }}>
                <div style={{ ...sectionHeaderStyle, marginBottom: mode === 'mobile' ? 40 : 20 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t('coupons.popup.results.older')}</div>
                    {/* <div style={{ fontSize: mode === 'mobile' ? 32 : 12, color: 'var(--mzr-text-muted)' }}>
                      {t('coupons.popup.results.olderChance')}
                    </div> */}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOlderExpanded((value) => !value)}
                    aria-label={olderExpanded
                      ? t('coupons.popup.olderToggle.hide')
                      : t('coupons.popup.olderToggle.show')}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--mzr-accent)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        transition: 'transform 0.2s',
                        transform: olderExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        fontSize: mode === 'mobile' ? 60 : 30
                      }}
                    >
                      ⌄
                    </span>
                  </button>
                </div>
                {(olderExpanded || (!hasFreshCoupons && status === 'results')) && renderCouponList(combinedOlderCoupons)}
              </div>
              {!hasAnyCoupons && (
                <button
                  type="button"
                  onClick={onFindCoupons}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    border: 'none',
                    fontWeight: 600,
                    color: '#fff',
                    background: 'var(--mzr-accent)',
                    cursor: 'pointer'
                  }}
                >
                  {t('coupons.popup.find')}
                </button>
              )}
            </div>
          )}
          <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--mzr-border)',
            textAlign: 'center'
          }}
        >
          <button
            type="button"
            onClick={onOpenCouponsInfo}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              color: 'var(--mzr-accent)',
              fontWeight: 600,
              fontSize: mode === 'mobile' ? 32 : 14,
              cursor: 'pointer'
            }}
          >
            {t('coupons.popup.howItWorks')}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default CouponsPopup;
