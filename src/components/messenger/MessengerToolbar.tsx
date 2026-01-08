import React, { type Ref, type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MessengerDefinition, MessengerId, Mode, TrackerStatus } from '../../types/models';
import { messengerToolbarStyles, messengerToolbarModeStyles } from './messengerToolbarStyles';
import { MessengerIcon } from './MessengerIcon';
import { useI18n } from '../../i18n/I18nProvider';
import { SecurityShield } from '../toolbar/SecurityShield';

type SecurityInfo = {
  state: string;
  url?: string | null;
  host?: string | null;
  error?: string | null;
  issuer?: string | null;
  subject?: string | null;
  validFrom?: number | null;
  validTo?: number | null;
  fingerprint?: string | null;
} | null;

interface MessengerToolbarProps {
  mode: Mode;
  messengers: MessengerDefinition[];
  activeMessengerId: MessengerId | null;
  onSelectMessenger: (id: MessengerId) => void;
  onExit: () => void;
  toolbarRef?: Ref<HTMLDivElement>;
  securityState: 'ok' | 'warn' | 'notice';
  securityInfo: SecurityInfo;
  certExceptionAllowed: boolean;
  onToggleCertException?: (next: boolean) => void;
  cookiePolicy?: {
    blockThirdParty: boolean;
    exceptionAllowed: boolean;
    host: string | null;
    blockedTotal?: number;
  };
  onToggleCookieException?: (next: boolean) => void;
  onOpenSiteData?: (host?: string | null) => void;
  onOpenPrivacyInfo?: () => void;
  onOpenSecurityExceptions?: () => void;
  trackerStatus?: TrackerStatus;
  onToggleTrackerException?: (next: boolean) => void;
  onToggleAdsException?: (next: boolean) => void;
  onOpenTrackersExceptions?: () => void;
}

export const MessengerToolbar: React.FC<MessengerToolbarProps> = ({
  mode,
  messengers,
  activeMessengerId,
  onSelectMessenger,
  onExit,
  toolbarRef,
  securityState,
  securityInfo,
  certExceptionAllowed,
  onToggleCertException,
  cookiePolicy,
  onToggleCookieException,
  onOpenSiteData,
  onOpenPrivacyInfo,
  onOpenSecurityExceptions,
  trackerStatus,
  onToggleTrackerException,
  onToggleAdsException,
  onOpenTrackersExceptions
}) => {
  const base = messengerToolbarStyles;
  const modeStyles = messengerToolbarModeStyles[mode] || {};
  const { t } = useI18n();
  const buttonRefs = useRef<Map<MessengerId, HTMLButtonElement | null>>(new Map());
  const [openMessengerForSecurity, setOpenMessengerForSecurity] = useState<MessengerId | null>(null);
  const [popupStyle, setPopupStyle] = useState<CSSProperties | undefined>(undefined);
  const cornerSize = useMemo(() => (mode === 'mobile' ? 75 : 42), [mode]);
  const activePaddingRight = useMemo(() => (mode === 'mobile' ? '132px' : '88px'), [mode]);
  const securityOpen = openMessengerForSecurity === activeMessengerId;

  const setButtonRef = useCallback((id: MessengerId, node: HTMLButtonElement | null) => {
    const map = buttonRefs.current;
    if (!node) {
      map.delete(id);
      return;
    }
    map.set(id, node);
  }, []);

  const updatePopupPosition = useCallback(() => {
    if (!activeMessengerId) return;
    const node = buttonRefs.current.get(activeMessengerId);
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const estWidth = mode === 'mobile' ? 700 : 460;
    const estHeight = mode === 'mobile' ? 720 : 440;
    const padding = mode === 'mobile' ? 12 : 8;
    const maxLeft = Math.max(padding, window.innerWidth - estWidth - padding);
    const maxTop = Math.max(padding, window.innerHeight - estHeight - padding);
    const left = Math.min(Math.max(rect.left, padding), maxLeft);
    const top = Math.min(Math.max(rect.bottom + (mode === 'mobile' ? 12 : 6), padding), maxTop);
    setPopupStyle({
      position: 'fixed',
      left,
      top,
      right: 'auto',
      maxWidth: mode === 'mobile' ? 700 : 460,
      minWidth: 360
    });
  }, [activeMessengerId, mode]);

  const handleToggleSecurity = useCallback(
    (event?: React.MouseEvent) => {
      event?.stopPropagation();
      setOpenMessengerForSecurity((current) => {
        if (!activeMessengerId) return null;
        const nextId = current === activeMessengerId ? null : activeMessengerId;
        if (nextId) {
          updatePopupPosition();
        }
        return nextId;
      });
    },
    [activeMessengerId, updatePopupPosition]
  );

  useEffect(() => {
    if (!securityOpen) return;
    updatePopupPosition();
    const handleResize = () => updatePopupPosition();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [securityOpen, updatePopupPosition]);

  if (!messengers.length) {
    return (
      <div
        style={{
          ...base.container,
          ...(modeStyles.container || {}),
          justifyContent: 'flex-end'
        }}
      >
        <button
          type="button"
          onClick={onExit}
          style={{
            ...base.exitButton,
            ...(modeStyles.exitButton || {})
          }}
        >
          <span style={{ ...base.label, ...(modeStyles.label || {}) }}>
            {t('messenger.toolbar.back')}
          </span>
          <span style={{ ...base.icon, marginLeft: 6 }}>
            <svg
              width={modeStyles.icon?.width ?? 18}
              height={modeStyles.icon?.height ?? 18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div ref={toolbarRef} style={{ ...base.container, ...(modeStyles.container || {}) }}>
      <div style={{ ...base.list, ...(modeStyles.list || {}) }}>
        {messengers.map((messenger) => {
          const isActive = messenger.id === activeMessengerId;
          const buttonStyle: CSSProperties = {
            ...base.button,
            ...(modeStyles.button || {}),
            ...(isActive ? { ...base.buttonActive, ...(modeStyles.buttonActive || {}), paddingRight: activePaddingRight } : {})
          };
          return (
            <div key={messenger.id} style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
              <button
                type="button"
                ref={(node) => setButtonRef(messenger.id, node)}
                onClick={() => onSelectMessenger(messenger.id)}
                aria-pressed={isActive ? 'true' : 'false'}
                style={{ ...buttonStyle, width: '100%' }}
              >
                <span style={base.icon}>
                  <MessengerIcon id={messenger.id} size={modeStyles.icon?.width} />
                </span>
                <span style={{ ...base.label, ...(modeStyles.label || {}) }}>{messenger.title}</span>
              </button>
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 0,
                    width: cornerSize,
                    height: cornerSize,
                    pointerEvents: 'none',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(135deg, transparent 46%, var(--mzr-border) 46%, var(--mzr-border) 50%, rgba(0,0,0,0.12) 50%)'
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      right: mode === 'mobile' ? -4 : 2,
                      bottom: mode === 'mobile' ? -4 : 0,
                      pointerEvents: 'auto'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SecurityShield
                      translate={t}
                      mode={mode}
                      securityState={securityState}
                      securityInfo={securityInfo}
                      securityOpen={securityOpen}
                      onToggleSecurity={() => handleToggleSecurity()}
                      certExceptionAllowed={certExceptionAllowed}
                      onToggleCertException={onToggleCertException}
                      cookiePolicy={cookiePolicy}
                      onToggleCookieException={onToggleCookieException}
                      onOpenSiteData={onOpenSiteData}
                      onOpenPrivacyInfo={onOpenPrivacyInfo}
                      onOpenSecurityExceptions={onOpenSecurityExceptions}
                      trackerStatus={trackerStatus}
                      onToggleTrackerException={onToggleTrackerException}
                      onToggleAdsException={onToggleAdsException}
                      onOpenTrackersExceptions={onOpenTrackersExceptions}
                      popupStyle={popupStyle}
                      renderAnchor={({ securityColor }) => (
                        <div
                          aria-label={t('security.popup.title')}
                          onClick={handleToggleSecurity}
                          style={{
                            color: securityColor,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            background: 'transparent',
                            padding: mode === 'mobile' ? 10 : 6,
                            marginRight: mode === 'mobile' ? -6 : -4,
                            marginBottom: mode === 'mobile' ? -6 : -6
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width={mode === 'mobile' ? 44 : 18}
                            height={mode === 'mobile' ? 44 : 18}
                            fill="currentColor"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M12 2 4 5v6c0 5.55 3.84 10.74 8 11 4.16-.26 8-5.45 8-11V5l-8-3Zm0 2.18 6 2.25v4.71c0 4.18-2.88 8.16-6 8.39-3.12-.23-6-4.21-6-8.39V6.43l6-2.25Zm0 3.07-2.4 2.4a3 3 0 0 0 4.8 0L12 7.25Z" />
                          </svg>
                        </div>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={onExit}
          style={{
            ...base.exitButton,
            ...(modeStyles.exitButton || {})
          }}
        >
          <span style={{ ...base.label, ...(modeStyles.label || {}) }}>
            {t('messenger.toolbar.back')}
          </span>
          <span style={{ ...base.icon, marginLeft: 6 }}>
            <svg
              width={modeStyles.icon?.width ?? 18}
              height={modeStyles.icon?.height ?? 18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );
};

export default MessengerToolbar;
