import type { CSSProperties } from 'react';

export type FileDialogStyleKeys =
  | 'overlay'
  | 'dialog'
  | 'header'
  | 'title'
  | 'subtitle'
  | 'pathRow'
  | 'pathText'
  | 'breadcrumb'
  | 'breadcrumbButton'
  | 'hiddenToggleRow'
  | 'hiddenToggleLabel'
  | 'hiddenToggleInput'
  | 'list'
  | 'entryRow'
  | 'entryName'
  | 'entryMeta'
  | 'footer'
  | 'button'
  | 'buttonPrimary'
  | 'buttonDisabled'
  | 'error'
  | 'loading'
  | 'fileInfo'
  | 'filterHint'
  | 'placeholder'
  | 'notice'
  | 'noticeText'
  | 'noticeCommand'
  | 'noticeCheckboxLabel'
  | 'noticeCheckboxInput'
  | 'noticeCommandRow'
  | 'noticeCopyButton';

export const fileDialogStyles: Record<FileDialogStyleKeys, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--mzr-overlay)',
    zIndex: 4000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px'
  },
  dialog: {
    width: 'min(640px, 100%)',
    height: '95%',
    maxHeight: 'min(90vh, 760px)',
    background: 'var(--mzr-surface-elevated)',
    border: '1px solid var(--mzr-border)',
    borderRadius: '18px',
    boxSizing: 'border-box',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  title: {
    margin: 0,
    fontSize: '24px'
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--mzr-text-muted)'
  },
  pathRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  pathText: {
    fontSize: '14px',
    color: 'var(--mzr-text-secondary)'
  },
  breadcrumb: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
  },
  breadcrumbButton: {
    background: 'transparent',
    border: 'none',
    color: '#3b82f6',
    cursor: 'pointer',
    padding: 0,
    fontSize: '14px'
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  entryRow: {
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid var(--mzr-divider)',
    background: 'var(--mzr-surface-weak)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer'
  },
  entryName: {
    fontSize: '15px'
  },
  entryMeta: {
    fontSize: '12px',
    color: 'var(--mzr-text-muted)'
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px'
  },
  button: {
    padding: '10px 18px',
    borderRadius: '10px',
    border: '1px solid var(--mzr-border)',
    background: 'var(--mzr-surface-weak)',
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer'
  },
  buttonPrimary: {
    borderColor: 'rgba(37, 99, 235, 0.8)',
    background: 'rgba(37, 99, 235, 0.65)',
    color: 'var(--mzr-text-primary)'
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  error: {
    color: '#f87171'
  },
  loading: {
    color: 'var(--mzr-text-muted)'
  },
  fileInfo: {
    fontSize: '14px',
    color: 'var(--mzr-text-primary)'
  },
  filterHint: {
    fontSize: '12px',
    color: 'var(--mzr-text-muted)'
  },
  placeholder: {
    color: 'var(--mzr-text-muted)'
  }
  ,
  notice: {
    background: 'var(--mzr-surface-weak)',
    border: '1px solid var(--mzr-border)',
    borderRadius: '14px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    color: 'var(--mzr-text-primary)'
  },
  noticeText: {
    fontSize: '14px',
    lineHeight: 1.6,
    color: 'var(--mzr-text-secondary)',
    margin: 0,
    whiteSpace: 'pre-wrap'
  },
  noticeCommand: {
    fontSize: '14px',
    fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
    background: 'rgba(255, 255, 255, 0.04)',
    borderRadius: '8px',
    padding: '6px 10px',
    margin: 0
  },
  noticeCheckboxLabel: {
    fontSize: '14px',
    color: 'var(--mzr-text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer'
  },
  noticeCheckboxInput: {
    width: '16px',
    height: '16px'
  }
  ,
  noticeCommandRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  noticeCopyButton: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.6)',
    background: 'rgba(59, 130, 246, 0.2)',
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer',
    fontSize: '14px'
  }
  ,
  hiddenToggleRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '10px'
  },
  hiddenToggleLabel: {
    fontSize: '12px',
    color: 'var(--mzr-text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  hiddenToggleInput: {
    marginRight: '6px'
  }
};
