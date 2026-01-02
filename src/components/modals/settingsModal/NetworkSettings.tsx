import React from 'react';

import type { Mode, SecureDnsMode, SecureDnsProvider } from '../../../types/models';
import { useI18n } from '../../../i18n/I18nProvider';
import TorSettings from './TorSettings';
import SecureDnsSettings from './SecureDnsSettings';

type NetworkSettingsProps = {
  mode: Mode;
  torEnabled: boolean;
  torCurrentIp: string;
  torIpLoading: boolean;
  torKeepEnabledDraft: boolean;
  torConfigSaving: boolean;
  torConfigFeedback: string;
  onTorKeepChange: (value: boolean) => void;
  onOpenTorInfo: () => void;
  secureDnsEnabled: boolean;
  secureDnsMode: SecureDnsMode;
  secureDnsProvider: SecureDnsProvider;
  secureDnsNextdnsId: string;
  secureDnsCustomUrl: string;
  secureDnsError: string;
  onSecureDnsEnabledChange: (value: boolean) => void;
  onSecureDnsModeChange: (value: SecureDnsMode) => void;
  onSecureDnsProviderChange: (value: SecureDnsProvider) => void;
  onSecureDnsNextdnsIdChange: (value: string) => void;
  onSecureDnsNextdnsIdCommit: () => void;
  onSecureDnsCustomUrlChange: (value: string) => void;
  onSecureDnsCustomUrlCommit: () => void;
};

const NetworkSettings: React.FC<NetworkSettingsProps> = ({
  mode,
  torEnabled,
  torCurrentIp,
  torIpLoading,
  torKeepEnabledDraft,
  torConfigSaving,
  torConfigFeedback,
  onTorKeepChange,
  onOpenTorInfo,
  secureDnsEnabled,
  secureDnsMode,
  secureDnsProvider,
  secureDnsNextdnsId,
  secureDnsCustomUrl,
  secureDnsError,
  onSecureDnsEnabledChange,
  onSecureDnsModeChange,
  onSecureDnsProviderChange,
  onSecureDnsNextdnsIdChange,
  onSecureDnsNextdnsIdCommit,
  onSecureDnsCustomUrlChange,
  onSecureDnsCustomUrlCommit
}) => {
  const { t } = useI18n();
  const isMobile = mode === 'mobile';

  const subheadingStyle = {
    fontSize: isMobile ? '38px' : '14px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--mzr-text-muted)',
    fontWeight: 600
  } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 38 : 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 32 : 14 }}>
        <div style={subheadingStyle}>{t('settings.network.subsection.tor')}</div>
        <TorSettings
          mode={mode}
          torEnabled={torEnabled}
          torCurrentIp={torCurrentIp}
          torIpLoading={torIpLoading}
          torKeepEnabledDraft={torKeepEnabledDraft}
          torConfigSaving={torConfigSaving}
          torConfigFeedback={torConfigFeedback}
          onTorKeepChange={onTorKeepChange}
          onOpenTorInfo={onOpenTorInfo}
        />
      </div>

      <div style={{ height: 1, backgroundColor: 'var(--mzr-border)', opacity: 0.6 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 32 : 12 }}>
        <div style={subheadingStyle}>{t('settings.network.secureDns.heading')}</div>
        <SecureDnsSettings
          mode={mode}
          torEnabled={torEnabled}
          enabled={secureDnsEnabled}
          dnsMode={secureDnsMode}
          provider={secureDnsProvider}
          nextdnsId={secureDnsNextdnsId}
          customUrl={secureDnsCustomUrl}
          error={secureDnsError}
          onEnabledChange={onSecureDnsEnabledChange}
          onModeChange={onSecureDnsModeChange}
          onProviderChange={onSecureDnsProviderChange}
          onNextdnsIdChange={onSecureDnsNextdnsIdChange}
          onNextdnsIdCommit={onSecureDnsNextdnsIdCommit}
          onCustomUrlChange={onSecureDnsCustomUrlChange}
          onCustomUrlCommit={onSecureDnsCustomUrlCommit}
        />
      </div>
    </div>
  );
};

export default NetworkSettings;
