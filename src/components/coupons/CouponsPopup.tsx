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

  const cardStyle = { ...popupCardStyle, width: mode === 'mobile' ? '90%' : 'min(620px, 90vw)' };
  const couponIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 198"
    preserveAspectRatio="xMidYMid meet"
    style={{
      width: mode === 'mobile' ? 90 : 65,
      height: mode === 'mobile' ? 90 : 60,
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
                {formatHost(host)}
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
                fontSize: 16,
                outline: 'none'
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
