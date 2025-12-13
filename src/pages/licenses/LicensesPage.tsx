import React, { useEffect, useMemo, useState } from 'react';
import type { Mode } from '../../types/models';
import { licensesStyles } from './licensesStyles';
import { licensesModeStyles } from './licensesModeStyles';
import { useI18n } from '../../i18n/I18nProvider';

type LoadState = {
  text: string | null;
  error: string | null;
  loading: boolean;
};

const fetchText = async (relativePath: string): Promise<string> => {
  const res = await fetch(relativePath);
  if (!res.ok) {
    throw new Error(`Unable to load ${relativePath}`);
  }
  return await res.text();
};

type ViewerProps = {
  lead: string;
  subtext: string;
  load: LoadState;
  toggleLabel: string;
  hideLabel: string;
  onToggle: () => void;
  open: boolean;
  mode: Mode;
};

const Viewer: React.FC<ViewerProps> = ({
  lead,
  subtext,
  load,
  toggleLabel,
  hideLabel,
  onToggle,
  open,
  mode
}) => {
  const styles = licensesStyles;
  const modeStyles = licensesModeStyles[mode] || {};
  const merge = (key: keyof typeof styles) => ({
    ...styles[key],
    ...(modeStyles[key] ?? {})
  });
  return (
    <section style={merge('section')}>
      <div style={merge('lead')}>{lead}</div>
      <p style={merge('subtext')}>{subtext}</p>
      {load.error && <div style={merge('banner')}>{load.error}</div>}
      <button type="button" style={merge('button')} onClick={onToggle}>
        {open ? hideLabel : toggleLabel}
      </button>
      {open && !load.loading && load.text && <div style={merge('viewer')}>{load.text}</div>}
    </section>
  );
};

type LicensesPageProps = {
  mode: Mode;
  onClose?: () => void;
};

const LicensesPage: React.FC<LicensesPageProps> = ({ mode, onClose }) => {
  const [appLicense, setAppLicense] = useState<LoadState>({
    text: null,
    error: null,
    loading: true
  });
  const [thirdParty, setThirdParty] = useState<LoadState>({
    text: null,
    error: null,
    loading: true
  });
  const [torLicense, setTorLicense] = useState<LoadState>({
    text: null,
    error: null,
    loading: true
  });
  const [showApp, setShowApp] = useState(false);
  const [showThird, setShowThird] = useState(false);
  const [showTor, setShowTor] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    let canceled = false;
    fetchText('resources/legal/LICENSE.txt')
      .then((text) => {
        if (!canceled) setAppLicense({ text, error: null, loading: false });
      })
      .catch(() => {
        if (!canceled) {
          setAppLicense({
            text: null,
            error: t('licenses.error.missing'),
            loading: false
          });
        }
      });
    return () => {
      canceled = true;
    };
  }, [t]);

  useEffect(() => {
    let canceled = false;
    fetchText('resources/legal/THIRD-PARTY-NOTICES.txt')
      .then((text) => {
        if (!canceled) setThirdParty({ text, error: null, loading: false });
      })
      .catch(() => {
        if (!canceled) {
          setThirdParty({
            text: null,
            error: t('licenses.error.missing'),
            loading: false
          });
        }
      });
    return () => {
      canceled = true;
    };
  }, [t]);

  useEffect(() => {
    let canceled = false;
    fetchText('resources/tor/LICENSE')
      .then((text) => {
        if (!canceled) setTorLicense({ text, error: null, loading: false });
      })
      .catch(() => {
        if (!canceled) {
          setTorLicense({
            text: null,
            error: t('licenses.error.missing'),
            loading: false
          });
        }
      });
    return () => {
      canceled = true;
    };
  }, [t]);

  const styles = licensesStyles;
  const modeStyles = licensesModeStyles[mode] || {};
  const mergeContainer = () => ({
    ...styles.container,
    ...(modeStyles.container ?? {})
  });

  const viewerContent = useMemo(
    () => (
      <>
        <Viewer
          lead={t('licenses.app.lead')}
          subtext={t('licenses.app.subtext')}
          load={appLicense}
          toggleLabel={t('licenses.app.toggle')}
          hideLabel={t('licenses.hide')}
          onToggle={() => setShowApp((prev) => !prev)}
          open={showApp}
          mode={mode}
        />
        <Viewer
          lead={t('licenses.third.lead')}
          subtext={t('licenses.third.subtext')}
          load={thirdParty}
          toggleLabel={t('licenses.third.toggle')}
          hideLabel={t('licenses.hide')}
          onToggle={() => setShowThird((prev) => !prev)}
          open={showThird}
          mode={mode}
        />
        <Viewer
          lead={t('licenses.tor.lead')}
          subtext={t('licenses.tor.subtext')}
          load={torLicense}
          toggleLabel={t('licenses.tor.toggle')}
          hideLabel={t('licenses.hide')}
          onToggle={() => setShowTor((prev) => !prev)}
          open={showTor}
          mode={mode}
        />
      </>
    ),
    [appLicense, thirdParty, showApp, showThird, torLicense, showTor, mode, t]
  );

  return (
    <div style={mergeContainer()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('global.close')}
              style={{
                width: mode === 'mobile' ? 56 : 36,
                height: mode === 'mobile' ? 56 : 36,
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.35)',
                background: 'rgba(15,23,42,0.6)',
                color: '#e2e8f0',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <svg width={mode === 'mobile' ? 50 : 18} height={mode === 'mobile' ? 50 : 18} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          <h2>{t('licenses.title')}</h2>
        </div>
      </div>
      {viewerContent}
    </div>
  );
};

export default LicensesPage;
