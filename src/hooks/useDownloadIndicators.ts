import { useCallback, useEffect, useRef, useState } from 'react';

export type DownloadIndicatorState = 'hidden' | 'active' | 'completed' | 'error';

export type DownloadIndicatorProgress = {
  percent: number | null;
  fraction: number | null;
  indeterminate: boolean;
  activeCount: number;
};

type DownloadStatusDetail = {
  id?: string;
  status: 'started' | 'completed' | 'failed';
  file?: string;
};

type DownloadStateDetail = {
  id?: string;
  state?: 'queued' | 'downloading' | 'completed' | 'failed';
};

type DownloadProgressDetail = {
  id?: string;
  received?: number;
  total?: number;
};

export const useDownloadIndicators = () => {
  const [downloadIndicatorState, setDownloadIndicatorState] =
    useState<DownloadIndicatorState>('hidden');
  const [downloadIndicatorProgress, setDownloadIndicatorProgress] = useState<DownloadIndicatorProgress>({
    percent: null,
    fraction: null,
    indeterminate: false,
    activeCount: 0
  });
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const downloadToastTimerRef = useRef<number | null>(null);
  const downloadFileMapRef = useRef<Map<string, string>>(new Map());
  const downloadStatesRef = useRef<Map<string, 'queued' | 'downloading' | 'completed' | 'failed'>>(new Map());
  const downloadProgressMapRef = useRef<Map<string, { received: number; total: number }>>(new Map());
  const batchHasFailureRef = useRef<boolean>(false);
  const downloadIndicatorTimerRef = useRef<number | null>(null);
  const completionSettleTimerRef = useRef<number | null>(null);

  const clearDownloadIndicatorTimer = useCallback(() => {
    if (downloadIndicatorTimerRef.current) {
      window.clearTimeout(downloadIndicatorTimerRef.current);
      downloadIndicatorTimerRef.current = null;
    }
  }, []);
  const clearCompletionSettleTimer = useCallback(() => {
    if (completionSettleTimerRef.current) {
      window.clearTimeout(completionSettleTimerRef.current);
      completionSettleTimerRef.current = null;
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
    const stateMap = downloadStatesRef.current;
    const progressMap = downloadProgressMapRef.current;
    const getActiveIds = (): string[] =>
      Array.from(stateMap.entries())
        .filter(([, state]) => state === 'queued' || state === 'downloading')
        .map(([id]) => id);
    const updateAggregatedProgress = (): number => {
      const activeIds = getActiveIds();
      if (activeIds.length === 0) {
        setDownloadIndicatorProgress({ percent: null, fraction: null, indeterminate: false, activeCount: 0 });
        return 0;
      }
      let totalReceived = 0;
      let totalExpected = 0;
      let hasUnknownTotal = false;
      for (const id of activeIds) {
        const progress = progressMap.get(id);
        const received = progress?.received ?? 0;
        const total = progress?.total ?? 0;
        totalReceived += Math.max(0, received);
        if (total > 0) {
          totalExpected += total;
        } else {
          hasUnknownTotal = true;
        }
      }
      const fraction =
        !hasUnknownTotal && totalExpected > 0 ? Math.max(0, Math.min(1, totalReceived / totalExpected)) : null;
      const percent = fraction != null ? Math.max(0, Math.min(100, Math.round(fraction * 100))) : null;
      setDownloadIndicatorProgress({
        percent,
        fraction,
        indeterminate: percent === null,
        activeCount: activeIds.length
      });
      return activeIds.length;
    };

    const handler = (event: CustomEvent<DownloadStateDetail>) => {
      const detail = event.detail ?? {};
      const targetId = typeof detail.id === 'string' && detail.id ? detail.id : '';
      const state = detail.state;
      if (!targetId || !state) return;

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

      const previousActiveCount = getActiveIds().length;
      stateMap.set(targetId, state);
      if (state === 'queued' || state === 'downloading') {
        if (previousActiveCount === 0) {
          batchHasFailureRef.current = false;
        }
        clearCompletionSettleTimer();
        clearDownloadIndicatorTimer();
        setDownloadIndicatorState('active');
        updateAggregatedProgress();
        return;
      }

      if (state === 'completed' || state === 'failed') {
        progressMap.delete(targetId);
        if (state === 'completed') {
          downloadFileMapRef.current.delete(targetId);
        }
        if (state === 'failed') {
          batchHasFailureRef.current = true;
          showFailureToast();
        }

        const remainingActive = updateAggregatedProgress();
        if (remainingActive > 0) return;

        clearCompletionSettleTimer();
        if (!batchHasFailureRef.current) {
          completionSettleTimerRef.current = window.setTimeout(() => {
            completionSettleTimerRef.current = null;
            if (updateAggregatedProgress() > 0) return;
            clearDownloadIndicatorTimer();
            setDownloadIndicatorState('completed');
            downloadIndicatorTimerRef.current = window.setTimeout(() => {
              setDownloadIndicatorState('hidden');
              downloadIndicatorTimerRef.current = null;
            }, 10000);
          }, 350);
        } else {
          clearDownloadIndicatorTimer();
          setDownloadIndicatorState('error');
        }
      }
    };

    const handleProgress = (event: CustomEvent<DownloadProgressDetail>) => {
      const detail = event.detail ?? {};
      const targetId = typeof detail.id === 'string' && detail.id ? detail.id : '';
      if (!targetId) return;
      const received =
        typeof detail.received === 'number' && Number.isFinite(detail.received) && detail.received >= 0
          ? detail.received
          : 0;
      const total =
        typeof detail.total === 'number' && Number.isFinite(detail.total) && detail.total > 0
          ? detail.total
          : 0;
      progressMap.set(targetId, { received, total });
      const current = stateMap.get(targetId);
      if (!current || current === 'queued') {
        stateMap.set(targetId, 'downloading');
      }
      const activeCount = updateAggregatedProgress();
      if (activeCount <= 0) return;
      clearCompletionSettleTimer();
      clearDownloadIndicatorTimer();
      setDownloadIndicatorState('active');
    };

    window.addEventListener('merezhyvo:downloads:state', handler as EventListener);
    window.addEventListener('merezhyvo:downloads:progress', handleProgress as EventListener);
    return () => {
      window.removeEventListener('merezhyvo:downloads:state', handler as EventListener);
      window.removeEventListener('merezhyvo:downloads:progress', handleProgress as EventListener);
      clearCompletionSettleTimer();
      clearDownloadIndicatorTimer();
      stateMap.clear();
      progressMap.clear();
      batchHasFailureRef.current = false;
      setDownloadIndicatorProgress({ percent: null, fraction: null, indeterminate: false, activeCount: 0 });
      setDownloadIndicatorState('hidden');
    };
  }, [clearCompletionSettleTimer, clearDownloadIndicatorTimer]);

  return {
    downloadIndicatorState,
    downloadIndicatorProgress,
    downloadToast,
    handleDownloadIndicatorClick
  };
};
