import type { CSSProperties } from 'react';

type ToastCenterStyleKeys =
  | 'container'
  | 'toast'
  | 'icon'
  | 'content'
  | 'title'
  | 'body'
  | 'dismiss';

export const toastCenterStyles: Record<ToastCenterStyleKeys, CSSProperties> = {
  container: {
    position: 'fixed',
    right: 18,
    bottom: 18,
    zIndex: 10001,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    pointerEvents: 'none'
  },
  toast: {
    width: 'min(380px, 92vw)',
    display: 'grid',
    gridTemplateColumns: '40px 1fr',
    gap: 12,
    padding: '12px 16px',
    borderRadius: 16,
    border: '1px solid rgba(148,163,184,0.25)',
    background: 'linear-gradient(165deg, rgba(17,24,39,0.92), rgba(11,15,25,0.88))',
    boxShadow: '0 22px 48px rgba(5,10,26,0.45)',
    backdropFilter: 'blur(18px)',
    color: '#f1f5f9',
    pointerEvents: 'auto',
    transition: 'transform 160ms ease, opacity 160ms ease',
    alignItems: 'center'
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.25)',
    background: 'rgba(148,163,184,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0
  },
  title: {
    fontWeight: 700,
    fontSize: 15,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  body: {
    marginTop: 4,
    fontSize: 13.5,
    lineHeight: 1.4,
    color: '#cbd5f5',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  },
  dismiss: {
    marginTop: 10,
    padding: '7px 12px',
    fontSize: 12,
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,0.35)',
    background: 'rgba(15,23,42,0.6)',
    color: '#e2e8f0',
    cursor: 'pointer',
    fontWeight: 600,
    letterSpacing: '0.02em',
    alignSelf: 'flex-start'
  }
};
