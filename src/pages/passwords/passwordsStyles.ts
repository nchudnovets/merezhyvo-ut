'use strict';

import type { CSSProperties } from 'react';

export const passwordsStyles: Record<string, CSSProperties> = {
  page: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '960px',
    height: '100%',
    backgroundColor: 'var(--mzr-bg)',
    color: 'var(--mzr-text-primary)',
    overflow: 'hidden',
    margin: '0 auto',
    padding: '24px',
    boxSizing: 'border-box',
    gap: '16px'
  },
  pageMobile: {
    maxWidth: '100%',
    padding: '28px',
    gap: '22px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--mzr-divider)'
  },
  headerLead: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 },
  headerTitle: {
    fontSize: '24px',
    fontWeight: 700,
    margin: 0
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    position: 'relative'
  },
  actionButton: {
    minWidth: '38px',
    height: '38px',
    padding: '0 12px',
    borderRadius: '12px',
    border: '1px solid var(--mzr-accent)',
    backgroundColor: 'var(--mzr-accent)',
    color: '#fff',
    fontSize: '22px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  headerTitleMobile: {
    fontSize: '40px'
  },
  actionButtonMobile: {
    minWidth: '72px',
    height: '72px',
    padding: '0 22px',
    fontSize: '40px',
    borderRadius: '24px'
  },
  overflowButton: {
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    border: '1px solid var(--mzr-border)',
    backgroundColor: 'var(--mzr-surface-weak)',
    color: 'var(--mzr-text-primary)',
    fontSize: '18px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  overflowButtonMobile: {
    width: '72px',
    height: '72px',
    fontSize: '40px',
    borderRadius: '24px'
  },
  searchBar: {
    position: 'relative',
    width: '100%'
  },
  searchIcon: { position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--mzr-text-muted)', pointerEvents: 'none' },
  searchInput: {
    width: '100%',
    height: '42px',
    boxSizing: 'border-box',
    borderRadius: '14px',
    border: '1px solid var(--mzr-input-border)',
    backgroundColor: 'var(--mzr-input-bg)',
    color: 'var(--mzr-text-primary)',
    fontSize: '16px',
    padding: '10px 14px 10px 42px',
    outline: 'none'
  },
  searchInputMobile: {
    height: '76px',
    fontSize: '36px',
    padding: '18px 14px 18px 74px'
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    gap: '18px',
    display: 'flex',
    flexDirection: 'column',
    paddingRight: '12px',
    boxSizing: 'border-box'
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 2px'
  },
  groupTitle: {
    fontSize: '16px',
    fontWeight: 700,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  groupMeta: {
    fontSize: '12px',
    color: 'var(--mzr-text-muted)'
  },
  entryRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '16px',
    border: '1px solid var(--mzr-border)',
    backgroundColor: 'var(--mzr-surface)',
    boxSizing: 'border-box'
  },
  entryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    minWidth: 0
  },
  siteGlyph: { width: '34px', height: '34px', borderRadius: '12px', backgroundColor: 'var(--mzr-surface-weak)', border: '1px solid var(--mzr-border)', color: 'var(--mzr-text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '14px', fontWeight: 700 },
  entryHeading: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 },
  entrySummary: { fontSize: '12px', color: 'var(--mzr-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  expandButton: { width: '30px', height: '30px', padding: 0, border: '1px solid transparent', borderRadius: '8px', background: 'transparent', color: 'var(--mzr-text-primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  entrySite: {
    fontSize: '15px',
    fontWeight: 650,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  entrySiteMobile: {
    fontSize: '38px'
  },
  entryActionsRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  entryActionButtonDanger: {
    borderColor: 'var(--mzr-danger)',
    color: 'var(--mzr-danger)'
  },
  entryActionButton: {
    border: '1px solid var(--mzr-border)',
    borderRadius: '10px',
    padding: '7px 11px',
    backgroundColor: 'var(--mzr-surface-weak)',
    color: 'var(--mzr-text-primary)',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  entryActionButtonMobile: {
    padding: '12px 18px',
    fontSize: '34px',
    borderRadius: '14px',
    minWidth: '150px'
  },
  entryDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingTop: '2px'
  },
  detailCards: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' },
  detailCard: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, padding: '10px 12px', borderRadius: '12px', background: 'var(--mzr-surface-weak)', border: '1px solid var(--mzr-border)' },
  detailLabel: { fontSize: '11px', color: 'var(--mzr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  entryDetailText: {
    fontSize: '14px',
    color: 'var(--mzr-text-secondary)'
  },
  entryDetailTextMobile: {
    fontSize: '35px'
  },
  notes: {
    fontSize: '13px',
    color: 'var(--mzr-text-muted)'
  },
  notesMobile: {
    fontSize: '34px'
  },
  deleteConfirmation: {
    marginTop: '12px',
    padding: '14px',
    border: '1px solid var(--mzr-danger)',
    backgroundColor: 'var(--mzr-danger-tint)',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px'
  },
  deleteConfirmationMobile: {
    flexDirection: 'column',
    alignItems: 'stretch'
  },
  deleteConfirmationText: {
    fontSize: '14px',
    color: 'var(--mzr-danger)'
  },
  deleteConfirmationTextMobile: {
    fontSize: '34px'
  },
  deleteConfirmationActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  deleteConfirmButton: {
    borderColor: 'var(--mzr-danger)',
    backgroundColor: 'var(--mzr-danger)',
    color: 'var(--mzr-text-primary)'
  },
  deleteCancelButton: {
    borderColor: 'var(--mzr-border)',
    backgroundColor: 'transparent',
    color: 'var(--mzr-text-primary)'
  },
  deleteConfirmButtonMobile: {
    fontSize: '34px',
    padding: '16px 20px'
  },
  deleteCancelButtonMobile: {
    fontSize: '34px',
    padding: '16px 20px'
  },
  emptyState: {
    marginTop: '44px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px'
  },
  emptyIcon: { width: '44px', height: '44px', borderRadius: '14px', background: 'var(--mzr-surface-weak)', border: '1px solid var(--mzr-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mzr-text-muted)' },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: 600,
    marginBottom: '12px'
  },
  emptyTitleMobile: {
    fontSize: '36px'
  },
  emptyAction: {
    marginTop: '2px',
    padding: '10px 18px',
    borderRadius: '10px',
    border: '1px solid var(--mzr-accent)',
    backgroundColor: 'var(--mzr-accent)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer'
  },
  loading: {
    marginTop: '32px',
    textAlign: 'center',
    color: 'var(--mzr-text-secondary)'
  },
  toast: {
    position: 'absolute',
    bottom: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 18px',
    borderRadius: '14px',
    background: 'var(--mzr-surface-elevated)',
    border: '1px solid var(--mzr-accent)',
    color: 'var(--mzr-text-primary)',
    fontSize: '13px',
    boxShadow: '0 12px 30px var(--mzr-surface-transparent)'
  },
  toastMobile: {
    fontSize: '35px',
  },
  banner: {
    margin: '0 24px 12px',
    padding: '12px',
    borderRadius: '12px',
    backgroundColor: 'var(--mzr-danger-tint)',
    border: '1px solid var(--mzr-danger)',
    color: 'var(--mzr-danger)',
    fontSize: '14px',
    textAlign: 'center'
  },
  bannerMobile: {
    fontSize: '38px',
    padding: '18px',
    margin: '0 24px 18px'
  },
  overflowMenu: {
    position: 'absolute',
    top: '48px',
    right: '0',
    backgroundColor: 'var(--mzr-surface-elevated)',
    borderRadius: '12px',
    border: '1px solid var(--mzr-border)',
    padding: '8px 0',
    boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
    zIndex: 10
  },
  overflowItem: {
    padding: '10px 20px',
    fontSize: '14px',
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  overflowItemMobile: {
    fontSize: '35px',
    padding: '16px 24px'
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'var(--mzr-surface-transparent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    padding: '24px'
  },
  modal: {
    width: 'min(520px, 90vw)',
    backgroundColor: 'var(--mzr-surface-elevated)',
    borderRadius: '18px',
    maxHeight: 'calc(100vh - 48px)',
    overflowY: 'auto',
    padding: '24px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
    border: '1px solid var(--mzr-border)'
  },
  modalMobile: {
    width: '90vw',
    maxHeight: '100%',
    overflowY: 'auto'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px'
  },
  modalTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600
  },
  modalTitleMobile: {
    fontSize: '45px'
  },
  modalClose: {
    background: 'transparent',
    border: 'none',
    color: 'var(--mzr-text-primary)',
    fontSize: '18px',
    cursor: 'pointer'
  },
  modalCloseMobile: {
    fontSize: '35px'
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  modalLabel: {
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--mzr-text-muted)'
  },
  modalLabelMobile: {
    fontSize: '38px'
  },
  modalInput: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '12px',
    border: '1px solid var(--mzr-border)',
    backgroundColor: 'var(--mzr-surface)',
    color: 'var(--mzr-text-primary)',
    padding: '10px 12px',
    fontSize: '14px',
    outline: 'none'
  },
  modalInputMobile: {
    fontSize: '30px',
    padding: '16px 18px'
  },
  modalTextarea: {
    minHeight: '60px',
    resize: 'vertical'
  },
  modalActions: {
    marginTop: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap'
  },
  modalActionsMobile: {
    flexDirection: 'column',
    gap: '16px'
  },
  primaryButton: {
    flex: 1,
    padding: '10px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: 'var(--mzr-accent)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer'
  },
  primaryButtonMobile: {
    fontSize: '38px',
    padding: '18px 14px'
  },
  secondaryButton: {
    flex: 1,
    padding: '10px',
    borderRadius: '12px',
    border: '1px solid var(--mzr-border)',
    backgroundColor: 'var(--mzr-surface-elevated)',
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer'
  },
  secondaryButtonMobile: {
    fontSize: '38px',
    padding: '18px 14px'
  },
  dangerButton: {
    flex: 1,
    padding: '10px',
    borderRadius: '12px',
    border: '1px solid var(--mzr-danger)',
    backgroundColor: '#7f1d1d',
    color: 'var(--mzr-danger)',
    cursor: 'pointer'
  },
  confirmOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'var(--mzr-surface-weak)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 21
  },
  confirmBox: {
    width: 'min(360px, 90vw)',
    backgroundColor: 'var(--mzr-surface-elevated)',
    borderRadius: '16px',
    border: '1px solid var(--mzr-danger)',
    padding: '22px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.35)'
  },
  confirmTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '12px'
  },
  confirmActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '16px'
  }
};
