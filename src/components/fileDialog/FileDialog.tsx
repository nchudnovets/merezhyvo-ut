import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  FileDialogEntry,
  FileDialogListing,
  FileDialogOptions,
  FileDialogRequestDetail,
  FileDialogResult,
  Mode
} from '../../types/models';
import { fileDialogStyles } from './fileDialogStyles';
import { fileDialogModeStyles } from './fileDialogModeStyles';
import {
  createExternalRequest,
  dispatchExternalFileDialog,
  onFileDialogRequest,
  resolveFileDialogRequest
} from '../../services/fileDialog/fileDialogService';

const baseBreadcrumb = (path: string): string[] => {
  const parts = path.split('/').filter((segment) => segment.length > 0);
  const result: string[] = [];
  let accum = path.startsWith('/') ? '/' : '';
  result.push(accum || '/');
  for (const part of parts) {
    if (part === '') continue;
    accum = accum === '/' ? `/${part}` : `${accum}/${part}`;
    result.push(accum);
  }
  return result;
};

const FileDialogHost: React.FC<{ mode: Mode }> = ({ mode }) => {
  const styles = fileDialogStyles;
  const modeStyles = fileDialogModeStyles[mode] || {};
  const [request, setRequest] = useState<FileDialogRequestDetail | null>(null);
  const [listing, setListing] = useState<FileDialogListing | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestRef = useRef<FileDialogRequestDetail | null>(null);

  useEffect(() => {
    const unsubscribe = onFileDialogRequest((detail) => {
      if (requestRef.current) return;
      setRequest(detail);
      requestRef.current = detail;
      setListing(null);
      setSelected([]);
      setError(null);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const api = window.merezhyvo?.fileDialog;
    if (!api?.onRequest) return undefined;
    const undo = api.onRequest((payload) => {
      if (!payload?.requestId || !payload.options) return;
      dispatchExternalFileDialog(createExternalRequest(payload.options as FileDialogOptions, payload.requestId));
    });
    return undo;
  }, []);

  const loadDirectory = useCallback(
    async (target?: string) => {
      if (!request) return;
      setLoading(true);
      try {
        const data = await window.merezhyvo?.fileDialog?.list?.({
          path: target ?? request.options.initialPath,
          filters: request.options.filters
        });
        if (data) {
          setListing(data);
          setCurrentPath(data.path);
          setSelected([]);
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to read directory');
      } finally {
        setLoading(false);
      }
    },
    [request]
  );

  useEffect(() => {
    if (!request) return;
    void loadDirectory();
  }, [request, loadDirectory]);

  const navigateTo = (path: string) => {
    void loadDirectory(path);
  };

  const handleEntryClick = (entry: FileDialogEntry) => {
    if (entry.isDirectory) {
      void loadDirectory(entry.path);
      return;
    }
    if (!request) return;
    if (request.options.allowMultiple) {
      setSelected((prev) => {
        const next = [...prev];
        const idx = next.indexOf(entry.path);
        if (idx >= 0) {
          next.splice(idx, 1);
        } else {
          next.push(entry.path);
        }
        return next;
      });
    } else {
      setSelected([entry.path]);
    }
  };

  const resolve = (result: FileDialogResult | null) => {
    if (!request) return;
    resolveFileDialogRequest(request.id, result);
    if (request.source === 'external') {
      window.merezhyvo?.fileDialog?.respond?.({
        requestId: request.id,
        paths: result?.paths ?? null
      });
    }
    setRequest(null);
    requestRef.current = null;
    setListing(null);
    setSelected([]);
  };

  const handleCancel = () => resolve(null);

  const handleConfirm = () => {
    if (!request) return;
    if (request.options.kind === 'folder') {
      if (!currentPath) return;
      resolve({ paths: [currentPath] });
      return;
    }
    if (!selected.length) return;
    resolve({ paths: selected });
  };

  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [];
    return baseBreadcrumb(currentPath);
  }, [currentPath]);

  const isFileMode = request?.options.kind === 'file';
  const confirmDisabled = Boolean(
    !request || (isFileMode ? selected.length === 0 : !currentPath)
  );
  if (!request) return null;

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.dialog, ...(modeStyles.dialog ?? {}) }} className="service-scroll">
        <div style={{ ...styles.header, ...(modeStyles.header ?? {}) }}>
          <h2 style={{ ...styles.title, ...(modeStyles.title ?? {}) }}>
            {request.options.title || (isFileMode ? 'Select file' : 'Choose folder')}
          </h2>
          <p style={{ ...styles.subtitle, ...(modeStyles.subtitle ?? {}) }}>
            {request.options.allowMultiple ? 'Multiple selection allowed' : 'Single selection'}
          </p>
          {request.options.filters && request.options.filters.length > 0 && (
            <p style={{ ...styles.filterHint, ...(modeStyles.filterHint ?? {}) }}>
              Filters: {request.options.filters.join(', ')}
            </p>
          )}
          <div style={styles.pathRow}>
            <span style={{ ...styles.pathText, ...(modeStyles.pathText ?? {}) }}>{currentPath || 'Loading…'}</span>
          </div>
          <div style={styles.breadcrumb}>
            {breadcrumbs.map((pathSegment, idx) => (
              <button
                key={pathSegment + idx}
                type="button"
                style={{ ...styles.breadcrumbButton, ...(modeStyles.breadcrumbButton ?? {}) }}
                onClick={() => navigateTo(pathSegment)}
              >
                {pathSegment === '/' ? '/' : pathSegment.split('/').pop()}
              </button>
            ))}
          </div>
        </div>
        <div style={{ ...styles.list, ...(modeStyles.list ?? {}) }}>
          {loading && <span style={styles.loading}>Loading…</span>}
          {error && <span style={{ ...styles.error, ...(modeStyles.error ?? {}) }}>{error}</span>}
          {!loading && listing && listing.entries.length === 0 && (
            <span style={styles.placeholder}>No items found</span>
          )}
          {listing?.entries.map((entry) => {
            const isSelected = selected.includes(entry.path);
            return (
              <div
                key={entry.path}
                role="button"
                tabIndex={0}
                style={{
                  ...styles.entryRow,
                  ...(modeStyles.entryRow ?? {}),
                  ...(isSelected ? { borderColor: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)' } : {})
                }}
                onClick={() => handleEntryClick(entry)}
              >
                <span style={{ ...styles.entryName, ...(modeStyles.entryName ?? {}) }}>{entry.name}</span>
                <span style={{ ...styles.entryMeta, ...(modeStyles.entryMeta ?? {}) }}>
                  {entry.isDirectory ? 'Folder' : 'File'}
                </span>
              </div>
            );
          })}
        </div>
        <div style={styles.footer}>
          <button
            type="button"
            style={{ ...styles.button, ...(modeStyles.button ?? {}) }}
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            style={{
              ...styles.button,
              ...styles.buttonPrimary,
              ...(modeStyles.buttonPrimary ?? {}),
              ...(confirmDisabled ? styles.buttonDisabled : {})
            }}
            disabled={confirmDisabled}
            onClick={handleConfirm}
          >
            Choose
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileDialogHost;
