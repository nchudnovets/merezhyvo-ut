import type { CSSProperties } from 'react';

type StyleRecord = Record<string, CSSProperties>;

export const settingsModalStyles: StyleRecord = {
  container: {
    width: 'min(480px, 94vw)',
    maxHeight: 'min(560px, 86vh)',
    borderRadius: '24px',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    boxShadow: '0 24px 60px rgba(2, 6, 23, 0.55)',
    color: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '16px',
    overflow: 'hidden'
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
    gap: '24px'
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
  }
} as const;

