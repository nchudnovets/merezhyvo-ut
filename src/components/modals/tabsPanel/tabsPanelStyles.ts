import type { CSSProperties } from 'react';

type StyleRecord = Record<string, CSSProperties>;

export const tabsPanelStyles: StyleRecord = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'var(--mzr-overlay)',
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
    background: 'var(--mzr-surface-elevated)',
    boxShadow: '0 24px 60px rgba(2, 6, 23, 0.6)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '15px',
    position: 'relative'
  },
  containerMobile: {
    width: '100%',
    height: '93vh',
    borderRadius: '28px',
    border: '1px solid rgba(59, 130, 246, 0.35)',
    background: 'var(--mzr-surface-elevated)',
    boxShadow: '0 -18px 50px rgba(2, 6, 23, 0.65)',
    display: 'flex',
    flexDirection: 'column',
    padding: 'calc(2vh) calc(4vw)',
    gap: 'calc(2vh)',
    boxSizing: 'border-box',
    position: 'relative'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap' as const
  },
  headerButtons: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  headerButton: {
    // borderRadius: '12px',
    border: 'none',
    borderBottom: '1px solid rgba(148, 163, 184, 0.42)',
    padding: '6px 12px',
    // background: 'rgba(17, 24, 39, 0.6)',
    background: 'transparent',
    color: 'var(--mzr-text-primary)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    height: '34px'
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
    gap: '8px',
    height: '34px',
    minWidth: '130px',
    width: '90%',
    borderRadius: '14px',
    border: '1px solid rgba(59, 130, 246, 0.45)',
    background: 'rgba(37, 99, 235, 0.15)',
    color: 'var(--mzr-text-primary)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  newTabButtonMobile: {
    position: 'absolute',
    right: '24px',
    bottom: '24px',
    width: '150px',
    height: '150px',
    borderRadius: '50%',
    background: '#295CFD',
    border: '1px solid rgba(37, 99, 235, 0.6)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 12px 30px rgba(18, 44, 120, 0.45)'
  },
  controlRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    justifyContent: 'space-between',
    marginBottom: '10px'
  },
  searchInput: {
    flex: 1,
    minWidth: '200px',
    height: '38px',
    padding: '0 12px',
    borderRadius: '12px',
    border: '1px solid var(--mzr-border)',
    background: 'var(--mzr-surface-weak)',
    color: 'var(--mzr-text-primary)',
    fontSize: '14px',
    fontWeight: 500,
    boxSizing: 'border-box'
  },
  searchToggleButton: {
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    border: 'none',
    background: 'rgba(148, 163, 184, 0.1)',
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchToggleIcon: {
    width: '20px',
    height: '20px'
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
    fontSize: '15px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--mzr-text-muted)',
    marginTop: '10px'
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  tabRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '20px 14px',
    borderTop: '1px solid var(--mzr-divider)',
    cursor: 'pointer',
  },
  tabRowActive: {
    borderColor: 'var(--mzr-border-strong)',
    backgroundColor: 'var(--mzr-accent-tint)',
    boxShadow: '0 0 0 1px rgba(37, 99, 235, 0.35)'
  },
  tabInfo: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0
  },
  faviconWrap: {
    width: '30px',
    height: '30px',
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
    color: 'var(--mzr-text-muted)',
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
    color: 'var(--mzr-text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  tabSubtitle: {
    fontSize: '12px',
    color: 'var(--mzr-text-muted)',
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
    border: 'none',
    background: 'transparent',
    color: 'var(--mzr-text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  tabIconButtonActive: {
    border: '1px solid var(--mzr-accent-strong)',
    background: 'var(--mzr-accent-tint)',
    color: 'var(--mzr-accent-strong)'
  },
  tabIcon: {
    width: '16px',
    height: '16px'
  },
  feedbackBanner: {
    alignSelf: 'stretch',
    padding: '10px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(34, 197, 94, 0.45)',
    background: 'var(--mzr-surface-elevated, var(--mzr-surface))',
    color: 'var(--mzr-text-primary)',
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '0.01em'
  },
  activeSeparator: {
    height: '1px',
    width: '100%',
    backgroundColor: 'var(--mzr-border)',
    margin: '6px 0'
  }
} as const;
