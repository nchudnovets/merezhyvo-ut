import type { CSSProperties } from 'react';

type StyleRecord = Record<string, CSSProperties>;

export const settingsModalStyles: StyleRecord = {
  container: {
    width: 'min(480px, 94vw)',
    height: '93vh',
    maxHeight: '100vh',
    borderRadius: '24px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    boxShadow: '0 24px 60px rgba(2, 6, 23, 0.55)',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '16px',
    overflow: 'hidden',
    margin: '24px 0'
  },
  containerMobile: {
    width: '100%',
    height: '100vh',
    minHeight: '100vh',
    borderRadius: 0,
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    boxShadow: '0 -12px 50px rgba(2, 6, 23, 0.65)',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    padding: 'calc(2vh) calc(4vw)',
    gap: 'calc(2vh)',
    boxSizing: 'border-box'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px'
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600
  },
  sections: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    paddingRight: '6px'
  },
  block: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    padding: '18px 15px',
    borderRadius: '18px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(10, 16, 28, 0.85)'
  },
  blockHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px'
  },
  blockTitle: {
    margin: 0,
    fontSize: '14px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#cbd5f5'
  },
  blockBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  keyboardToggleButton: {
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(15, 23, 42, 0.65)',
    color: '#cbd5f5',
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  keyboardSavedPill: {
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '2px 12px',
    borderRadius: 999,
    background: 'rgba(16, 185, 129, 0.16)',
    color: '#34d399',
    border: '1px solid rgba(16, 185, 129, 0.35)'
  },
  keyboardLayoutsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '460px',
    overflowY: 'auto',
    paddingRight: '6px'
  },
  keyboardLayoutRow: {
    display: 'grid',
    gridTemplateColumns: 'auto auto 1fr auto',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '16px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(17, 24, 39, 0.6)'
  },
  keyboardHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  keyboardLayoutCode: {
    width: '58px',
    textAlign: 'center',
    fontWeight: 600,
    fontSize: '15px',
    color: '#f8fafc'
  },
  keyboardLayoutId: {
    color: '#cbd5f5',
    opacity: 0.85,
    fontSize: '13px',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.04em'
  },
  keyboardRadioLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#cbd5f5'
  },
  keyboardActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  loading: {
    fontSize: '14px',
    color: '#cbd5f5'
  },
  empty: {
    margin: 0,
    fontSize: '14px',
    color: '#cbd5f5'
  },
  appList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  appRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 18px',
    borderRadius: '16px',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    backgroundColor: 'rgba(17, 24, 39, 0.65)'
  },
  appHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    width: '100%'
  },
  appInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1,
    minWidth: 0
  },
  appTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#f8fafc',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  appUrl: {
    fontSize: '13px',
    color: '#cbd5f5',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  appActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  iconButton: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(15, 23, 42, 0.65)',
    color: 'rgba(250, 97, 97, 0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  icon: {
    width: '16px',
    height: '16px'
  },
  message: {
    margin: 0,
    fontSize: '14px',
    lineHeight: 1.4,
    borderRadius: '14px',
    border: '1px solid rgba(59, 130, 246, 0.45)',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    color: '#bfdbfe',
    padding: '12px 14px'
  },
  confirm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    borderTop: '1px solid rgba(148, 163, 184, 0.2)',
    paddingTop: '15px'
  },
  confirmText: {
    margin: 0,
    fontSize: '14px',
    color: '#f8fafc'
  },
  confirmActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center'
  },
  confirmButton: {
    minWidth: '120px',
    height: '40px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(15, 23, 42, 0.65)',
    color: '#e2e8f0',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  confirmButtonPrimary: {
    border: 'none',
    background: 'rgba(250, 97, 97, 0.92)',
    color: '#f8fafc'
  },
  aboutCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '16px 18px',
    borderRadius: '16px',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    backgroundColor: 'rgba(17, 24, 39, 0.65)'
  },
  aboutName: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#f8fafc'
  },
  aboutVersion: {
    margin: 0,
    fontSize: '14px',
    color: '#cbd5f5'
  },
  aboutDescription: {
    margin: 0,
    fontSize: '14px',
    color: '#e2e8f0',
    lineHeight: 1.4
  },
  torInfoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap'
  },
  torInfoLabel: {
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#94a3b8'
  },
  torInfoValue: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#f8fafc'
  },
  torInfoValueEnabled: {
    color: '#4ade80'
  },
  torInfoValueDisabled: {
    color: '#f87171'
  },
  torInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  torInputLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#f8fafc'
  },
  torInputRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  torInput: {
    flex: 1,
    height: '38px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    color: '#f8fafc',
    padding: '0 12px'
  },
  torSaveButton: {
    height: '38px',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.5)',
    background: 'rgba(37, 99, 235, 0.2)',
    color: '#bfdbfe',
    fontWeight: 600,
    padding: '0 18px',
    cursor: 'pointer'
  },
  torInputHint: {
    margin: 0,
    fontSize: '12px',
    color: '#94a3b8'
  },
  torKeepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  torKeepCheckbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: '#2563eb'
  },
  torKeepLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#f8fafc',
    cursor: 'pointer'
  },
  torKeepLabelDisabled: {
    color: '#64748b',
    cursor: 'not-allowed'
  },
  torMessage: {
    margin: 0,
    fontSize: '13px',
    color: '#fbbf24'
  },
  messengerHint: {
    fontSize: '13px',
    color: '#cbd5f5'
  },
  messengerList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  messengerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '16px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(17, 24, 39, 0.6)'
  },
  messengerInfo: {
    flex: '1 1 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0
  },
  messengerName: {
    fontWeight: 600,
    fontSize: '15px',
    color: '#f8fafc',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  messengerUrl: {
    fontSize: '12px',
    color: '#94a3b8',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  messengerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  messengerActionButton: {
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    color: '#cbd5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  messengerMessage: {
    margin: 0,
    fontSize: '13px',
    color: '#a5b4fc'
  }
} as const;
