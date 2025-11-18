'use strict';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import type {
  Mode,
  PasswordEntryMeta,
  PasswordImportMode,
  PasswordCsvRow,
  PasswordUpsertPayload
} from '../../types/models';
import { passwordsStyles } from './passwordsStyles';
import { requestFileDialog } from '../../services/fileDialog/fileDialogService';

type PasswordsPageProps = {
  mode: Mode;
  openInTab: (url: string) => void;
  openInNewTab: (url: string) => void;
};

type ModalMode = 'add' | 'edit';

const getSiteName = (origin: string): string => {
  try {
    const url = new URL(origin);
    return url.hostname || origin;
  } catch {
    return origin;
  }
};

const getRelativeTime = (timestamp?: number): string => {
  if (!timestamp) return 'Never used';
  const deltaSeconds = Math.round((Date.now() - timestamp) / 1000);
  if (deltaSeconds < 60) return 'Just now';
  if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)} minutes ago`;
  if (deltaSeconds < 86400) return `${Math.floor(deltaSeconds / 3600)} hours ago`;
  return `${Math.floor(deltaSeconds / 86400)} days ago`;
};

const groupEntries = (items: PasswordEntryMeta[]) => {
  const map = new Map<string, { siteName: string; signonRealm: string; entries: PasswordEntryMeta[] }>();
  items.forEach((entry) => {
    const key = entry.signonRealm;
    const siteName = getSiteName(entry.origin);
    const group = map.get(key);
    if (group) {
      group.entries.push(entry);
    } else {
      map.set(key, { siteName, signonRealm: key, entries: [entry] });
    }
  });
  return Array.from(map.values());
};

const copyFallback = (value: string): void => {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.readOnly = true;
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } catch {
    // noop
  }
  document.body.removeChild(textarea);
};

const mergeStyle = (...styles: Array<CSSProperties | undefined>) =>
  Object.assign({}, ...styles.filter(Boolean));

type CsvImportDialogState = {
  open: boolean;
  loading: boolean;
  total: number;
  valid: number;
  sample: PasswordCsvRow | null;
  mode: PasswordImportMode;
  content: string;
};

type ExportCsvDialogState = {
  open: boolean;
  loading: boolean;
  acknowledged: boolean;
};

type ImportEncryptedDialogState = {
  open: boolean;
  loading: boolean;
  mode: PasswordImportMode;
  password: string;
  content: string;
  error: string | null;
};

type ExportEncryptedDialogState = {
  open: boolean;
  loading: boolean;
  password: string;
};

const formatTimestampFilename = (suffix: string) => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `passwords-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.${suffix}`;
};

const PasswordsPage: React.FC<PasswordsPageProps> = ({ mode, openInTab }) => {
  const isMobile = mode === 'mobile';
  const [entries, setEntries] = useState<PasswordEntryMeta[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalBusy, setModalBusy] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<PasswordEntryMeta | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [importCsvDialog, setImportCsvDialog] = useState<CsvImportDialogState>({
    open: false,
    loading: false,
    total: 0,
    valid: 0,
    sample: null,
    mode: 'add',
    content: ''
  });
  const [exportCsvDialog, setExportCsvDialog] = useState<ExportCsvDialogState>({
    open: false,
    loading: false,
    acknowledged: false
  });
  const [importEncryptedDialog, setImportEncryptedDialog] = useState<ImportEncryptedDialogState>({
    open: false,
    loading: false,
    mode: 'add',
    password: '',
    content: '',
    error: null
  });
  const [exportEncryptedDialog, setExportEncryptedDialog] = useState<ExportEncryptedDialogState>({
    open: false,
    loading: false,
    password: ''
  });
  const [formValues, setFormValues] = useState({
    origin: '',
    username: '',
    password: '',
    notes: '',
    tags: ''
  });
  const toastTimer = useRef<number | null>(null);
  const clipboardTimer = useRef<number | null>(null);
  const overflowRef = useRef<HTMLDivElement | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});

  const showToast = (message: string): void => {
    setToast(message);
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 2000);
  };

  const showBanner = (message: string): void => {
    setBannerMessage(message);
  };

  const clearBanner = (): void => {
    setBannerMessage(null);
  };

  const clearClipboard = (): void => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      void navigator.clipboard.writeText('');
    }
  };

  const scheduleClipboardClear = (): void => {
    if (clipboardTimer.current) {
      window.clearTimeout(clipboardTimer.current);
    }
    clipboardTimer.current = window.setTimeout(() => {
      clearClipboard();
      clipboardTimer.current = null;
    }, 15000);
  };

  const copyToClipboard = async (value: string): Promise<void> => {
    if (!value) return;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(value);
        return;
      }
    } catch {
      copyFallback(value);
      return;
    }
    copyFallback(value);
  };

  const refreshEntries = useCallback(async () => {
    setLoading(true);
    const api = window.merezhyvo?.passwords;
    if (!api) {
      setLoading(false);
      return;
    }
    try {
      const items = await api.list();
      setEntries(items);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const pickFolder = async (title: string): Promise<string | null> => {
    const choice = await requestFileDialog({
      kind: 'folder',
      title,
      allowMultiple: false
    });
    return choice?.paths?.[0] ?? null;
  };

  const saveFileToFolder = async (folderPath: string, fileName: string, data: string): Promise<boolean> => {
    const normalizedFolder = folderPath.replace(/[/\\]+$/, '');
    const filePath = `${normalizedFolder}/${fileName}`;
    await window.merezhyvo?.fileDialog?.saveFile?.({
      path: filePath,
      data,
      encoding: 'utf8'
    });
    return true;
  };

  const handleImportCsvFile = async () => {
    clearBanner();
    const choice = await requestFileDialog({
      kind: 'file',
      title: 'Import passwords (CSV)',
      allowMultiple: false,
      filters: ['csv']
    });
    const path = choice?.paths?.[0];
    if (!path) return;
    try {
      const content = await window.merezhyvo?.fileDialog?.readFile?.({ path });
      if (typeof content !== 'string') {
        throw new Error('Unable to read file');
      }
      const preview = await window.merezhyvo?.passwords?.import.csv.preview(content);
      if (!preview) {
        throw new Error('Unable to preview CSV');
      }
      setImportCsvDialog({
        open: true,
        loading: false,
        total: preview.total,
        valid: preview.valid,
        sample: preview.sample,
        mode: 'add',
        content
      });
    } catch {
      showBanner("Couldn’t import this file. It doesn’t look like a passwords CSV.");
    }
  };

  const handleApplyImportCsv = async () => {
    if (!importCsvDialog.content) return;
    setImportCsvDialog((prev) => ({ ...prev, loading: true }));
    try {
      await window.merezhyvo?.passwords?.import.csv.apply(importCsvDialog.content, importCsvDialog.mode);
      clearBanner();
      clearBanner();
      showToast('Import completed');
      closeImportCsvDialog();
      void refreshEntries();
    } catch {
      showBanner("Couldn’t import this file. It doesn’t look like a passwords CSV.");
    } finally {
      setImportCsvDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const closeImportCsvDialog = () => {
    setImportCsvDialog({
      open: false,
      loading: false,
      total: 0,
      valid: 0,
      sample: null,
      mode: 'add',
      content: ''
    });
  };

  const setImportCsvMode = (mode: PasswordImportMode) => {
    setImportCsvDialog((prev) => ({ ...prev, mode }));
  };

  const handleExportCsvOpen = () => {
    clearBanner();
    setExportCsvDialog({ open: true, loading: false, acknowledged: false });
  };

  const handleExportCsvCancel = () => {
    setExportCsvDialog({ open: false, loading: false, acknowledged: false });
  };

  const handleExportCsvConfirm = async () => {
    if (!exportCsvDialog.acknowledged) return;
    setExportCsvDialog((prev) => ({ ...prev, loading: true }));
    try {
      const content = await window.merezhyvo?.passwords?.export.csv();
      if (typeof content !== 'string') throw new Error('Unable to export CSV');
      const folder = await pickFolder('Export passwords (CSV)');
      if (!folder) {
        setExportCsvDialog((prev) => ({ ...prev, loading: false }));
        return;
      }
      const fileName = formatTimestampFilename('csv');
      await saveFileToFolder(folder, fileName, content);
      clearBanner();
      showToast(`Exported to ${fileName}`);
      handleExportCsvCancel();
    } catch {
      showBanner('Couldn’t export CSV');
      setExportCsvDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleExportEncryptedOpen = () => {
    clearBanner();
    setExportEncryptedDialog({ open: true, loading: false, password: '' });
  };

  const handleExportEncryptedCancel = () => {
    setExportEncryptedDialog({ open: false, loading: false, password: '' });
  };

  const handleExportEncryptedConfirm = async () => {
    if (!exportEncryptedDialog.open) return;
    setExportEncryptedDialog((prev) => ({ ...prev, loading: true }));
    try {
      const result = await window.merezhyvo?.passwords?.export.mzrpass(
        exportEncryptedDialog.password || undefined
      );
      if (!result) throw new Error('Unable to export encrypted file');
      const folder = await pickFolder('Export passwords (Encrypted)');
      if (!folder) {
        setExportEncryptedDialog((prev) => ({ ...prev, loading: false }));
        return;
      }
      const content =
        typeof result.content === 'string'
          ? result.content
          : Buffer.isBuffer(result.content)
            ? result.content.toString('utf8')
            : String(result.content);
      await saveFileToFolder(folder, result.filenameSuggested, content);
      clearBanner();
      showToast(`Exported to ${result.filenameSuggested}`);
      handleExportEncryptedCancel();
    } catch {
      showBanner('Couldn’t export passwords securely');
      setExportEncryptedDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleImportEncryptedFile = async () => {
    clearBanner();
    const choice = await requestFileDialog({
      kind: 'file',
      title: 'Import passwords (Encrypted)',
      allowMultiple: false,
      filters: ['mzrpass']
    });
    const path = choice?.paths?.[0];
    if (!path) return;
    try {
      const content = await window.merezhyvo?.fileDialog?.readFile?.({ path });
      if (typeof content !== 'string') throw new Error('Unable to read file');
      setImportEncryptedDialog({
        open: true,
        loading: false,
        mode: 'add',
        password: '',
        content,
        error: null
      });
    } catch {
      showBanner('Couldn’t import this file. It does not look like a passwords backup.');
    }
  };

  const handleImportEncryptedMode = (mode: PasswordImportMode) => {
    setImportEncryptedDialog((prev) => ({ ...prev, mode }));
  };

  const handleImportEncryptedCancel = () => {
    setImportEncryptedDialog({
      open: false,
      loading: false,
      mode: 'add',
      password: '',
      content: '',
      error: null
    });
  };

  const handleApplyImportEncrypted = async () => {
    if (!importEncryptedDialog.content) return;
    setImportEncryptedDialog((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await window.merezhyvo?.passwords?.import.mzrpass.apply({
        content: importEncryptedDialog.content,
        mode: importEncryptedDialog.mode,
        password: importEncryptedDialog.password || undefined
      });
      showToast('Import completed');
      closeModal();
      handleImportEncryptedCancel();
      void refreshEntries();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Couldn’t import this file. It does not look like a passwords backup.';
      setImportEncryptedDialog((prev) => ({ ...prev, loading: false, error: message }));
    }
  };

  useEffect(() => {
    void refreshEntries();
  }, [refreshEntries]);

  useEffect(() => () => {
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }
    if (clipboardTimer.current) {
      window.clearTimeout(clipboardTimer.current);
    }
  }, []);

  useEffect(() => {
    const handler = (event: PointerEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(event.target as Node)) {
        setOverflowOpen(false);
      }
    };
    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, []);

  const query = search.trim().toLowerCase();
  const filteredEntries = useMemo(() => {
    if (!query) return entries;
    return entries.filter((item) => {
      const haystack = [
        item.origin,
        item.signonRealm,
        item.username,
        item.notes ?? '',
        ...(item.tags ?? [])
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [entries, query]);

  const groups = useMemo(() => groupEntries(filteredEntries), [filteredEntries]);
  const isEmpty = !loading && groups.length === 0;

  const handleSearchChange = (event: FormEvent<HTMLInputElement>) => {
    setSearch(event.currentTarget.value);
  };

  const handleCopyUsername = async (entry: PasswordEntryMeta) => {
    await copyToClipboard(entry.username);
    showToast('Username copied');
  };

  const handleCopyPassword = async (entry: PasswordEntryMeta) => {
    const api = window.merezhyvo?.passwords;
    if (!api) return;
    const status = await api.status();
    if (status.locked) {
      showToast('Unlock passwords to copy');
      return;
    }
    const result = await api.get(entry.id);
    if ('error' in result) {
      showToast('Unable to retrieve password');
      return;
    }
    await copyToClipboard(result.password);
    showToast('Password copied (clears in 15s)');
    scheduleClipboardClear();
  };

  const handleEditEntry = async (entry: PasswordEntryMeta) => {
    setModalMode('edit');
    setCurrentEntry(entry);
    setFormValues({
      origin: entry.signonRealm || entry.origin,
      username: entry.username,
      password: '',
      notes: entry.notes ?? '',
      tags: (entry.tags ?? []).join(', ')
    });
    setShowPassword(false);
    setModalOpen(true);
    const api = window.merezhyvo?.passwords;
    if (!api) return;
    try {
      const result = await api.get(entry.id);
      if (!('error' in result)) {
        setFormValues((prev) => ({ ...prev, password: result.password }));
      }
    } catch {
      showToast('Unable to load password');
    }
  };

  const openModal = (mode: ModalMode, entry?: PasswordEntryMeta) => {
    if (mode === 'add') {
      setModalMode('add');
      setCurrentEntry(null);
      setFormValues({ origin: '', username: '', password: '', notes: '', tags: '' });
      setShowPassword(false);
      setModalOpen(true);
      return;
    }
    if (entry) {
      void handleEditEntry(entry);
    }
  };

  const closeModal = () => {
    if (modalBusy) return;
    setModalOpen(false);
  };

  const handleFormChange = (field: keyof PasswordUpsertPayload | 'tags') => (event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.currentTarget.value;
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const parseTags = (value: string): string[] | undefined => {
    const list = value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return list.length ? Array.from(new Set(list)) : undefined;
  };

  const handleSave = async () => {
    const payload: PasswordUpsertPayload = {
      origin: formValues.origin.trim(),
      signonRealm: formValues.origin.trim(),
      username: formValues.username.trim(),
      password: formValues.password,
      notes: formValues.notes.trim() || undefined,
      tags: parseTags(formValues.tags)
    };
    if (!payload.origin || !payload.username || !payload.password) {
      showToast('Origin, username, and password are required');
      return;
    }
    const api = window.merezhyvo?.passwords;
    if (!api) return;
    setModalBusy(true);
    try {
      if (modalMode === 'add') {
        await api.add(payload);
        showToast('Password saved');
      } else if (currentEntry) {
        await api.update(currentEntry.id, payload);
        showToast('Password updated');
      }
      void refreshEntries();
      closeModal();
    } catch {
      showToast('Couldn’t save password');
    } finally {
      setModalBusy(false);
    }
  };

  const [confirmVisible, setConfirmVisible] = useState(false);

  const handleDelete = async () => {
    if (!currentEntry) return;
    const api = window.merezhyvo?.passwords;
    if (!api) return;
    setModalBusy(true);
    try {
      await api.remove(currentEntry.id);
      showToast('Password deleted');
      void refreshEntries();
      closeModal();
    } catch {
      showToast('Couldn’t delete password');
    } finally {
      setModalBusy(false);
      setConfirmVisible(false);
    }
  };

  const promptDelete = () => {
    setConfirmVisible(true);
  };

  const handleCopyPasswordModal = async () => {
    await copyToClipboard(formValues.password);
    showToast('Password copied (clears in 15s)');
    scheduleClipboardClear();
  };

  const handleLockNow = async () => {
    const api = window.merezhyvo?.passwords;
    if (!api) return;
    await api.lock();
    showToast('Passwords locked');
    setOverflowOpen(false);
  };

  const handleSettings = () => {
    showToast('Settings coming soon');
    setOverflowOpen(false);
  };

  const handleOverflowToggle = () => {
    setOverflowOpen((prev) => !prev);
  };

  const toggleEntry = (entryId: string) => {
    setExpandedEntryId((prev) => (prev === entryId ? null : entryId));
  };

  const handleRevealPassword = async (entry: PasswordEntryMeta) => {
    if (revealedPasswords[entry.id]) return;
    const api = window.merezhyvo?.passwords;
    if (!api) return;
    try {
      const result = await api.get(entry.id);
      if ('password' in result) {
        setRevealedPasswords((prev) => ({ ...prev, [entry.id]: result.password }));
      }
    } catch {
      showToast('Unable to load password');
    }
  };

  const handleRowOpen = (entry: PasswordEntryMeta) => {
    const target = entry.signonRealm || entry.origin;
    if (!target) {
      showToast('No URL available');
      return;
    }
    openInTab(target);
  };

  const handleCopyRowPassword = (entry: PasswordEntryMeta) => {
    void handleCopyPassword(entry);
  };

  const mappedGroups = groups.map((group) => ({
    ...group,
    entries: group.entries.sort((a, b) => b.lastUsedAt - a.lastUsedAt)
  }));

  const actionButtonStyle = mergeStyle(
    passwordsStyles.actionButton,
    isMobile ? passwordsStyles.actionButtonMobile : undefined
  );
  const overflowButtonStyle = mergeStyle(
    passwordsStyles.overflowButton,
    isMobile ? passwordsStyles.overflowButtonMobile : undefined
  );
  const searchInputStyle = mergeStyle(
    passwordsStyles.searchInput,
    isMobile ? passwordsStyles.searchInputMobile : undefined
  );
  const entryUsernameStyle = mergeStyle(
    passwordsStyles.entryUsername,
    isMobile ? passwordsStyles.entryUsernameMobile : undefined
  );
  const emptyTitleStyle = mergeStyle(
    passwordsStyles.emptyTitle,
    isMobile ? passwordsStyles.emptyTitleMobile : undefined
  );
  const modalStyle = mergeStyle(
    passwordsStyles.modal,
    isMobile ? passwordsStyles.modalMobile : undefined
  );
  const modalTitleStyle = mergeStyle(
    passwordsStyles.modalTitle,
    isMobile ? passwordsStyles.modalTitleMobile : undefined
  );
  const modalInputStyle = mergeStyle(
    passwordsStyles.modalInput,
    isMobile ? passwordsStyles.modalInputMobile : undefined
  );
  const primaryButtonStyle = mergeStyle(
    passwordsStyles.primaryButton,
    isMobile ? passwordsStyles.primaryButtonMobile : undefined
  );
  const entryActionButtonStyle = mergeStyle(
    passwordsStyles.entryActionButton,
    isMobile ? passwordsStyles.entryActionButtonMobile : undefined
  );
  const modalLabelStyle = mergeStyle(
    passwordsStyles.modalLabel,
    isMobile ? passwordsStyles.modalLabelMobile : undefined
  );
  const modalCloseStyle = mergeStyle(
    passwordsStyles.modalClose,
    isMobile ? passwordsStyles.modalCloseMobile : undefined
  );
  const modalActionsStyle = mergeStyle(
    passwordsStyles.modalActions,
    isMobile ? passwordsStyles.modalActionsMobile : undefined
  );
  const secondaryButtonStyle = mergeStyle(
    passwordsStyles.secondaryButton,
    isMobile ? passwordsStyles.secondaryButtonMobile : undefined
  );

  return (
    <div style={passwordsStyles.page}>
      <div style={passwordsStyles.header}>
        <h1
          style={mergeStyle(
            passwordsStyles.headerTitle,
            isMobile ? passwordsStyles.headerTitleMobile : undefined
          )}
        >
          Passwords
        </h1>
        <div style={passwordsStyles.headerActions}>
          <button
            type="button"
            style={actionButtonStyle}
            onClick={() => openModal('add')}
          >
            +
          </button>
          <button
            type="button"
            style={overflowButtonStyle}
            onClick={handleOverflowToggle}
          >
            ⋮
          </button>
          {overflowOpen && (
            <div ref={overflowRef} style={passwordsStyles.overflowMenu}>
              <div
                style={mergeStyle(
                  passwordsStyles.overflowItem,
                  isMobile ? passwordsStyles.overflowItemMobile : undefined
                )}
                onClick={() => {
                  setOverflowOpen(false);
                  void handleImportCsvFile();
                }}
              >
                Import (CSV)…
              </div>
              <div
                style={mergeStyle(
                  passwordsStyles.overflowItem,
                  isMobile ? passwordsStyles.overflowItemMobile : undefined
                )}
                onClick={() => {
                  setOverflowOpen(false);
                  void handleImportEncryptedFile();
                }}
              >
                Import (Encrypted)…
              </div>
              <div
                style={mergeStyle(
                  passwordsStyles.overflowItem,
                  isMobile ? passwordsStyles.overflowItemMobile : undefined
                )}
                onClick={() => {
                  setOverflowOpen(false);
                  handleExportCsvOpen();
                }}
              >
                Export (CSV)…
              </div>
              <div
                style={mergeStyle(
                  passwordsStyles.overflowItem,
                  isMobile ? passwordsStyles.overflowItemMobile : undefined
                )}
                onClick={() => {
                  setOverflowOpen(false);
                  handleExportEncryptedOpen();
                }}
              >
                Export (Encrypted)…
              </div>
              <div
                style={mergeStyle(
                  passwordsStyles.overflowItem,
                  isMobile ? passwordsStyles.overflowItemMobile : undefined
                )}
                onClick={handleLockNow}
              >
                Lock now
              </div>
              <div
                style={mergeStyle(
                  passwordsStyles.overflowItem,
                  isMobile ? passwordsStyles.overflowItemMobile : undefined
                )}
                onClick={handleSettings}
              >
                Settings…
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={passwordsStyles.searchBar}>
        <input
          type="text"
          placeholder="Search sites and usernames…"
          value={search}
          onChange={handleSearchChange}
          style={searchInputStyle}
        />
      </div>
      {bannerMessage && (
        <div
          style={mergeStyle(
            passwordsStyles.banner,
            isMobile ? passwordsStyles.bannerMobile : undefined
          )}
          role="status"
        >
          {bannerMessage}
        </div>
      )}
      <div style={passwordsStyles.list}>
        {loading ? (
          <div style={passwordsStyles.loading}>Loading passwords…</div>
        ) : isEmpty ? (
          <div style={passwordsStyles.emptyState}>
            <div style={emptyTitleStyle}>No passwords saved yet</div>
            <button
              type="button"
              style={passwordsStyles.emptyAction}
              onClick={() => openModal('add')}
            >
              Add password
            </button>
          </div>
        ) : (
          mappedGroups.map((group) => (
            <div key={group.signonRealm} style={passwordsStyles.group}>
              <div style={passwordsStyles.groupHeader}>
                <span style={passwordsStyles.groupTitle}>{group.siteName}</span>
                <span style={passwordsStyles.groupMeta}>{group.entries.length} accounts</span>
              </div>
              {group.entries.map((entry) => {
                const isExpanded = expandedEntryId === entry.id;
                const revealed = revealedPasswords[entry.id];
                return (
                  <div key={entry.id} style={passwordsStyles.entryRow}>
                    <div
                      style={mergeStyle(
                        passwordsStyles.entryHeader,
                        { fontSize: isMobile ? '38px' : '18px' }
                      )}
                      onClick={() => toggleEntry(entry.id)}
                    >
                      <span
                        style={mergeStyle(
                          passwordsStyles.entrySite,
                          isMobile ? passwordsStyles.entrySiteMobile : undefined
                        )}
                      >
                        {entry.signonRealm || entry.origin}
                      </span>
                      <span style={{ fontSize: isMobile ? '38px' : '24px', marginLeft: '12px' }}>
                        {isExpanded ? '⌃' : '⌄'}
                      </span>
                    </div>
                    {isExpanded && (
                      <div style={passwordsStyles.entryDetails}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px'
                          }}
                        >
                          <span
                            style={mergeStyle(
                              passwordsStyles.entryDetailText,
                              isMobile ? passwordsStyles.entryDetailTextMobile : undefined
                            )}
                          >
                            Username: {entry.username}
                          </span>
                          {revealed ? (
                            <span
                              style={mergeStyle(
                                passwordsStyles.entryDetailText,
                                isMobile ? passwordsStyles.entryDetailTextMobile : undefined
                              )}
                            >
                              Password: {revealed}
                            </span>
                          ) : (
                            <button
                              type="button"
                              style={entryActionButtonStyle}
                              onClick={() => handleRevealPassword(entry)}
                            >
                              Show password
                            </button>
                          )}
                        </div>
                        <div
                          style={mergeStyle(
                            passwordsStyles.entryActionsRow,
                            isMobile ? { flexDirection: 'column', gap: '10px' } : undefined
                          )}
                        >
                          <button
                            type="button"
                            style={entryActionButtonStyle}
                            onClick={() => handleRowOpen(entry)}
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            style={entryActionButtonStyle}
                            onClick={() => handleCopyUsername(entry)}
                          >
                            Copy username
                          </button>
                          <button
                            type="button"
                            style={entryActionButtonStyle}
                            onClick={() => handleCopyRowPassword(entry)}
                          >
                            Copy password
                          </button>
                          <button
                            type="button"
                            style={entryActionButtonStyle}
                            onClick={() => openModal('edit', entry)}
                          >
                            Edit
                          </button>
                        </div>
                        {(entry.notes || (entry.tags && entry.tags.length)) && (
                          <div
                            style={mergeStyle(
                              passwordsStyles.notes,
                              isMobile ? passwordsStyles.notesMobile : undefined
                            )}
                          >
                            {entry.notes}
                            {entry.tags && entry.tags.length ? ` · Tags: ${entry.tags.join(', ')}` : ''}
                          </div>
                        )}
                        <div
                          style={mergeStyle(
                            passwordsStyles.entryDetailText,
                            isMobile ? passwordsStyles.entryDetailTextMobile : undefined
                          )}
                        >
                          Last used {getRelativeTime(entry.lastUsedAt)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
          )}
      </div>
      {toast && <div style={passwordsStyles.toast}>{toast}</div>}

      {modalOpen && (
        <div style={passwordsStyles.modalOverlay} onClick={closeModal}>
        <div
          style={modalStyle}
          onClick={(event) => event.stopPropagation()}
        >
            <div style={passwordsStyles.modalHeader}>
              <h2 style={modalTitleStyle}>
                {modalMode === 'add' ? 'Add password' : 'Edit password'}
              </h2>
              <button
                type="button"
                aria-label="Close modal"
                style={modalCloseStyle}
                onClick={closeModal}
              >
                ✕
              </button>
            </div>
            <div style={passwordsStyles.modalForm}>
              <label style={modalLabelStyle}>Website</label>
                <input
                  type="text"
                  value={formValues.origin}
                  onChange={handleFormChange('origin')}
                  style={modalInputStyle}
                  placeholder="https://example.com"
                />
              <label style={modalLabelStyle}>Username</label>
              <input
                type="text"
                value={formValues.username}
                onChange={handleFormChange('username')}
                style={modalInputStyle}
              />
              <label style={modalLabelStyle}>Password</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formValues.password}
                  onChange={handleFormChange('password')}
                  style={modalInputStyle}
                />
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Hide' : 'Reveal'}
                </button>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={handleCopyPasswordModal}
                >
                  Copy
                </button>
              </div>
              <label style={modalLabelStyle}>Notes</label>
              <textarea
                value={formValues.notes}
                onChange={handleFormChange('notes')}
                style={{ ...modalInputStyle, ...passwordsStyles.modalTextarea }}
              />
              <label style={modalLabelStyle}>Tags (comma separated)</label>
              <input
                type="text"
                value={formValues.tags}
                onChange={handleFormChange('tags')}
                style={modalInputStyle}
              />
            <div style={modalActionsStyle}>
              {modalMode === 'edit' && (
                <button
                  type="button"
                  style={passwordsStyles.dangerButton}
                  onClick={promptDelete}
                  disabled={modalBusy}
                >
                  Delete
                  </button>
                )}
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={handleSave}
                  disabled={modalBusy}
                >
                  Save
                </button>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={closeModal}
                disabled={modalBusy}
              >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {importCsvDialog.open && (
        <div style={passwordsStyles.modalOverlay} onClick={closeImportCsvDialog}>
          <div
            style={{
              ...modalStyle,
              ...(isMobile ? { width: '90vw' } : {})
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={passwordsStyles.modalHeader}>
              <h2
                style={mergeStyle(
                  passwordsStyles.modalTitle,
                  isMobile ? { fontSize: '38px' } : undefined
                )}
              >
                Import passwords (CSV)
              </h2>
              <button
                type="button"
                aria-label="Close modal"
                style={passwordsStyles.modalClose}
                onClick={closeImportCsvDialog}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: isMobile ? '38px' : '14px' }}>
              Found {importCsvDialog.valid}/{importCsvDialog.total} valid rows
            </p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              {['add', 'replace'].map((modeOption) => (
                <button
                  key={modeOption}
                  type="button"
                  onClick={() => setImportCsvMode(modeOption as PasswordImportMode)}
                  style={mergeStyle(
                    secondaryButtonStyle,
                    {
                      fontSize: isMobile ? '34px' : '14px',
                      borderColor:
                        importCsvDialog.mode === modeOption ? '#2563eb' : 'rgba(148, 163, 184, 0.4)',
                      backgroundColor:
                        importCsvDialog.mode === modeOption ? 'rgba(59, 130, 246, 0.15)' : undefined
                    }
                  )}
                >
                  {modeOption === 'add' ? 'Add' : 'Replace all'}
                </button>
              ))}
            </div>
            {importCsvDialog.sample && (
              <div style={{ fontSize: isMobile ? '30px' : '14px', marginBottom: '12px' }}>
                Sample: {importCsvDialog.sample.username} · {importCsvDialog.sample.url}
              </div>
            )}
            <div style={modalActionsStyle}>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={closeImportCsvDialog}
                disabled={importCsvDialog.loading}
              >
                Cancel
              </button>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={handleApplyImportCsv}
                disabled={importCsvDialog.loading}
              >
                {importCsvDialog.loading ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
      {exportCsvDialog.open && (
        <div style={passwordsStyles.modalOverlay} onClick={handleExportCsvCancel}>
          <div
            style={{
              ...modalStyle,
              ...(isMobile ? { width: '90vw' } : {})
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={passwordsStyles.modalHeader}>
              <h2
                style={mergeStyle(
                  passwordsStyles.modalTitle,
                  isMobile ? { fontSize: '38px' } : undefined
                )}
              >
                Export CSV (plaintext)
              </h2>
              <button
                type="button"
                aria-label="Close modal"
                style={passwordsStyles.modalClose}
                onClick={handleExportCsvCancel}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: isMobile ? '38px' : '14px' }}>
              The CSV file includes your passwords in plaintext. Keep it secure.
            </p>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: isMobile ? '38px' : '14px',
                marginTop: '12px'
              }}
            >
              <input
                type="checkbox"
                checked={exportCsvDialog.acknowledged}
                onChange={(event) =>
                  setExportCsvDialog((prev) => ({ ...prev, acknowledged: event.target.checked }))
                }
                style={{ width: isMobile ? '35px' : '16px', height: isMobile ? '35px' : '16px' }}
              />
              I understand the risks
            </label>
            <div style={modalActionsStyle}>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={handleExportCsvCancel}
                disabled={exportCsvDialog.loading}
              >
                Cancel
              </button>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={handleExportCsvConfirm}
                disabled={!exportCsvDialog.acknowledged || exportCsvDialog.loading}
              >
                {exportCsvDialog.loading ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}
      {exportEncryptedDialog.open && (
        <div style={passwordsStyles.modalOverlay} onClick={handleExportEncryptedCancel}>
          <div
            style={{
              ...modalStyle,
              ...(isMobile ? { width: '90vw' } : {})
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={passwordsStyles.modalHeader}>
              <h2
                style={mergeStyle(
                  passwordsStyles.modalTitle,
                  isMobile ? { fontSize: '38px' } : undefined
                )}
              >
                Export (Encrypted)
              </h2>
              <button
                type="button"
                aria-label="Close modal"
                style={passwordsStyles.modalClose}
                onClick={handleExportEncryptedCancel}
              >
                ✕
              </button>
            </div>
            <label style={modalLabelStyle}>Set export password</label>
            <input
              type="password"
              value={exportEncryptedDialog.password}
              onChange={(event) =>
                setExportEncryptedDialog((prev) => ({ ...prev, password: event.target.value }))
              }
              style={mergeStyle(
                passwordsStyles.modalInput,
                isMobile ? { fontSize: '38px', padding: '16px 18px' } : undefined
              )}
              placeholder="Optional password"
            />
            <p style={{ fontSize: isMobile ? '38px' : '14px' }}>
              Leave blank to reuse the current master password.
            </p>
            <div style={modalActionsStyle}>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={handleExportEncryptedCancel}
                disabled={exportEncryptedDialog.loading}
              >
                Cancel
              </button>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={handleExportEncryptedConfirm}
                disabled={exportEncryptedDialog.loading}
              >
                {exportEncryptedDialog.loading ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}
      {importEncryptedDialog.open && (
        <div style={passwordsStyles.modalOverlay} onClick={handleImportEncryptedCancel}>
          <div
            style={{
              ...modalStyle,
              ...(isMobile ? { width: '90vw' } : {})
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={passwordsStyles.modalHeader}>
              <h2
                style={mergeStyle(
                  passwordsStyles.modalTitle,
                  isMobile ? { fontSize: '38px' } : undefined
                )}
              >
                Import passwords (Encrypted)
              </h2>
              <button
                type="button"
                aria-label="Close modal"
                style={passwordsStyles.modalClose}
                onClick={handleImportEncryptedCancel}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: isMobile ? '38px' : '14px' }}>
              Enter the password for the encrypted backup.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
              {['add', 'replace'].map((modeOption) => (
                <button
                  key={modeOption}
                  type="button"
                  onClick={() => handleImportEncryptedMode(modeOption as PasswordImportMode)}
                  style={mergeStyle(
                    secondaryButtonStyle,
                    {
                      fontSize: isMobile ? '34px' : '14px',
                      borderColor:
                        importEncryptedDialog.mode === modeOption
                          ? '#2563eb'
                          : 'rgba(148, 163, 184, 0.4)',
                      backgroundColor:
                        importEncryptedDialog.mode === modeOption
                          ? 'rgba(59, 130, 246, 0.15)'
                          : undefined
                    }
                  )}
                >
                  {modeOption === 'add' ? 'Add' : 'Replace all'}
                </button>
              ))}
            </div>
            <label style={modalLabelStyle}>Password</label>
            <input
              type="password"
              value={importEncryptedDialog.password}
              onChange={(event) =>
                setImportEncryptedDialog((prev) => ({ ...prev, password: event.target.value }))
              }
              style={mergeStyle(
                passwordsStyles.modalInput,
                isMobile ? { fontSize: '38px', padding: '16px 18px' } : undefined
              )}
            />
            {importEncryptedDialog.error && (
              <div style={{ color: '#f87171', fontSize: isMobile ? '38px' : '14px' }}>
                {importEncryptedDialog.error}
              </div>
            )}
            <div style={modalActionsStyle}>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={handleImportEncryptedCancel}
                disabled={importEncryptedDialog.loading}
              >
                Cancel
              </button>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={handleApplyImportEncrypted}
                disabled={importEncryptedDialog.loading}
              >
                {importEncryptedDialog.loading ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmVisible && (
        <div style={passwordsStyles.confirmOverlay} onClick={() => setConfirmVisible(false)}>
          <div style={passwordsStyles.confirmBox} onClick={(event) => event.stopPropagation()}>
            <div style={passwordsStyles.confirmTitle}>Delete password?</div>
            <div>Are you sure you want to delete this entry? This cannot be undone.</div>
            <div style={passwordsStyles.confirmActions}>
              <button
                type="button"
                style={passwordsStyles.secondaryButton}
                onClick={() => setConfirmVisible(false)}
                disabled={modalBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                style={passwordsStyles.dangerButton}
                onClick={handleDelete}
                disabled={modalBusy}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PasswordsPage;
