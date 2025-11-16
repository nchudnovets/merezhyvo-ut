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
  | 'placeholder';

export const fileDialogStyles: Record<FileDialogStyleKeys, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(3, 7, 18, 0.75)',
    zIndex: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '18px'
  },
  dialog: {
    width: 'min(640px, 100%)',
    maxHeight: 'min(90vh, 760px)',
    background: '#0f1729',
    border: '1px solid rgba(148, 163, 184, 0.4)',
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
    color: '#94a3b8'
  },
  pathRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  pathText: {
    fontSize: '14px',
    color: '#cbd5f5'
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
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(15, 23, 42, 0.85)',
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
    color: '#94a3b8'
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px'
  },
  button: {
    padding: '10px 18px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.4)',
    background: 'rgba(24, 37, 66, 0.8)',
    color: '#f8fafc',
    cursor: 'pointer'
  },
  buttonPrimary: {
    borderColor: 'rgba(37, 99, 235, 0.8)',
    background: 'rgba(37, 99, 235, 0.65)',
    color: '#f8fafc'
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  error: {
    color: '#f87171'
  },
  loading: {
    color: '#94a3b8'
  },
  fileInfo: {
    fontSize: '14px',
    color: '#f8fafc'
  },
  filterHint: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  placeholder: {
    color: '#94a3b8'
  }
};
