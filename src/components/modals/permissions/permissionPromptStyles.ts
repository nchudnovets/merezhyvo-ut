import type { CSSProperties } from 'react';
import type { Mode } from '../../../types/models';

type StyleKeys =
  | 'shell'
  | 'card'
  | 'section'
  | 'divider'
  | 'badge'
  | 'title'
  | 'siteText'
  | 'sitePrefix'
  | 'requestList'
  | 'multiNote'
  | 'metaColumn'
  | 'permissionsList'
  | 'permissionRow'
  | 'permissionRowSelected'
  | 'permissionInfo'
  | 'permissionLabel'
  | 'permissionHint'
  | 'checkbox'
  | 'rememberRow'
  | 'rememberLabel'
  | 'actions'
  | 'actionButton'
  | 'actionButtonOutline'
  | 'actionButtonPrimary'
  | 'actionButtonMuted';

export const permissionPromptStyles: Record<StyleKeys, CSSProperties> = {
  shell: {
    position: 'fixed',
    top: '70px',
    left: 0,
    right: 0,
    zIndex: 110,
    display: 'flex',
    justifyContent: 'flex-start',
    pointerEvents: 'none',
    padding: '0 20px'
  },
  card: {
    pointerEvents: 'auto',
    width: 'min(420px, calc(100vw - 36px))',
    background: 'linear-gradient(160deg, rgba(17,24,39,0.97), rgba(11,15,28,0.94))',
    border: '1px solid rgba(148, 163, 184, 0.28)',
    boxShadow: '0 22px 48px rgba(5, 10, 26, 0.48)',
    borderRadius: 18,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  section: {
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12
  },
  divider: {
    height: 1,
    background: 'linear-gradient(90deg, rgba(148,163,184,0.25), rgba(148,163,184,0.05))',
    margin: '0 18px'
  },
  badge: {
    fontSize: 12,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--mzr-text-muted)'
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: 'var(--mzr-text-primary)'
  },
  metaColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  siteText: {
    fontSize: 14,
    color: 'var(--mzr-text-secondary)',
    lineHeight: 1.45
  },
  sitePrefix: {
    color: 'var(--mzr-text-muted)'
  },
  requestList: {
    fontStyle: 'italic',
    color: 'var(--mzr-accent-tint)'
  },
  multiNote: {
    fontSize: 12,
    color: 'var(--mzr-text-muted)',
    lineHeight: 1.5
  },
  permissionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  permissionRow: {
    border: '1px solid rgba(148,163,184,0.25)',
    background: 'rgba(15,23,42,0.62)',
    borderRadius: 14,
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    color: 'var(--mzr-text-secondary)',
    cursor: 'default'
  },
  permissionRowSelected: {
    background: 'rgba(37, 99, 235, 0.12)',
    borderColor: 'rgba(37, 99, 235, 0.4)'
  },
  permissionInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  permissionLabel: {
    fontWeight: 600
  },
  permissionHint: {
    fontSize: 12,
    color: 'var(--mzr-text-muted)'
  },
  checkbox: {
    width: 18,
    height: 18,
    accentColor: 'var(--mzr-accent)',
    cursor: 'pointer'
  },
  rememberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 12
  },
  rememberLabel: {
    fontSize: 13,
    color: 'var(--mzr-text-secondary)'
  },
  actions: {
    padding: '18px 20px',
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    flexWrap: 'wrap'
  },
  actionButton: {
    padding: '8px 16px',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.28)',
    background: 'rgba(15,23,42,0.6)',
    color: 'var(--mzr-text-secondary)',
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    minWidth: 100,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s ease, border-color 0.2s ease'
  },
  actionButtonOutline: {},
  actionButtonPrimary: {
    border: '1px solid rgba(37,99,235,0.65)',
    background: 'var(--mzr-accent)',
    color: '#ffffff'
  },
  actionButtonMuted: {
    background: 'transparent',
    borderColor: 'rgba(124, 58, 237, 0.55)',
    color: '#ddd6fe'
  }
};

export const permissionPromptModeStyles: Record<Mode, Partial<Record<StyleKeys, CSSProperties>>> = {
  desktop: {},
  mobile: {
    shell: {
      top: '68px',
      padding: '0 12px',
      justifyContent: 'center'
    },
    card: {
      width: '98%'
    },
    badge: {
      fontSize: 32,
    },
    title: {
      fontSize: 38,
    },
    siteText: {
      fontSize: 34,
    },
    multiNote: {
      fontSize: 32,
    },
    permissionHint: {
      fontSize: 32,
    },
    rememberLabel: {
      fontSize: 33,
    },
    section: {
      padding: '18px 18px',
      gap: 14
    },
    permissionsList: {
      gap: 12
    },
    actions: {
      padding: '18px 18px',
      justifyContent: 'center'
    },
    actionButton: {
      flex: '1 1 auto',
      minWidth: 'auto',
      fontSize: 34
    }
  }
};
