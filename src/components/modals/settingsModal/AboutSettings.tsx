import React from 'react';

import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';
import type { Mode } from '../../../types/models';
import type { SettingsAppInfo } from './settingsModalTypes';

type AboutSettingsProps = {
  mode: Mode;
  appInfo: SettingsAppInfo;
  onOpenLicenses: () => void;
};

const AboutSettings: React.FC<AboutSettingsProps> = ({ mode, appInfo, onOpenLicenses }) => {
  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] || {};
  const aboutNameRaw = (appInfo?.name || 'Merezhyvo').trim();
  const aboutName = aboutNameRaw
    ? aboutNameRaw.charAt(0).toUpperCase() + aboutNameRaw.slice(1)
    : 'Merezhyvo';
  const aboutVersion = appInfo?.version || '0.0.0';
  const chromiumVersion = appInfo?.chromium || 'Unknown';
  const aboutDescription = `A browser designed for Ubuntu Touch. Based on Chromium version: ${chromiumVersion || 'Unknown'}.`;
  const torVersionLabel =
    appInfo?.torVersion && appInfo.torVersion.trim()
      ? `Tor: ${appInfo.torVersion}`
      : 'Tor: not available';
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
        Version {aboutVersion}
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
        {torVersionLabel}
      </p>
      <p
        style={{
          ...styles.aboutDescription,
          ...(modeStyles.settingsAboutDescription || {})
        }}
      >
        Merezhyvo is free to use.
      </p>
      <p
        style={{
          ...styles.aboutDescription,
          ...(modeStyles.settingsAboutDescription || {})
        }}
      >
        All rights reserved by the author.
      </p>
      <button
        type="button"
        style={{
          ...styles.aboutButton,
          ...(modeStyles.settingsAboutButton || {})
        }}
        onClick={onOpenLicenses}
      >
        Licenses
      </button>
   </div>
 );
};

export default AboutSettings;
