import type { CSSProperties } from 'react';
import type { Mode } from '../../types/models';

export const licensesModeStyles: Record<Mode, Partial<Record<string, CSSProperties>>> = {
  desktop: {
    container: {},
    section: {},
    lead: {},
    subtext: {},
    button: {},
    viewer: {},
    banner: {}
  },
  mobile: {
    container: {
      padding: '28px',
      maxWidth: '100%'
    },
    section: {
      gap: '16px',
      padding: '24px',
      borderRadius: '20px'
    },
    lead: {
      fontSize: '42px'
    },
    subtext: {
      fontSize: '35px'
    },
    button: {
      fontSize: '35px',
      padding: '14px 22px',
      borderRadius: '14px'
    },
    viewer: {
      fontSize: '32px',
      maxHeight: '60vh'
    },
    banner: {
      fontSize: '35px'
    }
  }
};
