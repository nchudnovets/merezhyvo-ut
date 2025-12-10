import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { SslException } from '../../types/models';
import type { ServicePageProps } from '../services/types';
import { useI18n } from '../../i18n/I18nProvider';

const rowBorder = '1px solid rgba(148,163,184,0.28)';

const SecurityExceptionsPage: React.FC<ServicePageProps> = ({ mode }) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState<boolean>(true);
  const [exceptions, setExceptions] = useState<Record<string, boolean>>({});
  const [blockThirdParty, setBlockThirdParty] = useState<boolean>(false);
  const [sslExceptions, setSslExceptions] = useState<SslException[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showConfirmSsl, setShowConfirmSsl] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const state = await window.merezhyvo?.settings?.cookies?.get?.();
      if (state) {
        setBlockThirdParty(Boolean(state.blockThirdParty));
        setExceptions(state.exceptions?.thirdPartyAllow ?? {});
        try {
          window.dispatchEvent(new CustomEvent('merezhyvo:cookies:updated', { detail: state }));
        } catch {
          // ignore
        }
      } else {
        setBlockThirdParty(false);
        setExceptions({});
      }
      const httpsState = await window.merezhyvo?.settings?.https?.get?.();
      if (httpsState && Array.isArray(httpsState.sslExceptions)) {
        setSslExceptions(httpsState.sslExceptions);
      } else {
        setSslExceptions([]);
      }
      try {
        window.dispatchEvent(
          new CustomEvent('merezhyvo:https:updated', {
            detail: httpsState ?? { httpsMode: undefined, sslExceptions: [] }
          })
        );
      } catch {
        // ignore
      }
    } catch {
      setBlockThirdParty(false);
      setExceptions({});
      setSslExceptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRemoveSsl = useCallback(
    async (exception: SslException) => {
      try {
        await window.merezhyvo?.settings?.https?.removeException?.({
          host: exception.host,
          errorType: exception.errorType
        });
      } catch {
        // noop
      } finally {
        void refresh();
      }
    },
    [refresh]
  );

  const handleToggle = useCallback(
    async (host: string, allow: boolean) => {
      if (!host) return;
      try {
        await window.merezhyvo?.settings?.cookies?.setException?.(host, allow);
      } catch {
        // ignore transient error, best-effort UI
      } finally {
        void refresh();
      }
    },
    [refresh]
  );

  const handleClearAll = useCallback(async () => {
    try {
      await window.merezhyvo?.settings?.cookies?.clearExceptions?.();
    } catch {
      // noop
    } finally {
      setShowConfirm(false);
      void refresh();
    }
  }, [refresh]);

  const handleClearAllSsl = useCallback(async () => {
    if (!sslExceptions.length) return;
    try {
      await Promise.all(
        sslExceptions.map((item) =>
          window.merezhyvo?.settings?.https?.removeException?.({
            host: item.host,
            errorType: item.errorType
          })
        )
      );
    } catch {
      // best-effort
    } finally {
      setShowConfirmSsl(false);
      void refresh();
    }
  }, [refresh, sslExceptions]);

  const entries = useMemo(() => Object.entries(exceptions), [exceptions]);
  const hasEntries = entries.length > 0;
  const hasSslEntries = sslExceptions.length > 0;

  const toggleTrackWidth = mode === 'mobile' ? 90 : 60;
  const toggleTrackHeight = mode === 'mobile' ? 46 : 26;
  const toggleThumbSize = mode === 'mobile' ? 38 : 18;

  const renderToggle = (checked: boolean, onChange: (next: boolean) => void) => (
    <span style={{ position: 'relative', width: toggleTrackWidth, height: toggleTrackHeight, display: 'inline-block' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          position: 'absolute',
          inset: 0,
          margin: 0,
          opacity: 0,
          cursor: 'pointer',
          zIndex: 2
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 999,
          backgroundColor: checked ? '#2563ebeb' : 'transparent',
          border: '1px solid #ACB2B7',
          transition: 'background-color 160ms ease, border-color 160ms ease'
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: mode === 'mobile' ? 4 : 3,
          left: checked ? (mode === 'mobile' ? 44 : 34) : (mode === 'mobile' ? 4 : 3),
          width: toggleThumbSize,
          height: toggleThumbSize,
          borderRadius: '50%',
          backgroundColor: checked ? '#ffffff' : '#ACB2B7',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          transition: 'left 160ms ease'
        }}
      />
    </span>
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: mode === 'mobile' ? '28px 22px 40px' : '24px 28px',
        boxSizing: 'border-box',
        color: '#e2e8f0'
      }}
      className="service-scroll"
    >
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: mode === 'mobile' ? 18 : 12 }}>
        <div>
          <div style={{ fontSize: mode === 'mobile' ? '46px' : '22px', fontWeight: 800 }}>
            {t('securityExceptions.title')}
          </div>
          <p style={{ fontSize: mode === 'mobile' ? '38px' : '15px', opacity: 0.9, marginTop: 8, lineHeight: 1.5 }}>
            {t('securityExceptions.description')}
          </p>
          {!blockThirdParty && (
            <p style={{ fontSize: mode === 'mobile' ? '36px' : '14px', color: '#fbbf24', marginTop: 6 }}>
              {t('securityExceptions.globalAllow')}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => hasEntries && setShowConfirm((prev) => !prev)}
              disabled={!hasEntries}
              style={{
                padding: mode === 'mobile' ? '16px 18px' : '10px 14px',
                borderRadius: 12,
                border: rowBorder,
                background: hasEntries ? 'rgba(15,23,42,0.6)' : 'rgba(15,23,42,0.3)',
                color: hasEntries ? '#e2e8f0' : 'rgba(226,232,240,0.5)',
                cursor: hasEntries ? 'pointer' : 'not-allowed',
                fontSize: mode === 'mobile' ? '38px' : '15px'
              }}
            >
              {t('securityExceptions.clearCookies')}
            </button>
            {showConfirm && hasEntries && (
              <div
                style={{
                  position: 'absolute',
                  top: mode === 'mobile' ? '110%' : '100%',
                  right: 0,
                  width: mode === 'mobile' ? '100%' : 360,
                  maxWidth: mode === 'mobile' ? 'none' : 420,
                  padding: mode === 'mobile' ? '18px 16px' : '12px 12px',
                  marginTop: 8,
                  borderRadius: 14,
                  border: rowBorder,
                  background: 'rgba(15,23,42,0.9)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                  zIndex: 10,
                  color: '#e2e8f0'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? '38px' : '15px', marginBottom: mode === 'mobile' ? 14 : 8 }}>
                  {t('securityExceptions.confirmClear')}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    style={{
                      padding: mode === 'mobile' ? '14px 16px' : '8px 12px',
                      borderRadius: 10,
                      border: rowBorder,
                      background: 'rgba(30,41,59,0.7)',
                      color: '#e2e8f0',
                      cursor: 'pointer',
                      fontSize: mode === 'mobile' ? '38px' : '15px',
                      minWidth: mode === 'mobile' ? '100%' : 'none'
                    }}
                  >
                    {t('global.close')}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    style={{
                      padding: mode === 'mobile' ? '14px 18px' : '8px 12px',
                      borderRadius: 10,
                      border: rowBorder,
                      background: '#ef4444',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: mode === 'mobile' ? '38px' : '15px',
                      minWidth: mode === 'mobile' ? '100%' : 'none'
                    }}
                  >
                    {t('securityExceptions.clearCookies')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            borderRadius: 16,
            border: rowBorder,
            overflow: 'hidden',
          background: 'rgba(15,23,42,0.45)',
          minHeight: 120
        }}
      >
        {loading ? (
            <div style={{ padding: 18, textAlign: 'center', fontSize: mode === 'mobile' ? '38px' : '15px' }}>{t('global.loading')}</div>
          ) : !hasEntries ? (
            <div style={{ padding: 18, textAlign: 'center', opacity: 0.8, fontSize: mode === 'mobile' ? '38px' : '15px' }}>
              {t('securityExceptions.empty')}
            </div>
          ) : (
            entries.map(([host, allow], idx) => (
              <div
                key={host}
                style={{
                  display: 'grid',
                  gridTemplateColumns: mode === 'mobile' ? '1fr' : '1fr auto',
                  alignItems: mode === 'mobile' ? 'stretch' : 'center',
                  gap: 12,
                  padding: mode === 'mobile' ? '18px 20px' : '12px 14px',
                  borderBottom: idx === entries.length - 1 ? 'none' : rowBorder
                }}
              >
                <div style={{ fontWeight: 600, wordBreak: 'break-word', fontSize: mode === 'mobile' ? '40px' : '15px' }}>
                  {host}
                </div>
                {mode === 'mobile' ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 6 }}>
                    <span style={{ fontSize: '38px' }}>
                      {t('securityExceptions.toggle')}
                    </span>
                    {renderToggle(allow, (next) => handleToggle(host, next))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '13px' }}>
                      {t('securityExceptions.toggle')}
                    </span>
                    {renderToggle(allow, (next) => handleToggle(host, next))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: mode === 'mobile' ? 22 : 14 }}>
          <div style={{ fontSize: mode === 'mobile' ? 38 : 18, fontWeight: 700, marginBottom: mode === 'mobile' ? 10 : 6 }}>
            {t('securityExceptions.certsTitle')}
          </div>
          <div style={{ color: 'rgba(226,232,240,0.75)', fontSize: mode === 'mobile' ? '35px' : '14px', marginBottom: mode === 'mobile' ? 10 : 6 }}>
            {t('securityExceptions.certsDesc')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: mode === 'mobile' ? 10 : 6 }}>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => hasSslEntries && setShowConfirmSsl((prev) => !prev)}
                disabled={!hasSslEntries}
                style={{
                  padding: mode === 'mobile' ? '14px 16px' : '8px 12px',
                  borderRadius: 12,
                  border: rowBorder,
                  background: hasSslEntries ? 'rgba(15,23,42,0.6)' : 'rgba(15,23,42,0.3)',
                  color: hasSslEntries ? '#e2e8f0' : 'rgba(226,232,240,0.5)',
                  cursor: hasSslEntries ? 'pointer' : 'not-allowed',
                  fontSize: mode === 'mobile' ? '38px' : '15px',
                  marginBottom: mode === 'mobile' ? '25px' : '10px',
                }}
              >
                {t('securityExceptions.certsClear')}
              </button>
              {showConfirmSsl && hasSslEntries && (
                <div
                  style={{
                    position: 'absolute',
                    top: mode === 'mobile' ? '110%' : '100%',
                    right: 0,
                    width: mode === 'mobile' ? '100%' : 360,
                    maxWidth: mode === 'mobile' ? 'none' : 420,
                    padding: mode === 'mobile' ? '18px 16px' : '12px 12px',
                    marginTop: 8,
                    borderRadius: 14,
                    border: rowBorder,
                    background: 'rgba(15,23,42,0.9)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                    zIndex: 10,
                    color: '#e2e8f0'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: mode === 'mobile' ? 38 : 15, marginBottom: mode === 'mobile' ? 14 : 8 }}>
                    {t('securityExceptions.confirmCerts')}
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setShowConfirmSsl(false)}
                      style={{
                        padding: mode === 'mobile' ? '14px 16px' : '8px 12px',
                        borderRadius: 10,
                        border: rowBorder,
                        background: 'rgba(30,41,59,0.7)',
                        color: '#e2e8f0',
                        cursor: 'pointer',
                        fontSize: mode === 'mobile' ? '38px' : '15px',
                        minWidth: mode === 'mobile' ? '100%' : 'none'
                      }}
                    >
                      {t('global.close')}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllSsl}
                      style={{
                        padding: mode === 'mobile' ? '14px 18px' : '8px 12px',
                        borderRadius: 10,
                        border: rowBorder,
                        background: '#ef4444',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: mode === 'mobile' ? '38px' : '15px',
                        minWidth: mode === 'mobile' ? '100%' : 'none'
                      }}
                    >
                      {t('securityExceptions.certsClear')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              borderRadius: 16,
              border: rowBorder,
              overflow: 'hidden',
              background: 'rgba(15,23,42,0.45)',
              minHeight: 120
            }}
          >
            {loading ? (
              <div style={{ padding: 18, textAlign: 'center', fontSize: mode === 'mobile' ? '38px' : '15px' }}>{t('global.loading')}</div>
            ) : !hasSslEntries ? (
              <div style={{ padding: 18, textAlign: 'center', opacity: 0.8, fontSize: mode === 'mobile' ? '38px' : '15px' }}>
                {t('securityExceptions.certsEmpty')}
              </div>
            ) : (
              sslExceptions.map((item, idx) => (
                <div
                  key={`${item.host}__${item.errorType}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: mode === 'mobile' ? '1fr' : '2fr 1fr auto',
                    alignItems: 'center',
                    gap: mode === 'mobile' ? 10 : 8,
                    padding: mode === 'mobile' ? '16px 18px' : '10px 12px',
                    borderBottom: idx === sslExceptions.length - 1 ? 'none' : rowBorder
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: mode === 'mobile' ? '38px' : '15px', wordBreak: 'break-word' }}>{item.host}</div>
                  <div style={{ fontSize: mode === 'mobile' ? '34px' : '13px', color: 'rgba(226,232,240,0.8)' }}>
                    {item.errorType}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveSsl(item)}
                      style={{
                        border: rowBorder,
                        background: 'transparent',
                        color: '#e2e8f0',
                        borderRadius: 10,
                        padding: mode === 'mobile' ? '12px 16px' : '8px 10px',
                        cursor: 'pointer',
                        fontSize: mode === 'mobile' ? '38px' : '15px'
                      }}
                    >
                      {t('securityExceptions.remove')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityExceptionsPage;
