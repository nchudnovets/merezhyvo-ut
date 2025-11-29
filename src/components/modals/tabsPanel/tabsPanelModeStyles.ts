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
    newTabButton: {},
    header: {},
    controlRow: {},
    searchInput: {},
    searchToggleButton: {},
    searchToggleIcon: {},
    activeSeparator: {}
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
      padding: '30px',
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
      gap: '15px'
    },
    feedbackBanner: {
      padding: 'clamp(24px, 3vh, 36px) clamp(30px, 4vw, 48px)',
      borderRadius: '28px',
      fontSize: 'clamp(36px, 5.2vw, 48px)'
    },
    newTabButton: {
      borderRadius: '32px',
      fontSize: 'clamp(42px, 6vw, 54px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      padding: '22px',
      width: '80%',
      height: '105px'
    },
    header: {
      alignItems: 'start',
    },
    headerButtons: {
      gap: '18px',
      flexWrap: 'nowrap'
    },
    headerButton: {
      padding: '6px 22px',
      fontSize: 'clamp(42px, 6vw, 54px)'
    },
    controlRow: {
      gap: '18px',
      flexWrap: 'wrap'
    },
    searchInput: {
      fontSize: '50px',
      height: '105px'
    },
    searchToggleButton: {
      width: '108px',
      height: '108px',
      padding: '30px',
      borderRadius: '20px'
    },
    searchToggleIcon: {
      width: '80px',
      height: '80px'
    },
    activeSeparator: {
      margin: '12px 0'
    }
  }
};
