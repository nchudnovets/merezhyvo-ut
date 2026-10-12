import type { CSSProperties } from 'react';
import type { Mode } from '../../types/models';

import type { HistoryStyleKeys } from './historyStyles';

export const historyModeStyles: Record<Mode, Partial<Record<HistoryStyleKeys, CSSProperties>>> = {
  desktop: {
    actionToggle: {
      padding: '6px 8px'
    },
    button: {}
  },
  mobile: {
    container: {
      padding: '28px',
      maxWidth: 'none'
    },
    header: {
      alignItems: 'flex-start'
    },
    headerTitle: {
      gap: '14px'
    },
    title: { fontSize: 'clamp(42px, 6vw, 54px)' },
    button: {
      fontSize: '45px'
    },
    groupTitle: {
      fontSize: '28px'
    },
    groupCount: {
      fontSize: '24px'
    },
    entryText: {
      maxWidth: '60%'
    },
    entryActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end'
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
    actionToggle: {
      padding: '10px',
      borderRadius: '12px',
      width: '64px',
      height: '64px'
    },
    favicon: {
      width: '55px',
      height: '55px'
    },
    searchField: {
      minHeight: '76px'
    },
    searchIcon: {
      left: '20px'
    },
    searchInput: {
      height: '76px',
      paddingLeft: '74px',
      paddingRight: '74px',
      fontSize: '38px'
    },
    searchClear: {
      width: '58px',
      height: '58px',
      right: '10px'
    },
    feedback: {
      fontSize: '35px'
    },
    entryMeta: {
      fontSize: '22px'
    },
    emptyState: {
      marginTop: '72px',
      gap: '16px'
    },
    emptyIcon: {
      width: '92px',
      height: '92px',
      borderRadius: '28px'
    },
    emptyTitle: {
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
