import type { CSSProperties } from 'react';

type StyleRecord = Record<string, CSSProperties>;

export const settingsModalStyles: StyleRecord = {
  container: {
    width: 'min(720px, 94vw)',
    height: '93vh',
    maxHeight: '100vh',
    borderRadius: '24px',
    border: '1px solid var(--mzr-border)',
    backgroundColor: 'var(--mzr-surface-elevated)',
    boxShadow: '0 24px 60px rgba(2, 6, 23, 0.55)',
    color: 'var(--mzr-text-secondary)',
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
    border: '1px solid var(--mzr-border)',
    backgroundColor: 'var(--mzr-surface-elevated)',
    boxShadow: '0 -12px 50px rgba(2, 6, 23, 0.65)',
    color: 'var(--mzr-text-primary)',
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
    borderTop: '1px solid var(--mzr-border)',
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
    color: 'var(--mzr-text-secondary)'
  },
  blockToggleButton: {
    background: 'transparent',
    color: 'var(--mzr-text-secondary)',
    width: '30px',
    height: '30px',
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
    gap: '18px'
  },
  keyboardToggleButton: {
    border: '1px solid var(--mzr-border)',
    background: 'var(--mzr-surface-transparent)',
    color: 'var(--mzr-text-secondary)',
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
    color: 'var(--mzr-text-primary)',
    background: 'transparent',
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
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer'
  },
  keyboardLayoutId: {
    color: 'var(--mzr-text-secondary)',
    opacity: 0.85,
    fontSize: '15px',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.04em',
    cursor: 'pointer'
  },
  keyboardRadioLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '15px',
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer'
  },
  keyboardActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    paddingTop: '20px'
  },
  loading: {
    fontSize: '14px',
    color: 'var(--mzr-text-secondary)'
  },
  empty: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--mzr-text-secondary)'
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
    border: '1px solid var(--mzr-divider)',
    backgroundColor: 'var(--mzr-surface-transparent)'
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
    color: 'var(--mzr-text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  appUrl: {
    fontSize: '13px',
    color: 'var(--mzr-text-secondary)',
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
    border: '1px solid var(--mzr-border)',
    background: 'var(--mzr-surface-transparent)',
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
    color: 'var(--mzr-accent-tint)',
    padding: '12px 14px'
  },
  confirm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    borderTop: '1px solid var(--mzr-divider)',
    paddingTop: '15px'
  },
  confirmText: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--mzr-text-primary)'
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
    border: '1px solid var(--mzr-border)',
    background: 'var(--mzr-surface-transparent)',
    color: 'var(--mzr-text-secondary)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  confirmButtonPrimary: {
    border: 'none',
    background: 'rgba(250, 97, 97, 0.92)',
    color: 'var(--mzr-text-primary)'
  },
  aboutCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '16px 18px',
    // borderRadius: '16px',
    // border: '1px solid var(--mzr-divider)',
    // backgroundColor: 'var(--mzr-surface-transparent)'
  },
  aboutName: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--mzr-text-primary)'
  },
  aboutVersion: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--mzr-text-secondary)'
  },
  aboutDescription: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--mzr-text-secondary)',
    lineHeight: 1.4
  },
  aboutButton: {
    alignSelf: 'flex-start',
    border: '1px solid var(--mzr-accent)',
    background: 'var(--mzr-accent)',
    color: '#fff',
    borderRadius: '12px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    margin: '20px auto',
    width: '50%'
  },
  themeContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  themeHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '12px'
  },
  themeLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--mzr-text-primary)'
  },
  themeHelper: {
    fontSize: '13px',
    color: 'var(--mzr-text-muted)',
    textAlign: 'right',
    flex: 1
  },
  themeOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  themeOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '14px',
    border: 'none',
    background: 'transparent',
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer'
  },
  themeOptionActive: {
    color: 'var(--mzr-accent)',
    fontWeight: 700
  },
  scaleContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '16px 18px',
  },
  scaleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px'
  },
  scaleLabel: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--mzr-text-primary)'
  },
  scaleValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--mzr-accent)'
  },
  scaleRange: {
    width: '100%',
    accentColor: 'var(--mzr-accent)'
  },
  scaleHelper: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--mzr-text-secondary)'
  },
  scaleButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center'
  },
  scaleButton: {
    border: '1px solid var(--mzr-border-strong)',
    background: 'var(--mzr-surface-transparent)',
    color: 'var(--mzr-text-primary)',
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
    color: 'var(--mzr-text-muted)'
  },
  torInfoValue: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--mzr-text-primary)'
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
    color: 'var(--mzr-text-primary)'
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
    border: '1px solid var(--mzr-border)',
    backgroundColor: 'var(--mzr-surface-transparent)',
    color: 'var(--mzr-text-primary)',
    padding: '0 12px'
  },
  torSaveButton: {
    height: '38px',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.5)',
    background: 'rgba(37, 99, 235, 0.2)',
    color: 'var(--mzr-accent-tint)',
    fontWeight: 600,
    padding: '0 18px',
    cursor: 'pointer'
  },
  torInputHint: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--mzr-text-muted)'
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
    accentColor: 'var(--mzr-accent)'
  },
  torKeepLabel: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer',
    marginLeft: '7px'
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
    fontSize: '15px',
    color: 'var(--mzr-text-secondary)'
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
    fontSize: '16px',
    color: 'var(--mzr-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  messengerUrl: {
    fontSize: '14px',
    color: 'var(--mzr-text-muted)',
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
    // border: '1px solid var(--mzr-border)',
    border: 'none',
    backgroundColor: 'var(--mzr-surface-transparent)',
    color: 'var(--mzr-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  messengerMessage: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--mzr-accent)'
  },
  permissionsBadge: {
    fontSize: '14px',
    color: 'var(--mzr-text-secondary)',
    lineHeight: 1.4
  },
  permissionsHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  permissionsToggleButton: {
    border: '1px solid var(--mzr-border)',
    background: 'var(--mzr-surface-transparent)',
    color: 'var(--mzr-text-secondary)',
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
    color: 'var(--mzr-text-secondary)',
    lineHeight: 1.4
  },
  permissionsDefaultsDescription: {
    fontSize: '14px',
    color: 'var(--mzr-text-secondary)',
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
    color: 'var(--mzr-text-secondary)',
    lineHeight: 1.4
  },
  permissionsDefaultsButtonGroup: {
    display: 'flex',
    justifyContent: 'center'
  },
  permissionsDefaultsHeaderTitle: {
    fontSize: '14px',
    color: 'var(--mzr-text-secondary)',
    lineHeight: 1.4
  },
  permissionsDefaultsHeaderLabel: {
    fontSize: '14px',
    color: 'var(--mzr-text-secondary)',
    lineHeight: 1.4,
    textAlign: 'center'
  },
  permissionsOptionBase: {
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.28)',
    background: 'transparent',
    color: 'var(--mzr-text-secondary)',
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
    color: 'var(--mzr-text-primary)',
    background: 'rgba(37, 99, 235, 0.07)'
  },
  permissionsOptionDestructive: {
    border: '1px solid rgba(239,68,68,0.55)',
    color: 'var(--mzr-text-primary)',
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
    color: 'var(--mzr-text-secondary)',
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
    color: 'var(--mzr-text-secondary)',
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
    color: 'var(--mzr-text-secondary)',
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
    color: 'var(--mzr-text-secondary)',
    lineHeight: 1.4
  },
  permissionsSiteOrigin: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: '14px',
    color: 'var(--mzr-text-secondary)',
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
    color: 'var(--mzr-text-secondary)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  permissionsSiteEmpty: {
    padding: '16px 18px',
    fontSize: '14px',
    color: 'var(--mzr-text-secondary)',
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
    color: 'var(--mzr-text-secondary)',
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
    color: 'var(--mzr-text-secondary)',
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
    background: 'var(--mzr-surface-elevated)',
    border: '1px solid var(--mzr-border)',
    color: 'var(--mzr-text-primary)',
    borderRadius: '10px',
    padding: '8px 12px',
    fontSize: '14px'
  },
  settingsButton: {
    border: '1px solid var(--mzr-border)',
    borderRadius: '12px',
    background: 'var(--mzr-accent)',
    color: 'var(--mzr-text-primary)',
    padding: '8px 16px',
    cursor: 'pointer',
    width: '60%',
    margin: '0 auto'
  },
  settingsLinkButton: {
    border: 'none',
    background: 'transparent',
    color: 'var(--mzr-focus-ring)',
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
    color: 'var(--mzr-accent-tint)',
    marginBottom: '15px'
  }
} as const;
