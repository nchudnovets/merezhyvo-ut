import type { CSSProperties } from 'react';

export const licensesStyles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    padding: '20px',
    height: '100%',
    boxSizing: 'border-box',
    maxWidth: '800px',
    margin: '0 auto',
    overflow: 'auto'
  },
  section: {
    background: 'var(--mzr-surface-transparent)',
    border: '1px solid var(--mzr-border)',
    borderRadius: '16px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  lead: {
    fontSize: '20px',
    fontWeight: 600
  },
  subtext: {
    fontSize: '16px',
    color: 'var(--mzr-text-secondary)',
    lineHeight: 1.4
  },
  button: {
    alignSelf: 'flex-start',
    background: 'var(--mzr-accent)',
    border: '1px solid var(--mzr-accent-strong)',
    borderRadius: '10px',
    color: '#fff',
    padding: '10px 18px',
    fontSize: '16px',
    cursor: 'pointer'
  },
  viewer: {
    width: '95%',
    minHeight: '180px',
    maxHeight: '260px',
    background: 'var(--mzr-surface-weak)',
    border: '1px solid var(--mzr-border)',
    borderRadius: '12px',
    padding: '12px',
    fontFamily: 'monospace, monospace',
    whiteSpace: 'pre-wrap',
    overflow: 'auto',
    fontSize: '14px'
  },
  banner: {
    background: 'rgba(220, 38, 38, 0.9)',
    color: '#fff',
    padding: '10px 14px',
    borderRadius: '10px',
    fontSize: '13px'
  }
};
