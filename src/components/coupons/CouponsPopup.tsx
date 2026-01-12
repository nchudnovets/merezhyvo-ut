import React, { useMemo, useState } from 'react';
import type { Mode, CouponEntry, CouponsForPageResponse } from '../../types/models';
import { getCountryOptions } from '../../utils/countries';
import { useI18n } from '../../i18n/I18nProvider';

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
  onCountryChange: (value: string) => void;
  onFindCoupons: () => void;
  onClose: () => void;
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
  overflowY: 'auto',
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
  marginBottom: 12,
  background: 'rgba(255,255,255,0.6)'
};

const CouponsPopup: React.FC<CouponsPopupProps> = ({
  mode,
  visible,
  host,
  country,
  status,
  data,
  errorMessage,
  syncingUntil,
  onCountryChange,
  onFindCoupons,
  onClose
}) => {
  const { t, language } = useI18n();
  const [olderExpanded, setOlderExpanded] = useState<boolean>(false);
  const countryOptions = useMemo(() => getCountryOptions(language), [language]);

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

  const renderCouponList = (coupons: CouponEntry[]): React.ReactNode => {
    if (!coupons || coupons.length === 0) {
      return (
        <p style={{ margin: 0 }}>{t('coupons.popup.results.noCoupons')}</p>
      );
    }
    return coupons.map((coupon) => (
      <div key={coupon.couponId ?? coupon.promocode ?? Math.random()} style={couponCardStyle}>
        <div>{coupon.userValue ?? coupon.promocode ?? t('coupons.popup.results.noCoupons')}</div>
        <button
          type="button"
          disabled
          style={{
            marginTop: 8,
            width: '100%',
            padding: '8px 12px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--mzr-border)',
            color: 'var(--mzr-text-primary)',
            fontWeight: 600,
            cursor: 'not-allowed'
          }}
        >
          {t('coupons.popup.open')}
        </button>
      </div>
    ));
  };

  const cardStyle = { ...popupCardStyle, width: mode === 'mobile' ? 'min(360px, 90vw)' : 'min(420px, 90vw)' };

  return (
    <div style={popupBackdropStyle} aria-live="polite">
      <div style={cardStyle}>
        <div style={{ ...sectionHeaderStyle, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{t('coupons.popup.title', { host: formatHost(host) })}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--mzr-text-muted)' }}>
              {t('coupons.popup.country.helper')}
            </div>
          </div>
          <button
            type="button"
            aria-label={t('coupons.popup.close')}
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 18,
              cursor: 'pointer',
              color: 'var(--mzr-text-muted)'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 4 }}>
            <span style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mzr-text-muted)' }}>
              {t('settings.savings.country.label')}
            </span>
            <select
              value={country}
              onChange={(event) => onCountryChange(event.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--mzr-border)',
                background: 'var(--mzr-surface)',
                color: 'var(--mzr-text-primary)',
                fontSize: 16
              }}
            >
              {countryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          {status === 'idle' && (
            <>
              <p>{t('coupons.popup.idle')}</p>
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
              <p style={{ fontSize: 12, color: 'var(--mzr-text-muted)' }}>
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
              <p style={{ color: 'var(--mzr-text-muted)', fontSize: 12 }}>{errorMessage}</p>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  {t('coupons.popup.results.recentTitle', { lookbackDays: lookbackDaysValue })}
                </div>
                {renderCouponList(combinedRecentCoupons)}
              </div>
              <div style={{ marginBottom: 16, borderTop: '1px solid var(--mzr-border)', paddingTop: 12 }}>
                <div style={{ ...sectionHeaderStyle, marginBottom: 1 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t('coupons.popup.results.older')}</div>
                    <div style={{ fontSize: 12, color: 'var(--mzr-text-muted)' }}>
                      {t('coupons.popup.results.olderChance')}
                    </div>
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
                      transform: olderExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
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
        </div>
      </div>
    </div>
  );
};

export default CouponsPopup;
