import { useCallback, useEffect, useRef, useState } from 'react';

export type DownloadIndicatorState = 'hidden' | 'active' | 'completed' | 'error';
export type DownloadIndicatorModel = {
  state: DownloadIndicatorState;
  activeCount: number;
  failedCount: number;
  percent: number | null;
  indeterminate: boolean;
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

type TrackedDownloadState = 'queued' | 'downloading' | 'completed' | 'failed';
type TrackedDownload = {
  state: TrackedDownloadState;
  received: number;
  total: number;
};

const HIDDEN_INDICATOR: DownloadIndicatorModel = {
  state: 'hidden',
  activeCount: 0,
  failedCount: 0,
  percent: null,
  indeterminate: false
};

const normalizeBytes = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return value;
};

const buildIndicatorModel = (entries: Iterable<TrackedDownload>): DownloadIndicatorModel => {
  const list = [...entries];
  if (list.length === 0) return HIDDEN_INDICATOR;

  const active = list.filter((entry) => entry.state === 'queued' || entry.state === 'downloading');
  const failedCount = list.filter((entry) => entry.state === 'failed').length;
  if (active.length > 0) {
    const hasUnknownTotals = active.some((entry) => entry.total <= 0);
    if (hasUnknownTotals) {
      return {
        state: 'active',
        activeCount: active.length,
        failedCount,
        percent: null,
        indeterminate: true
      };
    }
    const totalBytes = active.reduce((sum, entry) => sum + entry.total, 0);
    const receivedBytes = active.reduce((sum, entry) => sum + Math.min(entry.received, entry.total), 0);
    const rawPercent = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0;
    const percent = Math.max(0, Math.min(100, rawPercent));
    return {
      state: 'active',
      activeCount: active.length,
      failedCount,
      percent,
      indeterminate: false
    };
  }
  if (failedCount > 0) {
    return {
      state: 'error',
      activeCount: 0,
      failedCount,
      percent: null,
      indeterminate: false
    };
  }
  return {
    state: 'completed',
    activeCount: 0,
    failedCount: 0,
    percent: 100,
    indeterminate: false
  };
};

export const useDownloadIndicators = () => {
  const [downloadIndicator, setDownloadIndicator] =
    useState<DownloadIndicatorModel>(HIDDEN_INDICATOR);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const downloadToastTimerRef = useRef<number | null>(null);
  const downloadsRef = useRef<Map<string, TrackedDownload>>(new Map());
  const downloadFileMapRef = useRef<Map<string, string>>(new Map());
  const resetTimerRef = useRef<number | null>(null);

  const clearResetTimer = useCallback(() => {
    if (!resetTimerRef.current) return;
    window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
  }, []);

  const syncIndicator = useCallback(() => {
    const next = buildIndicatorModel(downloadsRef.current.values());
    setDownloadIndicator(next);
    if (next.state === 'completed' || next.state === 'error') {
      clearResetTimer();
      resetTimerRef.current = window.setTimeout(() => {
        downloadsRef.current.clear();
        setDownloadIndicator(HIDDEN_INDICATOR);
        resetTimerRef.current = null;
      }, 10000);
      return;
    }
    clearResetTimer();
  }, [clearResetTimer]);

  const showFailureToast = useCallback((downloadId: string) => {
    const stored = downloadFileMapRef.current.get(downloadId) ?? '';
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
    downloadFileMapRef.current.delete(downloadId);
  }, []);

  const handleDownloadIndicatorClick = useCallback(() => {
    if (downloadIndicator.state === 'active') return;
    downloadsRef.current.clear();
    clearResetTimer();
    setDownloadIndicator(HIDDEN_INDICATOR);
  }, [clearResetTimer, downloadIndicator.state]);

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
    const downloads = downloadsRef.current;
    const handler = (event: CustomEvent<DownloadStateDetail>) => {
      const detail = event.detail ?? {};
      const targetId = typeof detail.id === 'string' && detail.id ? detail.id : '';
      const state = detail.state;
      if (!targetId || !state) return;
      const existing = downloads.get(targetId);
      const next: TrackedDownload = {
        state,
        received: existing?.received ?? 0,
        total: existing?.total ?? 0
      };
      if (state === 'completed' && next.total > 0) {
        next.received = Math.max(next.received, next.total);
      }
      downloads.set(targetId, next);
      if (state === 'completed') {
        downloadFileMapRef.current.delete(targetId);
      } else if (state === 'failed') {
        showFailureToast(targetId);
      }
      syncIndicator();
    };

    const handleProgress = (event: CustomEvent<DownloadProgressDetail>) => {
      const detail = event.detail ?? {};
      const targetId = typeof detail.id === 'string' && detail.id ? detail.id : '';
      if (!targetId) return;
      const existing = downloads.get(targetId);
      const received = normalizeBytes(detail.received);
      const total = normalizeBytes(detail.total);
      downloads.set(targetId, {
        state:
          existing?.state === 'completed' || existing?.state === 'failed'
            ? existing.state
            : 'downloading',
        received: Math.max(existing?.received ?? 0, received),
        total: total > 0 ? total : existing?.total ?? 0
      });
      syncIndicator();
    };

    window.addEventListener('merezhyvo:downloads:state', handler as EventListener);
    window.addEventListener('merezhyvo:downloads:progress', handleProgress as EventListener);
    return () => {
      window.removeEventListener('merezhyvo:downloads:state', handler as EventListener);
      window.removeEventListener('merezhyvo:downloads:progress', handleProgress as EventListener);
      clearResetTimer();
      downloads.clear();
      setDownloadIndicator(HIDDEN_INDICATOR);
    };
  }, [clearResetTimer, showFailureToast, syncIndicator]);

  return {
    downloadIndicator,
    downloadToast,
    handleDownloadIndicatorClick
  };
};
