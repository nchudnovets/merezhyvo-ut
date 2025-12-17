import { useCallback, useEffect, useRef, useState } from 'react';

const TOAST_TIMEOUT_MS = 3200;

export const useGlobalToast = () => {
  const [globalToast, setGlobalToast] = useState<string | null>(null);
  const globalToastTimerRef = useRef<number | null>(null);

  const showGlobalToast = useCallback((message: string) => {
    setGlobalToast(message);
    if (globalToastTimerRef.current) {
      window.clearTimeout(globalToastTimerRef.current);
    }
    globalToastTimerRef.current = window.setTimeout(() => {
      setGlobalToast(null);
      globalToastTimerRef.current = null;
    }, TOAST_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (globalToastTimerRef.current) {
        window.clearTimeout(globalToastTimerRef.current);
        globalToastTimerRef.current = null;
      }
    };
  }, []);

  return { globalToast, showGlobalToast };
};
