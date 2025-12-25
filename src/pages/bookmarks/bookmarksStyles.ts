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
  | 'searchWrapper'
  | 'filterBar'
  | 'filterChip'
  | 'filterChipClear'
  | 'placeholder'
  | 'smallButton'
  | 'select'
  | 'tagGroup'
  | 'tagChip'
  | 'tagMore'
  | 'checkboxWrap'
  | 'checkbox'
  | 'actionGroup'
  | 'menu'
  | 'menuItem'
  | 'clearButton'
  | 'breadcrumbs'
  | 'crumbItem'
  | 'crumbButton'
  | 'crumbSeparator'
  | 'banner'
  | 'emptyState'
  | 'contextMenu'
  | 'contextMenuItem'
  | 'overlay'
  | 'dialog'
  | 'dialogTitle'
  | 'dialogBody'
  | 'dialogLabel'
  | 'dialogInput'
  | 'dialogActions'
  | 'dialogMessage'
  | 'dialogRadioInput'
  | 'folderListPicker'
  | 'folderPickerRow'
  | 'folderPickerActive'
  | 'folderPickerLabel'
  | 'folderPickerActions'
  | 'folderPickerValue'
  | 'fileHint'
  | 'folderRow'
  | 'folderIcon'
  | 'folderTitle'
  | 'folderMeta'
  | 'folderChevron'
  | 'bookmarkRow'
  | 'bookmarkFavicon'
  | 'bookmarkDetails'
  | 'bookmarkTitle'
  | 'bookmarkSubtitle'
  | 'starButton'
  | 'bottomBar'
  | 'bottomButton'
  | 'toast';

export const bookmarksStyles: Record<BookmarksStyleKeys, CSSProperties> = {
  container: {
    color: 'var(--mzr-text-primary)',
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
    border: '1px solid var(--mzr-border-strong)',
    background: 'rgba(59, 130, 246, 0.18)',
    color: 'var(--mzr-text-primary)',
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
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  filterBar: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  label: {
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--mzr-text-muted)'
  },
  form: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  input: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid var(--mzr-border-strong)',
    background: 'var(--mzr-surface-weak)',
    color: 'var(--mzr-text-primary)',
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
    color: 'var(--mzr-text-primary)',
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
  actionGroup: {
    position: 'relative'
  },
  menu: {
    position: 'absolute',
    top: '40px',
    right: 0,
    background: 'var(--mzr-surface-elevated)',
    border: '1px solid var(--mzr-border-strong)',
    borderRadius: '12px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    zIndex: 10
  },
  menuItem: {
    padding: '6px 14px',
    background: 'transparent',
    border: 'none',
    color: 'var(--mzr-text-primary)',
    textAlign: 'left',
    cursor: 'pointer'
  },
  contextMenu: {
    position: 'fixed',
    background: 'var(--mzr-surface-elevated)',
    border: '1px solid var(--mzr-border-strong)',
    borderRadius: '12px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    zIndex: 60,
    minWidth: '200px'
  },
  contextMenuItem: {
    padding: '8px 12px',
    background: 'transparent',
    border: 'none',
    color: 'var(--mzr-text-primary)',
    textAlign: 'left',
    cursor: 'pointer',
    borderRadius: '8px'
  },
  clearButton: {
    background: 'transparent',
    border: 'none',
    color: 'var(--mzr-text-primary)',
    fontSize: '18px',
    marginLeft: '8px',
    cursor: 'pointer'
  },
  filterChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    borderRadius: '999px',
    padding: '6px 12px',
    border: '1px solid var(--mzr-border-strong)',
    background: 'var(--mzr-surface-weak)',
    color: 'var(--mzr-text-primary)',
    fontSize: '14px',
    cursor: 'pointer'
  },
  filterChipClear: {
    marginLeft: '6px',
    background: 'transparent',
    border: 'none',
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer',
    fontSize: '16px',
    padding: 0
  },
  breadcrumbs: {
    display: 'flex',
    flexWrap: 'nowrap',
    overflowX: 'auto',
    gap: '4px'
  },
  crumbItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  crumbButton: {
    background: 'transparent',
    border: 'none',
    color: '#60a5fa',
    cursor: 'pointer',
    padding: 0,
    fontSize: '14px'
  },
  crumbSeparator: {
    color: 'var(--mzr-text-muted)'
  },
  banner: {
    background: 'rgba(220, 38, 38, 0.15)',
    border: '1px solid rgba(248, 113, 113, 0.5)',
    borderRadius: '12px',
    padding: '10px',
    color: '#fecaca'
  },
  emptyState: {
    border: '1px dashed var(--mzr-border-strong)',
    borderRadius: '12px',
    padding: '40px',
    textAlign: 'center'
  },
  folderRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    background: 'var(--mzr-surface-weak)',
    cursor: 'pointer',
    boxSizing: 'border-box',
    minWidth: 0
  },
  folderIcon: {
    fontSize: '24px'
  },
  folderTitle: {
    flex: 1,
    fontSize: '16px',
    textAlign: 'left',
    minWidth: 0,
    overflowWrap: 'break-word'
  },
  folderMeta: {
    color: 'var(--mzr-text-muted)',
    flexShrink: 0
  },
  folderChevron: {
    fontSize: '18px'
  },
  bookmarkRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    background: 'var(--mzr-surface-weak)',
    cursor: 'pointer',
    boxSizing: 'border-box',
    minWidth: 0
  },
  bookmarkFavicon: {
    fontSize: '24px'
  },
  bookmarkDetails: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    textAlign: 'left',
    overflowWrap: 'anywhere'
  },
  bookmarkTitle: {
    fontSize: '16px'
  },
  bookmarkSubtitle: {
    fontSize: '12px',
    color: 'var(--mzr-text-muted)'
  },
  tagGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px'
  },
  tagChip: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 8px',
    background: 'rgba(56, 189, 248, 0.15)',
    borderRadius: '999px',
    fontSize: '12px',
    color: '#7dd3fc',
    border: '1px solid rgba(125, 211, 252, 0.5)',
    cursor: 'pointer'
  },
  tagMore: {
    padding: '4px 8px',
    borderRadius: '999px',
    background: 'var(--mzr-border)',
    fontSize: '12px',
    color: 'var(--mzr-text-secondary)'
  },
  starButton: {
    background: 'transparent',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer'
  },
  checkboxWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkbox: {
    width: '18px',
    height: '18px'
  },
  nodeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid var(--mzr-divider)',
    background: 'var(--mzr-surface-weak)'
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
    color: 'var(--mzr-text-muted)'
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
    border: '1px solid var(--mzr-border-strong)',
    background: 'var(--mzr-surface-weak)',
    color: 'var(--mzr-text-primary)',
    width: 'min(640px, 100%)',
    boxSizing: 'border-box'
  },
  placeholder: {
    color: 'var(--mzr-text-muted)'
  },
  smallButton: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid var(--mzr-border)',
    background: 'rgba(224, 231, 255, 0.08)',
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer'
  },
  select: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid var(--mzr-border)',
    background: 'var(--mzr-surface-elevated)',
    color: 'var(--mzr-text-primary)'
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--mzr-overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
    padding: '16px'
  },
  dialog: {
    background: 'var(--mzr-surface-elevated)',
    border: '1px solid var(--mzr-border)',
    borderRadius: '16px',
    padding: '24px',
    width: 'min(520px, 92vw)',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  dialogTitle: {
    margin: 0,
    fontSize: '20px'
  },
  dialogBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  dialogLabel: {
    display: 'flex',
    gap: '6px',
    fontSize: '14px',
    color: 'var(--mzr-text-muted)'
  },
  dialogInput: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.5)',
    background: 'var(--mzr-surface-muted)',
    color: 'var(--mzr-text-primary)',
    width: '100%',
    boxSizing: 'border-box'
  },
  dialogRadioInput: {
    marginRight: '6px'
  },
  dialogActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap'
  },
  dialogMessage: {
    margin: 0,
    fontSize: '16px',
    color: '#fecaca',
    textAlign: 'center'
  },
  folderListPicker: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '280px',
    overflowY: 'auto',
    paddingRight: '6px'
  },
  folderPickerRow: {
    background: 'var(--mzr-surface-weak)',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    borderRadius: '10px',
    padding: '10px 14px',
    textAlign: 'left',
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer',
    width: '96%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  folderPickerActive: {
    background: 'rgba(37, 99, 235, 0.3)',
    borderColor: 'rgba(37, 99, 235, 0.5)'
  },
  folderPickerLabel: {
    fontSize: '14px',
    color: 'var(--mzr-text-secondary)'
  },
  folderPickerActions: {
    display: 'flex',
    justifyContent: 'flex-end'
  },
  folderPickerValue: {
    fontSize: '14px',
    color: 'var(--mzr-text-primary)',
    marginLeft: '8px'
  },
  fileHint: {
    fontSize: '12px',
    color: 'var(--mzr-text-muted)',
    marginTop: '4px'
  },
  bottomBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'var(--mzr-surface-elevated)',
    borderTop: '1px solid rgba(148, 163, 184, 0.3)',
    display: 'flex',
    justifyContent: 'space-around',
    padding: '12px 0',
    zIndex: 20
  },
  bottomButton: {
    padding: '10px 20px',
    borderRadius: '12px',
    border: '1px solid var(--mzr-border)',
    background: 'rgba(37, 99, 235, 0.25)',
    color: 'var(--mzr-text-primary)',
    fontWeight: 600,
    cursor: 'pointer'
  },
  toast: {
    position: 'fixed',
    bottom: '72px',
    right: '16px',
    background: 'rgba(16, 185, 129, 0.25)',
    border: '1px solid rgba(52, 211, 153, 0.6)',
    borderRadius: '12px',
    padding: '12px 18px',
    color: '#fff',
    zIndex: 40
  }
};
