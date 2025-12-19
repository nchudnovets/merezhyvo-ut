import React, { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Mode, MessengerDefinition, MessengerId, HttpsMode, WebrtcMode } from '../../../types/models';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import { styles as baseStyles } from '../../../styles/styles';
import MessengerSettings from './MessengerSettings';
import SettingsSection from './SettingsSection';
import KeyboardSettings from './KeyboardSettings';
import type { SettingsAppInfo } from './settingsModalTypes';
import TorSettings from './TorSettings';
import AboutSettings from './AboutSettings';
import PasswordSettings from './PasswordSettings';
import DownloadSettingsSection from './DownloadSettingsSection';
import UiScaleSetting from './UiScaleSetting';
import LanguageSettings from './LanguageSettings';
import { useI18n } from '../../../i18n/I18nProvider';
import SecuritySettings from './SecuritySettings';
// import { PermissionsSettings } from './PermissionsSettings';

interface SettingsModalProps {
  mode: Mode;
  backdropStyle: CSSProperties;
  appInfo: SettingsAppInfo;
  torEnabled: boolean;
  torCurrentIp: string;
  torIpLoading: boolean;
  torKeepEnabledDraft: boolean;
  torConfigSaving: boolean;
  torConfigFeedback: string;
  onTorKeepChange: (value: boolean) => void;
  onClose: () => void;
  onOpenPasswords: () => void;
  onOpenLicenses: () => void;
  onRequestPasswordUnlock: (fromSettings?: boolean) => void;
  scrollToSection?: 'passwords' | null;
  onScrollSectionHandled?: () => void;
  messengerItems: MessengerDefinition[];
  messengerOrderSaving: boolean;
  messengerOrderMessage: string;
  onMessengerMove: (id: MessengerId, direction: 'up' | 'down') => void;
  downloadsConcurrent: 1 | 2 | 3;
  downloadsSaving: boolean;
  onDownloadsConcurrentChange: (value: 1 | 2 | 3) => void;
  onCopyDownloadsCommand: () => void;
  downloadsCommand: string;
  uiScale: number;
  onUiScaleChange: (value: number) => void;
  onUiScaleReset: () => void;
  onOpenTorLink: () => void;
  httpsMode: HttpsMode;
  onHttpsModeChange: (mode: HttpsMode) => void;
  webrtcMode: WebrtcMode;
  onWebrtcModeChange: (mode: WebrtcMode) => void;
  cookiesBlockThirdParty: boolean;
  onCookieBlockChange: (block: boolean) => void;
  onOpenSecurityExceptions: () => void;
  onOpenSiteData: () => void;
  onOpenPrivacyInfo: () => void;
  trackersEnabled: boolean;
  onTrackersEnabledChange: (enabled: boolean) => void;
  onOpenTrackersExceptions: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  mode,
  backdropStyle,
  appInfo,
  torEnabled,
  torCurrentIp,
  torIpLoading,
  torKeepEnabledDraft,
  torConfigSaving,
  torConfigFeedback,
  onTorKeepChange,
  onClose,
  onOpenPasswords,
  onOpenLicenses,
  onRequestPasswordUnlock,
  scrollToSection,
  onScrollSectionHandled,
  messengerItems,
  messengerOrderSaving,
  messengerOrderMessage,
  onMessengerMove
  ,
  downloadsConcurrent,
  downloadsSaving,
  onDownloadsConcurrentChange,
  onCopyDownloadsCommand,
  downloadsCommand,
  uiScale,
  onUiScaleChange,
  onUiScaleReset,
  onOpenTorLink,
  httpsMode,
  onHttpsModeChange,
  webrtcMode,
  onWebrtcModeChange,
  cookiesBlockThirdParty,
  onCookieBlockChange,
  onOpenSecurityExceptions,
  onOpenSiteData,
  onOpenPrivacyInfo,
  trackersEnabled,
  onTrackersEnabledChange,
  onOpenTrackersExceptions
}) => {
  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};
  const { t } = useI18n();
  const passwordSectionRef = useRef<HTMLDivElement | null>(null);
  const [forceExpandPasswords, setForceExpandPasswords] = useState(false);
  const shouldForceExpandPasswords = forceExpandPasswords;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    const styleId = 'mzr-settings-scroll-style';
    if (document.getElementById(styleId)) return undefined;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .settings-modal-body::-webkit-scrollbar,
      .settings-keyboard-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
      .settings-modal-body::-webkit-scrollbar-track,
      .settings-keyboard-scroll::-webkit-scrollbar-track { background: #111827; }
      .settings-modal-body::-webkit-scrollbar-thumb,
      .settings-keyboard-scroll::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(59,130,246,0.85), rgba(79,70,229,0.8));
        border-radius: 6px;
        border: 1px solid rgba(15, 23, 42, 0.6);
      }
      .settings-modal-body::-webkit-scrollbar-thumb:hover,
      .settings-keyboard-scroll::-webkit-scrollbar-thumb:hover { background: rgba(59,130,246,0.95); }
      .settings-modal-body,
      .settings-keyboard-scroll { scrollbar-color: rgba(59,130,246,0.85) #111827; scrollbar-width: thin; }
    `;
    document.head.appendChild(style);
    return () => {
      try {
        if (style.parentNode) style.parentNode.removeChild(style);
      } catch {}
    };
  }, []);
  useEffect(() => {
    if (scrollToSection === 'passwords' && passwordSectionRef.current) {
      setForceExpandPasswords(true);
      passwordSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onScrollSectionHandled?.();
    }
  }, [scrollToSection, onScrollSectionHandled]);

  const containerStyle =
    mode === 'mobile' ? styles.containerMobile : styles.container;
  const closeButtonStyle =
    mode === 'mobile' ? baseStyles.modalCloseMobile : baseStyles.modalClose;
  return (
    <div
      style={backdropStyle}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{...containerStyle, ...{maxHeight: '95%'}}}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div style={styles.header}>
          <h2
            id="settings-modal-title"
            style={{
              ...styles.title,
              ...(modeStyles.settingsModalTitle || {})
            }}
          >
            {t('settings.title')}
          </h2>
          <button
            type="button"
            aria-label={t('settings.close')}
            style={closeButtonStyle}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div style={styles.sections} className="settings-modal-body">
          <SettingsSection
            mode={mode}
            title={t('settings.section.tor')}
            expandedDefault
            body={
              <TorSettings
                mode={mode}
                torEnabled={torEnabled}
                torCurrentIp={torCurrentIp}
                torIpLoading={torIpLoading}
                torKeepEnabledDraft={torKeepEnabledDraft}
                torConfigSaving={torConfigSaving}
                torConfigFeedback={torConfigFeedback}
                onTorKeepChange={onTorKeepChange}
              />
            }
          />

          <SettingsSection
            mode={mode}
            title={t('settings.section.privacy')}
            expandedDefault={false}
            body={
              <SecuritySettings
                mode={mode}
              httpsMode={httpsMode}
              onChange={onHttpsModeChange}
              webrtcMode={webrtcMode}
              onWebrtcChange={onWebrtcModeChange}
              cookiesBlockThirdParty={cookiesBlockThirdParty}
              onCookieBlockChange={onCookieBlockChange}
              onOpenSecurityExceptions={onOpenSecurityExceptions}
              onOpenSiteData={onOpenSiteData}
              onOpenPrivacyInfo={onOpenPrivacyInfo}
              trackersEnabled={trackersEnabled}
              onTrackersEnabledChange={onTrackersEnabledChange}
              onOpenTrackersExceptions={onOpenTrackersExceptions}
            />
            }
          />

          <SettingsSection
            mode={mode}
            title={t('settings.section.appearance')}
            body={
              <UiScaleSetting
                mode={mode}
                value={uiScale}
                onChange={onUiScaleChange}
                onReset={onUiScaleReset}
              />
            }
          />

          <SettingsSection
            mode={mode}
            title={t('settings.language.title')}
            body={<LanguageSettings mode={mode} />}
          />

          <SettingsSection
            mode={mode}
            title={t('settings.section.keyboardLayout')}
            body={KeyboardSettings({mode}) as ReactNode}
          />

          <SettingsSection
            mode={mode}
            title={t('settings.section.passwords')}
            expandedDefault={false}
            forceExpanded={shouldForceExpandPasswords}
            sectionRef={passwordSectionRef}
            body={
              <PasswordSettings
                mode={mode}
                onManagePasswords={onOpenPasswords}
                onRequestUnlock={onRequestPasswordUnlock}
              />
            }
          />

          <SettingsSection
            mode={mode}
            title={t('settings.section.downloads')}
              body={
                <DownloadSettingsSection
                  mode={mode}
                  concurrent={downloadsConcurrent}
                  saving={downloadsSaving}
                  onConcurrentChange={onDownloadsConcurrentChange}
                  onCopyCommand={onCopyDownloadsCommand}
                  command={downloadsCommand}
                />
              }
          />

          <SettingsSection
            mode={mode}
            title={t('settings.section.messengerToolbar')}
            body={MessengerSettings({
              mode,
              items: messengerItems,
              saving: messengerOrderSaving,
              message: messengerOrderMessage,
              onMove: onMessengerMove
            }) as ReactNode}
          />

          <SettingsSection
            mode={mode}
            title={t('settings.section.about')}
            expandedDefault
            body={
              <AboutSettings
                mode={mode}
                appInfo={appInfo}
                onOpenLicenses={onOpenLicenses}
                onOpenTorLink={onOpenTorLink}
              />
            }
          />
        </div>

      </div>
    </div>
  );
};
