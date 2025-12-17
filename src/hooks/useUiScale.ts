import { useCallback, useEffect, useState } from 'react';

const UI_SCALE_STEP = 0.05;

export const useUiScale = (initialScale = 1) => {
  const [uiScale, setUiScale] = useState<number>(initialScale);

  const applyUiScale = useCallback(async (raw: number) => {
    const rounded = Math.round(raw / UI_SCALE_STEP) * UI_SCALE_STEP;
    const clamped = Number(Math.max(0.5, Math.min(1.6, rounded)).toFixed(2));
    setUiScale(clamped);
    try {
      await window.merezhyvo?.ui?.set?.({ scale: clamped });
    } catch {
      // ignore
    }
  }, []);

  const handleUiScaleReset = useCallback(() => {
    void applyUiScale(1);
  }, [applyUiScale]);

  useEffect(() => {
    const root = document.documentElement;
    try {
      root.style.setProperty('--ui-scale', String(uiScale));
    } catch {
      // noop
    }
  }, [uiScale]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.shiftKey) return;
      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        void applyUiScale(uiScale + UI_SCALE_STEP);
      } else if (event.key === '-') {
        event.preventDefault();
        void applyUiScale(uiScale - UI_SCALE_STEP);
      } else if (event.key === '0') {
        event.preventDefault();
        handleUiScaleReset();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [applyUiScale, handleUiScaleReset, uiScale]);

  return {
    uiScale,
    setUiScale,
    applyUiScale,
    handleUiScaleReset
  };
};
