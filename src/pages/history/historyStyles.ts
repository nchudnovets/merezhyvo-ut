import type { CSSProperties } from 'react';

export type HistoryStyleKeys =
  | 'container'
  | 'header'
  | 'headerTitle'
  | 'title'
  | 'button'
  | 'searchField'
  | 'searchIcon'
  | 'searchInput'
  | 'searchClear'
  | 'feedback'
  | 'groups'
  | 'group'
  | 'groupHeader'
  | 'groupTitle'
  | 'groupCount'
  | 'entry'
  | 'entryMain'
  | 'entryText'
  | 'entryTitle'
  | 'entryUrl'
  | 'entryMeta'
  | 'entryDot'
  | 'entryActions'
  | 'actionToggle'
  | 'actionButton'
  | 'favicon'
  | 'emptyState'
  | 'emptyIcon'
  | 'emptyTitle'
  | 'placeholder'
  | 'confirmBackdrop'
  | 'confirmPanel'
  | 'confirmTitle'
  | 'confirmMessage'
  | 'confirmActions'
  | 'confirmButton';

export const historyStyles: Record<HistoryStyleKeys, CSSProperties> = {
  container: {
    color: 'var(--mzr-text-primary)',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    gap: '16px',
    overflowX: 'hidden',
    background: 'var(--mzr-bg)',
    padding: '24px',
    maxWidth: '960px',
    margin: '0 auto',
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--mzr-divider)'
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 700
  },
  button: {
    padding: '8px 14px',
    borderRadius: '12px',
    border: '1px solid var(--mzr-danger)',
    background: 'transparent',
    color: 'var(--mzr-danger)',
    fontWeight: 600,
    cursor: 'pointer'
  },
  searchField: {
    position: 'relative',
    width: '100%'
  },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--mzr-text-muted)',
    pointerEvents: 'none'
  },
  searchInput: {
    padding: '10px 42px 10px 42px',
    borderRadius: '14px',
    border: '1px solid var(--mzr-input-border)',
    background: 'var(--mzr-input-bg)',
    color: 'var(--mzr-text-primary)',
    width: '100%',
    height: '42px',
    boxSizing: 'border-box',
    outline: 'none'
  },
  searchClear: {
    position: 'absolute',
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: 'var(--mzr-text-secondary)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  feedback: {
    color: '#34d399',
    fontSize: '12px'
  },
  groups: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    paddingRight: '12px',
    boxSizing: 'border-box',
    minHeight: 0
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  groupTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--mzr-text-primary)'
  },
  groupCount: {
    fontSize: '12px',
    color: 'var(--mzr-text-muted)'
  },
  entry: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '16px',
    border: '1px solid var(--mzr-border)',
    background: 'var(--mzr-surface)',
    boxSizing: 'border-box'
  },
  entryMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
    minWidth: 0,
    maxWidth: '70%'
  },
  entryText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    overflow: 'hidden',
    width: '100%',
    minWidth: 0,
  },
  entryTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--mzr-text-primary)',
    width: '100%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis'
  },
  entryUrl: {
    fontSize: '12px',
    color: 'var(--mzr-text-muted)',
    width: '100%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis'
  },
  entryMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
    color: 'var(--mzr-text-muted)',
    fontSize: '12px'
  },
  entryDot: {
    flexShrink: 0,
    color: 'var(--mzr-text-muted)'
  },
  entryActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexShrink: 0
  },
  actionToggle: {
    padding: '6px',
    borderRadius: '8px',
    border: '1px solid transparent',
    background: 'transparent',
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionButton: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid var(--mzr-border)',
    background: 'var(--mzr-surface-weak)',
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer'
  },
  favicon: {
    width: '32px',
    height: '32px',
    borderRadius: '999px',
    objectFit: 'cover',
    background: 'var(--mzr-surface-weak)',
    border: '1px solid var(--mzr-border)',
    flexShrink: 0
  },
  emptyState: {
    marginTop: '44px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--mzr-text-muted)',
    textAlign: 'center'
  },
  emptyIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '14px',
    background: 'var(--mzr-surface-weak)',
    border: '1px solid var(--mzr-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--mzr-text-muted)'
  },
  emptyTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--mzr-text-primary)'
  },
  placeholder: {
    color: 'var(--mzr-text-muted)',
    textAlign: 'center',
    padding: '16px 0'
  },
  confirmBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2, 6, 23, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20
  },
  confirmPanel: {
    minWidth: '320px',
    width: 'min(520px, 90vw)',
    background: 'var(--mzr-surface-elevated)',
    border: '1px solid var(--mzr-border)',
    borderRadius: '20px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  confirmTitle: {
    margin: 0,
    fontSize: '24px'
  },
  confirmMessage: {
    fontSize: '16px',
    color: 'var(--mzr-text-secondary)'
  },
  confirmActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  confirmButton: {
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid rgba(59, 130, 246, 0.8)',
    background: 'rgba(59, 130, 246, 0.25)',
    color: 'var(--mzr-text-primary)',
    fontWeight: 600,
    cursor: 'pointer'
  }
};
