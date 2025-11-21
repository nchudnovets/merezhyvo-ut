import React, { useEffect, useMemo, useState } from 'react';
import type { Mode } from '../../types/models';
import { licensesStyles } from './licensesStyles';
import { licensesModeStyles } from './licensesModeStyles';

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
  onToggle: () => void;
  open: boolean;
  mode: Mode;
};

const Viewer: React.FC<ViewerProps> = ({ lead, subtext, load, toggleLabel, onToggle, open, mode }) => {
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
        {open ? 'Hide content' : toggleLabel}
      </button>
      {open && !load.loading && load.text && <div style={merge('viewer')}>{load.text}</div>}
    </section>
  );
};

type LicensesPageProps = {
  mode: Mode;
};

const LicensesPage: React.FC<LicensesPageProps> = ({ mode }) => {
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
  const [showApp, setShowApp] = useState(false);
  const [showThird, setShowThird] = useState(false);

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
            error: 'File not found. Please reinstall or contact support.',
            loading: false
          });
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

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
            error: 'File not found. Please reinstall or contact support.',
            loading: false
          });
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

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
          lead="Merezhyvo — Free to use."
          subtext="You may use the app for free, including for commercial purposes. The software remains the property of the author. See the full license text below."
          load={appLicense}
          toggleLabel="View full license text"
          onToggle={() => setShowApp((prev) => !prev)}
          open={showApp}
          mode={mode}
        />
        <Viewer
          lead="This app bundles open-source components."
          subtext="Each component is licensed under its own terms. See the consolidated notices below."
          load={thirdParty}
          toggleLabel="Open THIRD-PARTY-NOTICES"
          onToggle={() => setShowThird((prev) => !prev)}
          open={showThird}
          mode={mode}
        />
      </>
    ),
    [appLicense, thirdParty, showApp, showThird, mode]
  );

  return (
    <div style={mergeContainer()}>
      <h2>Licenses</h2>
      {viewerContent}
    </div>
  );
};

export default LicensesPage;
