import React from 'react';

import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import type { Mode } from '../../../types/models';
import type { SettingsAppInfo } from './settingsModalTypes';
import { useI18n } from '../../../i18n/I18nProvider';

type AboutSettingsProps = {
  mode: Mode;
  appInfo: SettingsAppInfo;
  onOpenLicenses: () => void;
  onOpenTorLink: () => void;
};

const AboutSettings: React.FC<AboutSettingsProps> = ({
  mode,
  appInfo,
  onOpenLicenses,
  onOpenTorLink
}) => {
  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};
  const { t } = useI18n();
  const aboutNameRaw = (appInfo?.name || 'Merezhyvo').trim();
  const aboutName = aboutNameRaw
    ? aboutNameRaw.charAt(0).toUpperCase() + aboutNameRaw.slice(1)
    : 'Merezhyvo';
  const aboutVersion = appInfo?.version || '0.0.0';
  const chromiumVersion = appInfo?.chromium || 'Unknown';
  const aboutDescription = t('about.description', { chromium: chromiumVersion || 'Unknown' });
  const torVersionLabel =
    appInfo?.torVersion && appInfo.torVersion.trim()
      ? t('about.torVersion', { version: appInfo.torVersion })
      : t('about.torVersionUnavailable');
  return (
    <div
      style={{
        ...styles.aboutCard,
        ...(modeStyles.settingsAboutCard || {})
      }}
    >
      <p
        style={{
          ...styles.aboutName,
          ...(modeStyles.settingsAboutName || {})
        }}
      >
        {aboutName}
      </p>
      <p
        style={{
          ...styles.aboutVersion,
          ...(modeStyles.settingsAboutVersion || {})
        }}
      >
        {t('about.version', { version: aboutVersion })}
      </p>
      <p
        style={{
          ...styles.aboutDescription,
          ...(modeStyles.settingsAboutDescription || {})
        }}
      >
        {aboutDescription}
      </p>
      <p
        style={{
          ...styles.aboutDescription,
          ...(modeStyles.settingsAboutDescription || {})
        }}
      >
        {t('about.freeToUse')}
      </p>
      <p
        style={{
          ...styles.aboutDescription,
          ...(modeStyles.settingsAboutDescription || {})
        }}
      >
        {t('about.rights')}
      </p>
      <p
        style={{
          ...styles.aboutDescription,
          ...(modeStyles.settingsAboutDescription || {})
        }}
      >
        {t('about.torPreamble')}{' '}
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            onOpenTorLink();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            textDecoration: 'underline',
            padding: 0,
            font: 'inherit',
            cursor: 'pointer'
          }}
        >
          https://www.torproject.org
        </button>
        )
      </p>
      <p
        style={{
          ...styles.aboutDescription,
          ...(modeStyles.settingsAboutDescription || {})
        }}
      >
        {torVersionLabel}
      </p>
      <p
        style={{
          ...styles.aboutDescription,
          ...(modeStyles.settingsAboutDescription || {})
        }}
      >
        {t('about.torDisclaimer')}
      </p>
      <button
        type="button"
        style={{
          ...styles.aboutButton,
          ...(modeStyles.settingsAboutButton || {})
        }}
        onClick={onOpenLicenses}
      >
        {t('licenses.title')}
      </button>
   </div>
 );
};

export default AboutSettings;
