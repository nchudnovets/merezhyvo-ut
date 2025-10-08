import { useEffect, useState } from 'react';

function getInitialMode() {
  const ds = document.documentElement.dataset.mode;
  if (ds === 'mobile' || ds === 'desktop') return ds;

  const p = new URLSearchParams(location.search).get('mode');
  if (p === 'mobile' || p === 'desktop') return p;

  return 'desktop';
}

export function useMerezhyvoMode() {
  const [mode, setMode] = useState(getInitialMode());

  useEffect(() => {
    document.documentElement.dataset.mode = mode;
  }, [mode]);

  useEffect(() => {
    const off = window.merezhyvo?.onMode
      ? window.merezhyvo.onMode((m) => {
          if (m === 'mobile' || m === 'desktop') setMode(m);
        })
      : null;

    return () => { if (typeof off === 'function') off(); };
  }, []);

  return mode;
}
