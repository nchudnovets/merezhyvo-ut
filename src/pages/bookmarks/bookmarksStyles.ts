import type { CSSProperties } from 'react';

export type BookmarksStyleKeys =
  | 'container'
  | 'hero'
  | 'heroTitle'
  | 'badgeGroup'
  | 'badge'
  | 'badgeActive'
  | 'section'
  | 'label'
  | 'form'
  | 'input'
  | 'button'
  | 'list'
  | 'nodeRow'
  | 'nodeMain'
  | 'nodeActions'
  | 'nodeTitle'
  | 'nodeUrl'
  | 'nodeActionsMobile'
  | 'feedback'
  | 'searchInput'
  | 'placeholder'
  | 'smallButton'
  | 'select';

export const bookmarksStyles: Record<BookmarksStyleKeys, CSSProperties> = {
  container: {
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    height: '100%',
    overflow: 'hidden',
    overflowX: 'hidden'
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  heroTitle: {
    fontSize: '24px',
    margin: 0
  },
  badgeGroup: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  badge: {
    padding: '6px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    background: 'rgba(59, 130, 246, 0.18)',
    color: '#f8fafc',
    cursor: 'pointer'
  },
  badgeActive: {
    borderColor: 'rgba(59, 130, 246, 0.85)',
    background: 'rgba(37, 99, 235, 0.35)'
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  label: {
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#94a3b8'
  },
  form: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  input: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    background: 'rgba(15, 23, 42, 0.85)',
    color: '#f8fafc',
    flex: 1,
    minWidth: '180px',
    width: 'min(640px, 100%)',
    boxSizing: 'border-box'
  },
  button: {
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid rgba(37, 99, 235, 0.8)',
    background: 'rgba(37, 99, 235, 0.25)',
    color: '#f8fafc',
    fontWeight: 600,
    cursor: 'pointer'
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingRight: '12px',
    boxSizing: 'border-box'
  },
  nodeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(15, 23, 42, 0.8)'
  },
  nodeMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  nodeActions: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center'
  },
  nodeTitle: {
    fontSize: '14px'
  },
  nodeUrl: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  nodeActionsMobile: {
    flexDirection: 'column',
    alignItems: 'stretch'
  },
  feedback: {
    fontSize: '12px',
    color: '#34d399'
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
  placeholder: {
    color: '#94a3b8'
  },
  smallButton: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid rgba(148, 163, 184, 0.4)',
    background: 'rgba(224, 231, 255, 0.08)',
    color: '#f8fafc',
    cursor: 'pointer'
  },
  select: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid rgba(148, 163, 184, 0.4)',
    background: 'rgba(15, 23, 42, 0.95)',
    color: '#f8fafc'
  }
};
