import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  FileDialogEntry,
  FileDialogListing,
  FileDialogOptions,
  FileDialogRequestDetail,
  FileDialogResult,
  Mode
} from '../../types/models';
import { useI18n } from '../../i18n/I18nProvider';
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

const FileDialogHost: React.FC<{ mode: Mode; onCopyCommand?: () => void }> = ({ mode, onCopyCommand }) => {
  const styles = fileDialogStyles;
  const modeStyles = fileDialogModeStyles[mode] || {};
  const { t } = useI18n();
  const [request, setRequest] = useState<FileDialogRequestDetail | null>(null);
  const [listing, setListing] = useState<FileDialogListing | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [hideDialogNotice, setHideDialogNotice] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    const loadUiState = async () => {
      try {
        const uiState = await window.merezhyvo?.ui?.get?.();
        if (cancelled) return;
        if (uiState && typeof uiState.hideFileDialogNote === 'boolean') {
          setHideDialogNotice(uiState.hideFileDialogNote);
        }
      } catch {
        // noop
      }
    };
    void loadUiState();
    return () => {
      cancelled = true;
    };
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
        setError(
          err instanceof Error && err.message
            ? err.message
            : t('fileDialog.error.read')
        );
      } finally {
        setLoading(false);
      }
    },
    [request, t]
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
    window.merezhyvo?.fileDialog?.respond?.({
      requestId: request.id,
      paths: result?.paths ?? null
    });
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
  const documentsCommand = window.merezhyvo?.paths?.documentsSymlinkCommand ?? '';

  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.dialog, ...(modeStyles.dialog ?? {}) }} className="service-scroll">
        <div style={{ ...styles.header, ...(modeStyles.header ?? {}) }}>
          <h2 style={{ ...styles.title, ...(modeStyles.title ?? {}) }}>
            {request.options.title || (isFileMode ? t('fileDialog.title.file') : t('fileDialog.title.folder'))}
          </h2>
          <p style={{ ...styles.subtitle, ...(modeStyles.subtitle ?? {}) }}>
            {request.options.allowMultiple ? t('fileDialog.subtitle.multiple') : t('fileDialog.subtitle.single')}
          </p>
          {request.options.filters && request.options.filters.length > 0 && (
            <p style={{ ...styles.filterHint, ...(modeStyles.filterHint ?? {}) }}>
              {t('fileDialog.filters', { filters: request.options.filters.join(', ') })}
            </p>
          )}
          {!hideDialogNotice && (
            <div style={{ ...styles.notice, ...(modeStyles.notice ?? {}) }}>
              <p style={{ ...styles.noticeText, ...(modeStyles.noticeText ?? {}) }}>
                {t('fileDialog.notice')}
              </p>
              <div style={{ ...styles.noticeCommandRow, ...(modeStyles.noticeCommandRow ?? {}) }}>
                <p style={{ ...styles.noticeCommand, ...(modeStyles.noticeCommand ?? {}) }}>
                  {documentsCommand}
                </p>
                <button
                  type="button"
                  style={{ ...styles.noticeCopyButton, ...(modeStyles.noticeCopyButton ?? {}) }}
                  onClick={() => {
                    if (typeof onCopyCommand === 'function') {
                      onCopyCommand();
                    }
                  }}
                  disabled={!documentsCommand}
                >
                  {t('fileDialog.copyCommand')}
                </button>
              </div>
              <label
                style={{ ...styles.noticeCheckboxLabel, ...(modeStyles.noticeCheckboxLabel ?? {}) }}
              >
                <input
                  type="checkbox"
                  onChange={async (event) => {
                    const next = event.target.checked;
                    setHideDialogNotice(next);
                    try {
                      await window.merezhyvo?.ui?.set?.({ hideFileDialogNote: next });
                    } catch {
                      // noop
                    }
                  }}
                  style={{ ...styles.noticeCheckboxInput, ...(modeStyles.noticeCheckboxInput ?? {}) }}
                />
                {t('fileDialog.notice.hide')}
              </label>
            </div>
          )}
          <div style={{ ...styles.hiddenToggleRow, ...(modeStyles.hiddenToggleRow ?? {}) }}>
            <label style={{ ...styles.hiddenToggleLabel, ...(modeStyles.hiddenToggleLabel ?? {}) }}>
              <input
                  type="checkbox"
                  checked={showHidden}
                  onChange={(event) => setShowHidden(event.target.checked)}
                  style={{ ...styles.hiddenToggleInput, ...(modeStyles.hiddenToggleInput ?? {}) }}
                />
                {t('fileDialog.showHidden')}
              </label>
            </div>
            <div style={styles.breadcrumb}>
            {breadcrumbs.map((pathSegment, idx) => (
              <button
                key={pathSegment + idx}
                type="button"
                style={{ ...styles.breadcrumbButton, ...(modeStyles.breadcrumbButton ?? {}) }}
                onClick={() => navigateTo(pathSegment)}
              >
                {pathSegment === '/' ? '/' : pathSegment.split('/').pop() + ' / '}
              </button>
            ))}
          </div>
        </div>
        <div style={{ ...styles.list, ...(modeStyles.list ?? {}) }}>
          {loading && <span style={styles.loading}>{t('fileDialog.loading')}</span>}
          {error && <span style={{ ...styles.error, ...(modeStyles.error ?? {}) }}>{error}</span>}
          {!loading && listing && listing.entries.length === 0 && (
            <span style={styles.placeholder}>{t('fileDialog.empty')}</span>
          )}
          {listing?.entries
            .filter((entry) => showHidden || !entry.name.startsWith('.'))
            .map((entry) => {
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
                  {entry.isDirectory ? t('fileDialog.type.folder') : t('fileDialog.type.file')}
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
            {t('fileDialog.cancel')}
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
            {t('fileDialog.choose')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileDialogHost;
