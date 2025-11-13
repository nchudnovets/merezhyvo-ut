import type { CSSProperties } from 'react';

export type HistoryStyleKeys =
  | 'container'
  | 'header'
  | 'title'
  | 'button'
  | 'searchInput'
  | 'groups'
  | 'group'
  | 'groupTitle'
  | 'entry'
  | 'entryMain'
  | 'entryText'
  | 'entryTitle'
  | 'entryUrl'
  | 'entryActions'
  | 'actionButton'
  | 'favicon'
  | 'placeholder';

export const historyStyles: Record<HistoryStyleKeys, CSSProperties> = {
  container: {
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    gap: '18px',
    overflowX: 'hidden'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  title: {
    margin: 0,
    fontSize: '24px'
  },
  button: {
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid rgba(251, 113, 133, 0.8)',
    background: 'rgba(244, 63, 94, 0.22)',
    color: '#f8fafc',
    fontWeight: 600,
    cursor: 'pointer'
  },
  searchInput: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    background: 'rgba(15, 23, 42, 0.85)',
    color: '#f8fafc',
    width: 'min(640px, 100%)',
    boxSizing: 'border-box'
  },
  groups: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    paddingRight: '12px',
    boxSizing: 'border-box'
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  groupTitle: {
    margin: 0,
    fontSize: '14px',
    color: '#94a3b8'
  },
  entry: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    paddingRight: '20px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(15, 23, 42, 0.85)'
  },
  entryMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
    maxWidth: '50%'
  },
  entryText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    overflow: 'hidden',
    width: '100%',
  },
  entryTitle: {
    fontSize: '14px',
    width: '100%',
    overflow: 'hiiden'
  },
  entryUrl: {
    fontSize: '12px',
    color: '#94a3b8',
    width: '100%',
    overflow: 'hiiden'
  },
  entryActions: {
    display: 'flex',
    gap: '8px'
  },
  actionButton: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    background: 'rgba(224, 231, 255, 0.08)',
    color: '#f8fafc',
    cursor: 'pointer'
  },
  favicon: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    objectFit: 'cover'
  },
  placeholder: {
    color: '#94a3b8'
  }
};
