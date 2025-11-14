import type { CSSProperties } from 'react';
import type { Mode } from '../../types/models';

export const historyModeStyles: Record<Mode, Partial<Record<string, CSSProperties>>> = {
  desktop: {
    entryText: {
      maxWidth: '50%'
    },
    button: {}
  },
  mobile: {
    title: { fontSize: 'clamp(42px, 6vw, 54px)' },
    button: {
      fontSize: '45px'
    },
    groupTitle: {
      fontSize: '28px'
    },
    entryText: {
      maxWidth: '60%'
    },
    entryActions: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '10px'
    },
    entryTitle: {
      fontSize: 'clamp(28px, 5vw, 38px)',
      maxHeight: '44px',
      overflow: 'hidden',
      marginBottom: '10px'
    },
    entryUrl: {
      fontSize: '22px',
      maxHeight: '44px',
      overflow: 'hidden'
    },
    actionButton: {
      width: '100%',
      textAlign: 'center',
      fontSize: '35px'
    },
    favicon: {
      width: '55px',
      height: '55px'
    },
    searchInput: {
      fontSize: '38px'
    }
  }
};
