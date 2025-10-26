export const styles = {
  container: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    boxSizing: 'border-box',
    minHeight: 0,
    backgroundColor: '#0f111a',
    color: '#f8fafc',
    overflow: 'hidden'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 16px',
    backgroundColor: '#121826',
    boxShadow: '0 1px 6px rgba(0, 0, 0, 0.35)',
    position: 'relative',
    zIndex: 10
  },
  navGroup: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  navButton: {
    width: '42px',
    height: '42px',
    borderRadius: '14px',
    border: 'none',
    backgroundColor: '#1c2333',
    color: '#f8fafc',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  navIcon: { display: 'block' },
  navButtonDisabled: { opacity: 0.35 },
  form: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
    margin: 0
  },
  addressField: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    flex: 1
  },
  input: {
    flex: 1,
    width: '100%',
    height: '36px',
    borderRadius: '16px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#0f1729',
    color: '#f8fafc',
    padding: '0 56px 0 14px',
    outline: 'none'
  },
  makeAppBtn: {
    position: 'absolute',
    top: '50%',
    right: '12px',
    transform: 'translateY(-50%)',
    width: '36px',
    height: '26px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    background: 'transparent',
    border: '1px solid rgba(37, 99, 235, 0.7)',
    borderRadius: '12px',
    color: '#93c5fd',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
    boxShadow: '0 0 0 rgba(37, 99, 235, 0.1)'
  },
  statusIndicator: {
    minWidth: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  statusSvg: { display: 'block' },
  statusIconReady: { color: '#22c55e' },
  statusIconError: { color: '#ef4444' },
  spinner: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid rgba(148, 163, 184, 0.45)',
    borderTopColor: '#2563eb',
    animation: 'app-spin 0.75s linear infinite'
  },
  tabsButton: {
    position: 'relative',
    width: '42px',
    height: '42px',
    borderRadius: '14px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#1c2333',
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
  },
  tabsButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed'
  },
  tabsButtonSquare: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '8px',
    border: '1px solid rgba(148, 163, 184, 0.45)',
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    color: '#f8fafc',
    boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.18)',
    flexShrink: 0
  },
  tabsButtonCount: {
    fontSize: '12px',
    fontWeight: 600,
    lineHeight: 1
  },
  settingsButton: {
    height: '42px',
    width: '42px',
    borderRadius: '14px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#1c2333',
    color: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
  },
  settingsButtonIcon: {
    width: '18px',
    height: '18px',
    display: 'block'
  },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    border: 0
  },
  webview: {
    display: 'block',
    width: '100%',
    height: '100%',
    flex: 1,
    minHeight: 0,
    border: 'none',
    backgroundColor: '#05070f',
    touchAction: 'pan-x pan-y pinch-zoom'
  },
  webviewMount: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden'
  },
  webviewHost: {
    position: 'relative',
    width: '100%',
    height: '100%'
  },
  webviewLoadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    color: '#cbd5f5',
    background: 'linear-gradient(180deg, rgba(5,7,15,0.65), rgba(5,7,15,0.78))',
    pointerEvents: 'none',
    zIndex: 4
  },
  webviewLoadingOverlayMobile: {
    gap: 'clamp(32px, 6vh, 56px)',
    background: 'linear-gradient(180deg, rgba(5,7,15,0.78), rgba(5,7,15,0.82))'
  },
  webviewLoadingSpinner: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    border: '3px solid rgba(148, 163, 184, 0.35)',
    borderTopColor: '#60a5fa',
    animation: 'app-spin 0.9s linear infinite',
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.45)'
  },
  webviewLoadingSpinnerMobile: {
    width: 'clamp(96px, 16vw, 140px)',
    height: 'clamp(96px, 16vw, 140px)',
    borderWidth: '6px'
  },
  webviewLoadingLabel: {
    fontSize: '13px',
    letterSpacing: '0.35em',
    textTransform: 'uppercase',
    color: '#cbd5f5',
    textShadow: '0 2px 6px rgba(5,7,15,0.4)'
  },
  webviewLoadingLabelMobile: {
    fontSize: 'clamp(30px, 4.5vw, 44px)',
    letterSpacing: '0.4em'
  },
  backgroundShelf: {
    position: 'absolute',
    width: 1,
    height: 1,
    left: -10000,
    top: -10000,
    overflow: 'hidden',
    pointerEvents: 'none'
  },
  bottomToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '6px 50px',
    backgroundColor: '#121826',
    borderTop: '1px solid rgba(148, 163, 184, 0.18)',
    position: 'relative',
    zIndex: 5,
    flexShrink: 0
  },
  zoomLabel: {
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: '#94a3b8'
  },
  zoomSliderContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center'
  },
  zoomSlider: {
    flex: 1,
    minWidth: 0,
    touchAction: 'none'
  },
  zoomValue: {
    color: '#f8fafc',
    fontVariantNumeric: 'tabular-nums'
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(5, 7, 15, 0.76)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    zIndex: 200
  },
  modal: {
    width: 'min(420px, 92vw)',
    borderRadius: '20px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    boxShadow: '0 24px 60px rgba(2, 6, 23, 0.55)',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '20px'
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px'
  },
  modalTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600
  },
  modalBody: {
    fontSize: '16px',
    color: '#cbd5f5',
    lineHeight: 1.5,
    margin: '8px 0'
  },
  modalClose: {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'transparent',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  modalField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  modalLabel: {
    fontSize: '14px',
    color: '#cbd5f5'
  },
  modalInput: {
    height: '44px',
    borderRadius: '14px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#0f1729',
    color: '#f8fafc',
    padding: '0 14px',
    fontSize: '16px',
    outline: 'none'
  },
  modalMsg: {
    fontSize: '13px',
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
    borderRadius: '14px',
    border: '1px solid rgba(59, 130, 246, 0.45)',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    color: '#bfdbfe',
    padding: '12px 14px'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px'
  },
  modalButton: {
    minWidth: '120px',
    height: '42px',
    borderRadius: '12px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(15, 23, 42, 0.65)',
    color: '#e2e8f0',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  modalButtonPrimary: {
    border: 'none',
    background: 'rgba(37, 99, 235, 0.92)',
    color: '#f8fafc'
  },
  modalButtonDisabled: {
    opacity: 0.6,
    cursor: 'wait'
  },
  modalMobile: {
    width: '100%',
    height: 'auto',
    minHeight: 0,
    maxHeight: '92vh',
    borderRadius: '28px 28px 0 0',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    boxShadow: '0 -12px 50px rgba(2, 6, 23, 0.65)',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    padding: 'calc(2vh) calc(4vw)',
    gap: 'calc(1vh)',
    boxSizing: 'border-box',
    marginTop: 'clamp(14px, 4vh, 28px)',
    overflowY: 'auto'
  },
  modalHeaderMobile: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'calc(3vw)'
  },
  modalBodyMobile: {
    fontSize: 'clamp(33px, 5.1vw, 48px)',
    color: '#dbeafe',
    lineHeight: 1.2,
    margin: 'clamp(10px, 2vh, 24px) 0'
  },
  modalTitleMobile: {
    margin: 0,
    fontSize: 'clamp(42px, 6.75vw, 66px)',
    fontWeight: 600
  },
  modalCloseMobile: {
    width: 'clamp(56px, 8vw, 80px)',
    height: 'clamp(56px, 8vw, 80px)',
    borderRadius: '16px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'transparent',
    color: '#cbd5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'clamp(33px, 5vw, 44px)',
    cursor: 'pointer'
  },
  modalFormMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(24px, 4.5vh, 60px)'
  },
  modalFieldMobile: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(18px, 3vh, 36px)'
  },
  modalLabelMobile: {
    fontSize: 'clamp(36px, 5.4vw, 51px)',
    color: '#e2e8f0'
  },
  modalInputMobile: {
    borderRadius: '24px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(9, 12, 22, 0.92)',
    color: '#f8fafc',
    padding: 'clamp(18px, 2.8vw, 24px)',
    fontSize: 'clamp(33px, 4.8vw, 42px)',
    outline: 'none'
  },
  modalMsgMobile: {
    fontSize: 'clamp(30px, 4.5vw, 39px)',
    lineHeight: 1.25,
    whiteSpace: 'pre-wrap',
    borderRadius: '24px',
    border: '1px solid rgba(59, 130, 246, 0.45)',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    color: '#dbeafe',
    padding: 'clamp(24px, 3.5vw, 36px)'
  },
  modalActionsMobile: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 'clamp(24px, 3.5vw, 36px)'
  },
  modalButtonMobile: {
    minWidth: 'clamp(180px, 26vw, 240px)',
    height: 'clamp(72px, 10vw, 96px)',
    borderRadius: '24px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(15, 23, 42, 0.72)',
    color: '#e2e8f0',
    fontSize: 'clamp(33px, 4.8vw, 39px)',
    fontWeight: 600,
    cursor: 'pointer'
  },
  modalButtonPrimaryMobile: {
    border: 'none',
    background: 'rgba(37, 99, 235, 0.92)',
    color: '#f8fafc'
  },
  modalButtonDisabledMobile: {
    opacity: 0.6,
    cursor: 'wait'
  },
  torAlertOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(5, 7, 15, 0.78)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    zIndex: 400
  },
  torAlertCard: {
    width: '100%',
    borderRadius: '32px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    boxShadow: '0 24px 60px rgba(2, 6, 23, 0.55)',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    padding: '36px 28px',
    textAlign: 'center'
  },
  torAlertCardMobile: {
    width: '100%'
  },
  torAlertCardDesktop: {
    width: 'min(420px, 90vw)'
  },
  torAlertText: {
    margin: 0,
    fontWeight: 600,
    lineHeight: 1.3
  },
  torAlertTextMobile: {
    fontSize: '34px'
  },
  torAlertTextDesktop: {
    fontSize: '22px'
  },
  torAlertButton: {
    alignSelf: 'center',
    borderRadius: '24px',
    border: '1px solid rgba(59, 130, 246, 0.6)',
    background: 'rgba(37, 99, 235, 0.25)',
    color: '#f8fafc',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0 24px'
  },
  torAlertButtonMobile: {
    minWidth: '70%',
    height: '78px',
    fontSize: '30px'
  },
  torAlertButtonDesktop: {
    minWidth: '220px',
    height: '52px',
    fontSize: '18px'
  }
} as const;
