import type { CSSProperties } from 'react';

type StyleRecord = Record<string, CSSProperties>;

export const settingsModalStyles: StyleRecord = {
  container: {
    width: 'min(720px, 94vw)',
    height: '93vh',
    maxHeight: '100vh',
    borderRadius: '24px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    boxShadow: '0 24px 60px rgba(2, 6, 23, 0.55)',
    color: '#e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '16px',
    overflow: 'hidden',
    margin: '24px 0'
  },
  containerMobile: {
    width: '100%',
    borderRadius: '24px',
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
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    paddingRight: '6px'
  },
  block: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    padding: '28px 15px',
    borderTop: '1px solid rgba(148, 163, 184, 0.25)',
    position: 'relative'
  },
  blockHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    cursor: 'pointer'
  },
  blockHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  blockTitle: {
    margin: 0,
    fontSize: '14px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#cbd5f5'
  },
  blockToggleButton: {
    background: 'rgba(15, 23, 42, 0.65)',
    color: '#cbd5f5',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: 'none',
    border: 'none'
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
    border: '1px solid rgba(16, 185, 129, 0.35)',
    marginBottom: '10px',
    position: 'absolute',
    top: '20px',
    right: '20%'
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
    gap: '8px',
    padding: '12px 16px',
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
    gap: '12px',
    paddingTop: '20px'
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
    // borderRadius: '16px',
    // border: '1px solid rgba(148, 163, 184, 0.2)',
    // backgroundColor: 'rgba(17, 24, 39, 0.65)'
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
  aboutButton: {
    alignSelf: 'flex-start',
    border: '1px solid rgba(59, 130, 246, 0.6)',
    background: 'rgba(37, 99, 235, 0.15)',
    color: '#bfdbfe',
    borderRadius: '12px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    margin: '20px auto',
    width: '50%'
  },
  scaleContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px 18px',
  },
  scaleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  scaleLabel: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#f8fafc'
  },
  scaleValue: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#a5b4fc'
  },
  scaleRange: {
    width: '100%'
  },
  scaleHelper: {
    margin: 0,
    fontSize: '14px',
    color: '#cbd5f5'
  },
  scaleButtons: {
    display: 'flex',
    gap: '12px'
  },
  scaleButton: {
    border: '1px solid rgba(148, 163, 184, 0.45)',
    background: 'rgba(15, 23, 42, 0.75)',
    color: '#f8fafc',
    borderRadius: '12px',
    padding: '8px 16px',
    fontSize: '14px',
    cursor: 'pointer'
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
  },
  permissionsBadge: {
    fontSize: '14px',
    color: '#e2e8f0',
    lineHeight: 1.4
  },
  permissionsHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  permissionsToggleButton: {
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
  permissionsBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18
  },
  permissionsDefaultsCard: {
    border: '1px solid rgba(148,163,184,0.25)',
    borderRadius: 16,
    background: 'rgba(17, 24, 39, 0.66)',
    padding: '18px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14
  },
  permissionsDefaultsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  permissionsDefaultsTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e2e8f0',
    lineHeight: 1.4
  },
  permissionsDefaultsDescription: {
    fontSize: '14px',
    color: '#e2e8f0',
    lineHeight: 1.4,
    maxWidth: 420
  },
  permissionsDefaultsOptions: {
    display: 'grid',
    gridTemplateColumns: 'minmax(160px, 1.3fr) repeat(3, minmax(120px, 1fr))',
    gap: 10,
    alignItems: 'center'
  },
  permissionsDefaultsLabel: {
    fontSize: '14px',
    color: '#e2e8f0',
    lineHeight: 1.4
  },
  permissionsDefaultsButtonGroup: {
    display: 'flex',
    justifyContent: 'center'
  },
  permissionsDefaultsHeaderTitle: {
    fontSize: '14px',
    color: '#e2e8f0',
    lineHeight: 1.4
  },
  permissionsDefaultsHeaderLabel: {
    fontSize: '14px',
    color: '#e2e8f0',
    lineHeight: 1.4,
    textAlign: 'center'
  },
  permissionsOptionBase: {
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.28)',
    background: 'transparent',
    color: '#e2e8f0',
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    minWidth: 100,
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  permissionsOptionNeutral: {},
  permissionsOptionPrimary: {
    border: '1px solid rgba(37,99,235,0.55)',
    color: '#f8fafc',
    background: 'rgba(37, 99, 235, 0.07)'
  },
  permissionsOptionDestructive: {
    border: '1px solid rgba(239,68,68,0.55)',
    color: '#f8fafc',
    background: 'rgba(239,68,68,0.07)'
  },
  permissionsOptionActive: {
    background: 'rgba(37, 99, 235, 0.28)'
  },
  permissionsDefaultsMobileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  permissionsDefaultsMobileRow: {
    border: '1px solid rgba(148,163,184,0.25)',
    borderRadius: 14,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: 'rgba(15,23,42,0.62)'
  },
  permissionsDefaultsMobileButtons: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap'
  },
  permissionsResetButton: {
    padding: '9px 14px',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.28)',
    background: 'rgba(15,23,42,0.6)',
    color: '#e2e8f0',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  permissionsSearchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12
  },
  permissionsSearchInput: {
    flex: '1 1 auto',
    padding: '11px 16px',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.28)',
    background: 'rgba(15,23,42,0.55)',
    color: '#e2e8f0',
    outline: 'none',
    fontSize: '14px'
  },
  permissionsSiteContainer: {
    border: '1px solid rgba(148,163,184,0.25)',
    borderRadius: 16,
    background: 'rgba(11,17,29,0.72)',
    overflow: 'hidden'
  },
  permissionsSiteHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 2fr) repeat(4, minmax(120px, 1fr)) minmax(110px, 1fr)',
    alignItems: 'center',
    gap: 0,
    padding: '12px 14px',
    background: 'rgba(148,163,184,0.08)',
    fontSize: '14px',
    fontWeight: 600,
    color: '#e2e8f0',
    lineHeight: 1.4
  },
  permissionsSiteHeaderActions: {
    textAlign: 'right'
  },
  permissionsSiteRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 2fr) repeat(4, minmax(120px, 1fr)) minmax(110px, 1fr)',
    alignItems: 'center',
    gap: 0,
    padding: '12px 14px',
    borderTop: '1px solid rgba(148,163,184,0.22)',
    fontSize: '14px',
    color: '#e2e8f0',
    lineHeight: 1.4
  },
  permissionsSiteOrigin: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: '14px',
    color: '#e2e8f0',
    fontWeight: 600,
    lineHeight: 1.4
  },
  permissionsSiteButtons: {
    display: 'flex',
    gap: 10,
    justifyContent: 'center'
  },
  permissionsSiteActions: {
    display: 'flex',
    justifyContent: 'flex-end'
  },
  permissionsSiteResetButton: {
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.28)',
    background: 'rgba(15,23,42,0.6)',
    color: '#e2e8f0',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  permissionsSiteEmpty: {
    padding: '16px 18px',
    fontSize: '14px',
    color: '#e2e8f0',
    lineHeight: 1.4
  },
  permissionsSiteCard: {
    borderTop: '1px solid rgba(148,163,184,0.22)',
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  permissionsSiteCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  permissionsSiteCardOrigin: {
    fontWeight: 600,
    fontSize: '14px',
    color: '#e2e8f0',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  permissionsSiteCardPermissions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  permissionsSiteCardPermissionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    border: '1px solid rgba(148,163,184,0.22)',
    borderRadius: 12,
    padding: '10px 12px'
  },
  permissionsSiteCardPermissionLabel: {
    fontSize: '14px',
    color: '#e2e8f0',
    fontWeight: 500,
    lineHeight: 1.4
  }
  ,
  passwordSettings: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  settingsToggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px'
  },
  settingsToggleLabel: {
    fontSize: '14px'
  },
  settingsToggle: {
    width: '20px',
    height: '20px'
  },
  settingsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px'
  },
  settingsLinkRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    marginTop: '12px'
  },
  settingsSelect: {
    background: '#0f1729',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    color: '#f8fafc',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '14px'
  },
  settingsButton: {
    border: '1px solid rgba(148, 163, 184, 0.35)',
    borderRadius: '12px',
    background: 'rgba(15, 23, 42, 0.7)',
    color: '#f8fafc',
    padding: '8px 16px',
    cursor: 'pointer'
  },
  settingsLinkButton: {
    border: 'none',
    background: 'transparent',
    color: '#93c5fd',
    textDecoration: 'underline',
    cursor: 'pointer',
    padding: 0
  },
  settingsLinkButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  settingsMessage: {
    margin: 0,
    fontSize: '16px',
    color: '#a5b4fc',
    marginBottom: '15px'
  }
} as const;
