import type { CSSProperties } from 'react';
import type { Mode } from '../../types/models';

import type { HistoryStyleKeys } from './historyStyles';

export const historyModeStyles: Record<Mode, Partial<Record<HistoryStyleKeys, CSSProperties>>> = {
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
    },
    confirmPanel: {
      width: 'min(95vw, 95vw)',
      padding: '32px',
      minWidth: '320px',
      borderRadius: '28px'
    },
    confirmTitle: {
      fontSize: 'clamp(40px, 5vw, 48px)'
    },
    confirmMessage: {
      fontSize: 'clamp(32px, 4.5vw, 42px)'
    },
    confirmButton: {
      fontSize: 'clamp(36px, 5vw, 50px)',
      width: '100%'
    },
    confirmActions: {
      flexDirection: 'column',
      alignItems: 'stretch'
    }
  }
};
