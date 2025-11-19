import React, { useEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject, PointerEvent as ReactPointerEvent, FocusEvent as ReactFocusEvent, ReactNode } from 'react';
import type { Mode, MessengerDefinition, MessengerId } from '../../../types/models';
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
// import { PermissionsSettings } from './PermissionsSettings';

interface SettingsModalProps {
  mode: Mode;
  backdropStyle: CSSProperties;
  appInfo: SettingsAppInfo;
  torEnabled: boolean;
  torCurrentIp: string;
  torIpLoading: boolean;
  torContainerValue: string;
  torSavedContainerId: string;
  torContainerSaving: boolean;
  torContainerMessage: string;
  torKeepEnabledDraft: boolean;
  torInputRef: RefObject<HTMLInputElement | null>;
  onTorInputPointerDown: (event: ReactPointerEvent<HTMLInputElement>) => void;
  onTorInputFocus: (event: ReactFocusEvent<HTMLInputElement>) => void;
  onTorInputBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  onTorContainerChange: (value: string) => void;
  onSaveTorContainer: () => void;
  onTorKeepChange: (value: boolean) => void;
  onClose: () => void;
  onOpenBookmarks: () => void;
  onOpenHistory: () => void;
  onOpenPasswords: () => void;
  onRequestPasswordUnlock: (fromSettings?: boolean) => void;
  scrollToSection?: 'passwords' | null;
  onScrollSectionHandled?: () => void;
  messengerItems: MessengerDefinition[];
  messengerOrderSaving: boolean;
  messengerOrderMessage: string;
  onMessengerMove: (id: MessengerId, direction: 'up' | 'down') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  mode,
  backdropStyle,
  appInfo,
  torEnabled,
  torCurrentIp,
  torIpLoading,
  torContainerValue,
  torSavedContainerId,
  torContainerSaving,
  torContainerMessage,
  torKeepEnabledDraft,
  torInputRef,
  onTorInputPointerDown,
  onTorInputFocus,
  onTorInputBlur,
  onTorContainerChange,
  onSaveTorContainer,
  onTorKeepChange,
  onClose,
  onOpenBookmarks,
  onOpenHistory,
  onOpenPasswords,
  onRequestPasswordUnlock,
  scrollToSection,
  onScrollSectionHandled,
  messengerItems,
  messengerOrderSaving,
  messengerOrderMessage,
  onMessengerMove
}) => {
  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};
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

  useEffect(() => {
    if (!scrollToSection) {
      setForceExpandPasswords(false);
    }
  }, [scrollToSection]);

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
        style={containerStyle}
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
            Settings
          </h2>
          <button
            type="button"
            aria-label="Close settings dialog"
            style={closeButtonStyle}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div style={styles.sections} className="settings-modal-body">
          <SettingsSection
            mode={mode}
            title="Tor"
            expandedDefault
            body={
              <TorSettings
                mode={mode}
                torEnabled={torEnabled}
                torCurrentIp={torCurrentIp}
                torIpLoading={torIpLoading}
                torContainerValue={torContainerValue}
                torSavedContainerId={torSavedContainerId}
                torContainerSaving={torContainerSaving}
                torContainerMessage={torContainerMessage}
                torKeepEnabledDraft={torKeepEnabledDraft}
                torInputRef={torInputRef}
                onTorInputPointerDown={onTorInputPointerDown}
                onTorInputFocus={onTorInputFocus}
                onTorInputBlur={onTorInputBlur}
                onTorContainerChange={onTorContainerChange}
                onSaveTorContainer={onSaveTorContainer}
                onTorKeepChange={onTorKeepChange}
              />
            }
          />

          <SettingsSection
            mode={mode}
            title="Passwords"
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
            title='Messenger toolbar'
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
            title='Keyboard Layouts'
            body={KeyboardSettings({mode}) as ReactNode}
          />

          <SettingsSection
            mode={mode}
            title="About"
            expandedDefault
            body={<AboutSettings mode={mode} appInfo={appInfo} />}
          />
        </div>

      </div>
    </div>
  );
};
