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
    margin: '0 auto'
  },
  section: {
    background: '#111829',
    border: '1px solid rgba(148, 163, 184, 0.3)',
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
    color: '#cbd5f5',
    lineHeight: 1.4
  },
  button: {
    alignSelf: 'flex-start',
    background: 'rgba(37, 156, 255, 0.18)',
    border: '1px solid rgba(37, 156, 255, 0.45)',
    borderRadius: '10px',
    color: '#e0f2fe',
    padding: '10px 18px',
    fontSize: '16px',
    cursor: 'pointer'
  },
  viewer: {
    width: '95%',
    minHeight: '180px',
    maxHeight: '260px',
    background: '#05070f',
    border: '1px solid rgba(148, 163, 184, 0.2)',
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
