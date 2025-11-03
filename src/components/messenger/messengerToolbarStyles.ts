import type { CSSProperties } from 'react';
import type { Mode } from '../../types/models';

export const messengerToolbarStyles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '8px 16px',
    backgroundColor: '#121826',
    boxShadow: '0 1px 6px rgba(0, 0, 0, 0.35)',
    zIndex: 10
  } satisfies CSSProperties,
  list: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: '1 1 auto',
    minWidth: 0
  } satisfies CSSProperties,
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderRadius: '16px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#1c2333',
    color: '#f8fafc',
    padding: '8px 14px',
    minHeight: '44px',
    minWidth: '0',
    flex: '1 1 0',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
  } satisfies CSSProperties,
  buttonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    color: '#f8fafc',
    boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.25)'
  } satisfies CSSProperties,
  icon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'inherit'
  } satisfies CSSProperties,
  label: {
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '.01em',
    whiteSpace: 'nowrap'
  } satisfies CSSProperties,
  exitButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderRadius: '16px',
    padding: '8px 16px',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    backgroundColor: '#1c2333',
    color: '#f8fafc',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
  } satisfies CSSProperties,
  exitButtonActive: {
    backgroundColor: '#1f2937',
    borderColor: '#2563eb'
  } satisfies CSSProperties
};

type MessengerToolbarModeStyles = Partial<Record<keyof typeof messengerToolbarStyles, CSSProperties>>;

export const messengerToolbarModeStyles: Record<Mode, MessengerToolbarModeStyles> = {
  desktop: {
    button: {
      fontSize: '15px'
    },
    exitButton: {
      fontSize: '14px'
    }
  },
  mobile: {
    container: {
      padding: '6px 10px',
      gap: '8px'
    },
    list: {
      gap: '6px'
    },
    button: {
      padding: '6px 10px',
      minHeight: '40px',
      fontSize: '13px'
    },
    label: {
      fontSize: '13px'
    },
    exitButton: {
      padding: '6px 12px',
      fontSize: '13px'
    }
  }
};
