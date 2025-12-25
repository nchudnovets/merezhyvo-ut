'use strict';

import type { CSSProperties } from 'react';

export const passwordsStyles: Record<string, CSSProperties> = {
  page: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '750px',
    height: '100%',
    backgroundColor: 'var(--mzr-bg)',
    color: 'var(--mzr-text-primary)',
    overflow: 'hidden',
    margin: '0 auto'
  },
  pageMobile: {
    maxWidth: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px 14px',
    borderBottom: '1px solid var(--mzr-border)'
  },
  headerTitle: {
    fontSize: '24px',
    fontWeight: 600,
    margin: 0
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    position: 'relative'
  },
  actionButton: {
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    border: '1px solid var(--mzr-border)',
    backgroundColor: 'var(--mzr-surface-elevated)',
    color: 'var(--mzr-text-primary)',
    fontSize: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  headerTitleMobile: {
    fontSize: '40px'
  },
  actionButtonMobile: {
    width: '80px',
    height: '80px',
    fontSize: '38px',
    borderRadius: '24px'
  },
  overflowButton: {
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    border: '1px solid var(--mzr-border)',
    backgroundColor: 'var(--mzr-surface-elevated)',
    color: 'var(--mzr-text-primary)',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  overflowButtonMobile: {
    width: '80px',
    height: '80px',
    fontSize: '40px',
    borderRadius: '24px'
  },
  searchBar: {
    padding: '0 24px',
    marginTop: '12px',
    marginBottom: '16px'
  },
  searchInput: {
    width: '97%',
    borderRadius: '12px',
    border: '1px solid var(--mzr-border)',
    backgroundColor: 'var(--mzr-surface-elevated)',
    color: 'var(--mzr-text-primary)',
    fontSize: '16px',
    padding: '10px 12px',
    outline: 'none'
  },
  searchInputMobile: {
    fontSize: '36px',
    padding: '18px 14px',
    width: '97%'
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 24px 24px',
    boxSizing: 'border-box'
  },
  group: {
    marginBottom: '20px'
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px'
  },
  groupTitle: {
    fontSize: '16px',
    fontWeight: 600
  },
  groupMeta: {
    fontSize: '12px',
    color: 'var(--mzr-text-muted)'
  },
  entryRow: {
    borderBottom: '1px solid var(--mzr-border)',
    padding: '14px 0'
  },
  entryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer'
  },
  entrySite: {
    fontSize: '17px',
    fontWeight: 600
  },
  entrySiteMobile: {
    fontSize: '38px'
  },
  entryActionsRow: {
    marginTop: '16px',
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  entryActionButtonDanger: {
    borderColor: 'var(--mzr-danger)',
    color: 'var(--mzr-danger)'
  },
  entryActionButton: {
    border: '1px solid var(--mzr-border)',
    borderRadius: '10px',
    padding: '6px 12px',
    backgroundColor: 'var(--mzr-surface-elevated)',
    color: 'var(--mzr-text-primary)',
    fontSize: '12px',
    cursor: 'pointer'
  },
  entryActionButtonMobile: {
    padding: '12px 18px',
    fontSize: '34px',
    borderRadius: '14px',
    minWidth: '150px'
  },
  entryDetails: {
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
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
    marginTop: '60px',
    textAlign: 'center'
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: 600,
    marginBottom: '12px'
  },
  emptyTitleMobile: {
    fontSize: '36px'
  },
  emptyAction: {
    marginTop: '8px',
    padding: '10px 18px',
    borderRadius: '10px',
    border: '1px solid var(--mzr-accent)',
    backgroundColor: 'var(--mzr-accent-tint)',
    color: 'var(--mzr-accent-tint)',
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
    padding: '150px 0'
  },
  modal: {
    width: 'min(520px, 90vw)',
    backgroundColor: 'var(--mzr-surface-elevated)',
    borderRadius: '18px',
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
    gap: '12px',
    paddingRight: '30px'
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
    color: 'var(--mzr-text-primary)',
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
