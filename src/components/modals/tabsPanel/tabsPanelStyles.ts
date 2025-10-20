import type { CSSProperties } from 'react';

type StyleRecord = Record<string, CSSProperties>;

export const tabsPanelStyles: StyleRecord = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(10, 12, 22, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px',
    zIndex: 160
  },
  container: {
    width: 'min(520px, 94vw)',
    maxHeight: 'min(620px, 90vh)',
    borderRadius: '28px',
    border: '1px solid rgba(59, 130, 246, 0.35)',
    background: 'rgba(11, 15, 28, 0.96)',
    boxShadow: '0 24px 60px rgba(2, 6, 23, 0.6)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '20px'
  },
  containerMobile: {
    width: '100%',
    height: '100vh',
    borderRadius: 0,
    border: '1px solid rgba(59, 130, 246, 0.35)',
    background: 'rgba(11, 15, 28, 0.98)',
    boxShadow: '0 -18px 50px rgba(2, 6, 23, 0.65)',
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
  newTabButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    height: '38px',
    borderRadius: '14px',
    border: '1px solid rgba(59, 130, 246, 0.45)',
    background: 'rgba(37, 99, 235, 0.15)',
    color: '#f8fafc',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  newTabButtonMobile: {
    height: 'clamp(105px, 13.5vh, 144px)',
    borderRadius: '24px',
    border: '1px solid rgba(59, 130, 246, 0.45)',
    background: 'rgba(37, 99, 235, 0.22)',
    color: '#f8fafc',
    fontSize: 'clamp(39px, 5.7vw, 51px)',
    fontWeight: 600,
    cursor: 'pointer'
  },
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto',
    paddingRight: '4px'
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  sectionTitle: {
    margin: 0,
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#94a3b8'
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  tabRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    borderRadius: '14px',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
  },
  tabRowActive: {
    borderColor: 'rgba(59, 130, 246, 0.65)',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.25)'
  },
  tabInfo: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0
  },
  faviconWrap: {
    width: '20px',
    height: '20px',
    borderRadius: '6px',
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0
  },
  favicon: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  faviconFallback: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: 600
  },
  tabTexts: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0
  },
  tabTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#f8fafc',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  tabSubtitle: {
    fontSize: '12px',
    color: '#94a3b8',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  tabActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  tabIconButton: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(15, 23, 42, 0.65)',
    color: '#cbd5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  tabIconButtonActive: {
    borderColor: 'rgba(59, 130, 246, 0.7)',
    background: 'rgba(37, 99, 235, 0.22)',
    color: '#e0f2fe'
  },
  tabIcon: {
    width: '16px',
    height: '16px'
  }
} as const;
