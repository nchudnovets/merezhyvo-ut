import type { CSSProperties } from 'react';
import type { Mode } from '../../../types/models';

type ModeStyleMap = Record<Mode, Partial<Record<string, CSSProperties>>>;

export const settingsModalModeStyles: ModeStyleMap = {
  desktop: {
    settingsModalTitle: {},
    settingsBlock: {},
    settingsBlockTitle: {},
    settingsBlockBody: {},
    settingsAppRow: {},
    settingsAppTitle: {},
    settingsAppUrl: {},
    settingsAppActions: {},
    settingsLoading: {},
    settingsIconButton: {},
    settingsIcon: {},
    settingsConfirmText: {},
    settingsConfirmButton: {},
    settingsMessage: {},
    settingsAboutCard: {},
    settingsAboutName: {},
    settingsAboutVersion: {},
    settingsAboutDescription: {}
  },
  mobile: {
    settingsModalTitle: {
      fontSize: 'clamp(54px, 7vw, 66px)'
    },
    settingsBlock: {
      borderRadius: '30px',
      padding: 'clamp(36px, 5vw, 48px)',
      gap: 'clamp(30px, 4.8vw, 36px)'
    },
    settingsBlockTitle: {
      fontSize: 'clamp(30px, 4.5vw, 36px)',
      letterSpacing: '0.12em'
    },
    settingsBlockBody: {
      gap: 'clamp(24px, 4vh, 36px)'
    },
    settingsAppRow: {
      gap: 'clamp(30px, 4.5vw, 42px)',
      padding: 'clamp(42px, 5.5vw, 54px)',
      borderRadius: '32px'
    },
    settingsAppTitle: {
      fontSize: 'clamp(39px, 5.7vw, 51px)'
    },
    settingsAppUrl: {
      fontSize: 'clamp(30px, 4.8vw, 36px)'
    },
    settingsAppActions: {
      justifyContent: 'flex-end'
    },
    settingsLoading: {
      fontSize: 'clamp(27px, 4vw, 33px)'
    },
    settingsIconButton: {
      width: 'clamp(72px, 10vw, 96px)',
      height: 'clamp(72px, 10vw, 96px)',
      borderRadius: '24px'
    },
    settingsIcon: {
      width: 'clamp(36px, 5vw, 48px)',
      height: 'clamp(36px, 5vw, 48px)'
    },
    settingsConfirmText: {
      fontSize: 'clamp(33px, 5vw, 45px)'
    },
    settingsConfirmButton: {
      minWidth: 'clamp(210px, 34vw, 280px)',
      height: 'clamp(72px, 10vw, 96px)',
      borderRadius: '24px',
      fontSize: 'clamp(30px, 4.8vw, 36px)'
    },
    settingsMessage: {
      fontSize: 'clamp(30px, 4.8vw, 36px)',
      padding: 'clamp(30px, 4.5vw, 42px)',
      borderRadius: '30px'
    },
    settingsAboutCard: {
      padding: 'clamp(42px, 5.5vw, 54px)',
      borderRadius: '32px',
      gap: 'clamp(18px, 3vw, 28px)'
    },
    settingsAboutName: {
      fontSize: 'clamp(48px, 6.5vw, 60px)'
    },
    settingsAboutVersion: {
      fontSize: 'clamp(36px, 5vw, 45px)'
    },
    settingsAboutDescription: {
      fontSize: 'clamp(33px, 4.8vw, 42px)'
    }
  }
};
