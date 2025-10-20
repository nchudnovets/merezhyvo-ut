import { useEffect, useState } from 'react';
import type { Mode, Unsubscribe } from '../types/models';
import { ipc } from '../services/ipc/ipc';

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
    const off: Unsubscribe = ipc.onMode((nextMode: Mode) => {
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
