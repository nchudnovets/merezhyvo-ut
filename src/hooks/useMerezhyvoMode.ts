import { useEffect, useState } from 'react';
import type { Mode } from '../types/models';
import { ipc } from '../services/ipc';

function getInitialMode(): Mode {
  if (typeof document !== 'undefined') {
    const current = document.documentElement.dataset.mode;
    if (current === 'mobile' || current === 'desktop') {
      return current;
    }
  }

  try {
    const param = new URLSearchParams(window.location.search).get('mode');
    if (param === 'mobile' || param === 'desktop') {
      return param;
    }
  } catch {}

  return 'desktop';
}

export function useMerezhyvoMode(): Mode {
  const [mode, setMode] = useState<Mode>(getInitialMode());

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.mode = mode;
    }
  }, [mode]);

  useEffect(() => {
    const off = ipc.onMode((nextMode) => {
      if (nextMode === 'mobile' || nextMode === 'desktop') {
        setMode(nextMode);
      }
    });
    return () => {
      off();
    };
  }, []);

  return mode;
}
