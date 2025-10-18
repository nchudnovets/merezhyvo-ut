import { CSSProperties } from 'react';
import type { Mode } from '../../types/models';

type ToolbarStyleKey =
  | 'toolbar'
  | 'navGroup'
  | 'navButton'
  | 'navIcon'
  | 'navButtonDisabled'
  | 'form'
  | 'addressField'
  | 'input'
  | 'makeAppBtn'
  | 'statusIndicator'
  | 'statusSvg'
  | 'statusIconReady'
  | 'statusIconError'
  | 'spinner'
  | 'tabsButton'
  | 'tabsButtonDisabled'
  | 'tabsButtonSquare'
  | 'tabsButtonCount'
  | 'settingsButton'
  | 'settingsButtonIcon'
  | 'visuallyHidden';

type ToolbarModeVariant = {
  toolbarBtnRegular?: CSSProperties;
  toolbarBtnIcn?: CSSProperties;
  toolbarBtnDesktopOnly?: CSSProperties;
  searchInput?: CSSProperties;
  makeAppBtn?: CSSProperties;
  makeAppBtnIcn?: CSSProperties;
  statusIcon?: CSSProperties;
  tabsButton?: CSSProperties;
  tabsButtonSquare?: CSSProperties;
  tabsButtonCount?: CSSProperties;
  settingsButton?: CSSProperties;
  settingsButtonIcon?: CSSProperties;
};

export const toolbarStyles: Record<ToolbarStyleKey, CSSProperties> = {
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
    width: '42px',
    height: '42px',
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
  }
};

export const toolbarModeStyles: Record<Mode, ToolbarModeVariant> = {
  desktop: {
    toolbarBtnRegular: { width: '40px', height: '40px' },
    toolbarBtnIcn: { width: '18px', height: '18px' },
    toolbarBtnDesktopOnly: {},
    searchInput: { fontSize: '14px', height: '36px', paddingRight: '56px' },
    makeAppBtn: { width: '36px', height: '26px' },
    makeAppBtnIcn: { width: '16px', height: '16px' },
    statusIcon: { width: '14px', height: '14px' },
    tabsButton: {},
    tabsButtonSquare: {},
    tabsButtonCount: {},
    settingsButton: {},
    settingsButtonIcon: {}
  },
  mobile: {
    toolbarBtnRegular: {
      width: 'clamp(72px, 10vw, 96px)',
      height: 'clamp(72px, 10vw, 96px)'
    },
    toolbarBtnIcn: {
      width: 'clamp(36px, 5vw, 48px)',
      height: 'clamp(36px, 5vw, 48px)'
    },
    toolbarBtnDesktopOnly: { display: 'none' },
    searchInput: {
      fontSize: '36px',
      height: 'clamp(72px, 10vw, 96px)',
      paddingRight: 'clamp(120px, 16vw, 144px)'
    },
    makeAppBtn: {
      width: 'clamp(60px, 9vw, 84px)',
      height: 'clamp(60px, 9vw, 84px)'
    },
    makeAppBtnIcn: {
      width: 'clamp(32px, 5vw, 42px)',
      height: 'clamp(32px, 5vw, 42px)'
    },
    statusIcon: {
      width: 'clamp(22px, 3.5vw, 28px)',
      height: 'clamp(22px, 3.5vw, 28px)'
    },
    tabsButton: {
      width: 'clamp(72px, 10vw, 96px)',
      height: 'clamp(72px, 10vw, 96px)',
      borderRadius: '24px'
    },
    tabsButtonSquare: {
      width: 'clamp(44px, 6.5vw, 60px)',
      height: 'clamp(44px, 6.5vw, 60px)',
      borderRadius: '16px',
      border: '2px solid rgba(148, 163, 184, 0.55)'
    },
    tabsButtonCount: {
      fontSize: 'clamp(30px, 4.8vw, 38px)'
    },
    settingsButton: {
      height: 'clamp(72px, 10vw, 96px)',
      width: 'clamp(72px, 10vw, 96px)',
      borderRadius: '24px',
      fontSize: 'clamp(30px, 4.8vw, 38px)'
    },
    settingsButtonIcon: {
      width: 'clamp(36px, 5vw, 48px)',
      height: 'clamp(36px, 5vw, 48px)'
    }
  }
};
