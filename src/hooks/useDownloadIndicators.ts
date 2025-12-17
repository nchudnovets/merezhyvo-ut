import { useCallback, useEffect, useRef, useState } from 'react';

export type DownloadIndicatorState = 'hidden' | 'active' | 'completed' | 'error';

type DownloadStatusDetail = {
  id?: string;
  status: 'started' | 'completed' | 'failed';
  file?: string;
};

type DownloadStateDetail = {
  id?: string;
  state?: 'queued' | 'downloading' | 'completed' | 'failed';
};

export const useDownloadIndicators = () => {
  const [downloadIndicatorState, setDownloadIndicatorState] =
    useState<DownloadIndicatorState>('hidden');
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const downloadToastTimerRef = useRef<number | null>(null);
  const downloadFileMapRef = useRef<Map<string, string>>(new Map());
  const completedDownloadsRef = useRef<Set<string>>(new Set());
  const activeDownloadsRef = useRef<Set<string>>(new Set());
  const downloadIndicatorTimerRef = useRef<number | null>(null);

  const clearDownloadIndicatorTimer = useCallback(() => {
    if (downloadIndicatorTimerRef.current) {
      window.clearTimeout(downloadIndicatorTimerRef.current);
      downloadIndicatorTimerRef.current = null;
    }
  }, []);

  const handleDownloadIndicatorClick = useCallback(() => {
    if (downloadIndicatorState === 'active') return;
    clearDownloadIndicatorTimer();
    setDownloadIndicatorState('hidden');
  }, [clearDownloadIndicatorTimer, downloadIndicatorState]);

  useEffect(() => {
    const fileMap = downloadFileMapRef.current;
    const handler = (event: CustomEvent<DownloadStatusDetail>) => {
      const detail = event.detail ?? {};
      const downloadId = typeof detail.id === 'string' && detail.id ? detail.id : null;
      if (downloadId && typeof detail.file === 'string' && detail.file) {
        fileMap.set(downloadId, detail.file);
      }
    };
    window.addEventListener('merezhyvo:download-status', handler as EventListener);
    return () => {
      window.removeEventListener('merezhyvo:download-status', handler as EventListener);
      fileMap.clear();
      if (downloadToastTimerRef.current) {
        window.clearTimeout(downloadToastTimerRef.current);
        downloadToastTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const activeSet = activeDownloadsRef.current;
    const handler = (event: CustomEvent<DownloadStateDetail>) => {
      const detail = event.detail ?? {};
      const targetId = typeof detail.id === 'string' && detail.id ? detail.id : '';
      const state = detail.state;
      if (!targetId || !state) return;
      const completedSet = completedDownloadsRef.current;
      const showFailureToast = () => {
        const stored = downloadFileMapRef.current.get(targetId) ?? '';
        const rawName = stored.split(/[\\/]/).pop() ?? stored;
        const fileName = rawName || 'Download';
        const text = `Download failed — ${fileName}`;
        if (downloadToastTimerRef.current) {
          window.clearTimeout(downloadToastTimerRef.current);
        }
        setDownloadToast(text);
        downloadToastTimerRef.current = window.setTimeout(() => {
          setDownloadToast(null);
          downloadToastTimerRef.current = null;
        }, 3200);
        downloadFileMapRef.current.delete(targetId);
      };
      if (state === 'downloading') {
        completedSet.delete(targetId);
      } else if (state === 'completed') {
        completedSet.add(targetId);
        downloadFileMapRef.current.delete(targetId);
      } else if (state === 'failed') {
        completedSet.delete(targetId);
      }
      if (state === 'downloading') {
        activeSet.add(targetId);
        clearDownloadIndicatorTimer();
        setDownloadIndicatorState('active');
        return;
      }
      if (state === 'completed' || state === 'failed') {
        activeSet.delete(targetId);
        if (activeSet.size > 0) return;
        clearDownloadIndicatorTimer();
        if (state === 'completed') {
          setDownloadIndicatorState('completed');
          downloadIndicatorTimerRef.current = window.setTimeout(() => {
            setDownloadIndicatorState('hidden');
            downloadIndicatorTimerRef.current = null;
          }, 10000);
        } else {
          showFailureToast();
          setDownloadIndicatorState('error');
        }
      }
    };

    const handleProgress = () => {
      if (activeSet.size > 0) {
        clearDownloadIndicatorTimer();
        setDownloadIndicatorState('active');
      }
    };

    window.addEventListener('merezhyvo:downloads:state', handler as EventListener);
    window.addEventListener('merezhyvo:downloads:progress', handleProgress as EventListener);
    return () => {
      window.removeEventListener('merezhyvo:downloads:state', handler as EventListener);
      window.removeEventListener('merezhyvo:downloads:progress', handleProgress as EventListener);
      clearDownloadIndicatorTimer();
      activeSet.clear();
      setDownloadIndicatorState('hidden');
    };
  }, [clearDownloadIndicatorTimer]);

  return {
    downloadIndicatorState,
    downloadToast,
    handleDownloadIndicatorClick
  };
};
