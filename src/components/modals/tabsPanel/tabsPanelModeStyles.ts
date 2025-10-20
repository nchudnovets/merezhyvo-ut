import type { CSSProperties } from 'react';
import type { Mode } from '../../../types/models';

type ModeStyleMap = Record<Mode, Partial<Record<string, CSSProperties>>>;

export const tabsPanelModeStyles: ModeStyleMap = {
  desktop: {
    tabsPanelTitle: {},
    tabsPanelBody: {},
    tabsSectionTitle: {},
    tabRow: {},
    tabFaviconWrap: {},
    tabFaviconFallback: {},
    tabTitle: {},
    tabSubtitle: {},
    tabIconButton: {},
    tabIcon: {},
    tabActions: {},
    newTabButton: {}
  },
  mobile: {
    tabsPanelTitle: {
      fontSize: 'clamp(54px, 7vw, 66px)'
    },
    tabsPanelBody: {
      gap: 'clamp(24px, 4vh, 36px)'
    },
    tabsSectionTitle: {
      fontSize: 'clamp(30px, 4.5vw, 39px)'
    },
    tabRow: {
      padding: 'clamp(30px, 5vw, 48px)',
      borderRadius: '28px'
    },
    tabFaviconWrap: {
      width: 'clamp(66px, 10vw, 84px)',
      height: 'clamp(66px, 10vw, 84px)',
      borderRadius: '20px'
    },
    tabFaviconFallback: {
      fontSize: 'clamp(27px, 4vw, 36px)'
    },
    tabTitle: {
      fontSize: 'clamp(42px, 6vw, 54px)'
    },
    tabSubtitle: {
      fontSize: 'clamp(30px, 4.8vw, 42px)'
    },
    tabIconButton: {
      width: 'clamp(96px, 14vw, 120px)',
      height: 'clamp(96px, 14vw, 120px)',
      borderRadius: '24px'
    },
    tabIcon: {
      width: 'clamp(42px, 6vw, 54px)',
      height: 'clamp(42px, 6vw, 54px)'
    },
    tabActions: {
      gap: 'clamp(30px, 5vw, 45px)'
    },
    newTabButton: {
      height: 'clamp(120px, 14vh, 168px)',
      borderRadius: '32px',
      fontSize: 'clamp(42px, 6vw, 54px)'
    }
  }
};

