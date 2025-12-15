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
    backgroundColor: '#05070f',
    color: '#f8fafc',
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
    borderBottom: '1px solid rgba(148, 163, 184, 0.25)'
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
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#0f1729',
    color: '#f8fafc',
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
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#0f1729',
    color: '#f8fafc',
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
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#0f1729',
    color: '#f8fafc',
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
    color: 'rgba(248, 250, 252, 0.65)'
  },
  entryRow: {
    borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
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
    borderColor: 'rgba(248, 113, 113, 0.5)',
    color: '#fecaca'
  },
  entryActionButton: {
    border: '1px solid rgba(148, 163, 184, 0.35)',
    borderRadius: '10px',
    padding: '6px 12px',
    backgroundColor: '#0f1729',
    color: '#f8fafc',
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
    color: 'rgba(248, 250, 252, 0.8)'
  },
  entryDetailTextMobile: {
    fontSize: '35px'
  },
  notes: {
    fontSize: '13px',
    color: 'rgba(148, 163, 184, 0.8)'
  },
  notesMobile: {
    fontSize: '34px'
  },
  deleteConfirmation: {
    marginTop: '12px',
    padding: '14px',
    border: '1px solid rgba(248, 113, 113, 0.4)',
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
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
    color: '#fecaca'
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
    borderColor: 'rgba(248, 113, 113, 0.8)',
    backgroundColor: '#b91c1c',
    color: '#fff'
  },
  deleteCancelButton: {
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'transparent',
    color: '#fff'
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
    border: '1px solid rgba(37, 99, 235, 0.5)',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    color: '#a5b4fc',
    cursor: 'pointer'
  },
  loading: {
    marginTop: '32px',
    textAlign: 'center',
    color: 'rgba(248, 250, 252, 0.7)'
  },
  toast: {
    position: 'absolute',
    bottom: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 18px',
    borderRadius: '14px',
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(59, 130, 246, 0.6)',
    color: '#e0e7ff',
    fontSize: '13px',
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.6)'
  },
  toastMobile: {
    fontSize: '35px',
  },
  banner: {
    margin: '0 24px 12px',
    padding: '12px',
    borderRadius: '12px',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.6)',
    color: '#fee2e2',
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
    backgroundColor: '#0f1729',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    padding: '8px 0',
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.5)',
    zIndex: 10
  },
  overflowItem: {
    padding: '10px 20px',
    fontSize: '14px',
    color: '#f8fafc',
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
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    padding: '150px 0'
  },
  modal: {
    width: 'min(520px, 90vw)',
    backgroundColor: '#0f1729',
    borderRadius: '18px',
    padding: '24px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
    border: '1px solid rgba(148, 163, 184, 0.35)'
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
    color: '#f8fafc',
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
    color: 'rgba(248, 250, 252, 0.6)'
  },
  modalLabelMobile: {
    fontSize: '38px'
  },
  modalInput: {
    width: '100%',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    backgroundColor: '#0b1220',
    color: '#f8fafc',
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
    backgroundColor: '#2563eb',
    color: '#f8fafc',
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
    border: '1px solid rgba(148, 163, 184, 0.4)',
    backgroundColor: '#0f1729',
    color: '#f8fafc',
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
    border: '1px solid rgba(248, 113, 113, 0.7)',
    backgroundColor: '#7f1d1d',
    color: '#fee2e2',
    cursor: 'pointer'
  },
  confirmOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 21
  },
  confirmBox: {
    width: 'min(360px, 90vw)',
    backgroundColor: '#0f1729',
    borderRadius: '16px',
    border: '1px solid rgba(248, 113, 113, 0.6)',
    padding: '22px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.6)'
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
