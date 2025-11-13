import type { CSSProperties } from 'react';
import type { Mode } from '../../types/models';

export const bookmarksModeStyles: Record<Mode, Partial<Record<string, CSSProperties>>> = {
  desktop: {},
  mobile: {
    heroTitle: { fontSize: 'clamp(42px, 6vw, 54px)' },
    badge: { fontSize: '18px' },
    section: { gap: '18px' },
    nodeRow: {
      flexDirection: 'column',
      alignItems: 'flex-start'
    },
    nodeActions: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '10px'
    },
    nodeTitle: {
      fontSize: 'clamp(24px, 5vw, 32px)'
    },
    smallButton: {
      width: '100%',
      textAlign: 'center'
    }
  }
};
