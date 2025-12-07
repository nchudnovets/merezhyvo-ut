import type { Mode } from '../types/models';
import type { CSSProperties } from 'react';

type ModeStyleMap = Partial<Record<string, CSSProperties>>;

export const modeStyles: Record<Mode, ModeStyleMap> = {
  desktop: {
    toolbarBtnRegular: { width: '40px', height: '40px' },
    toolbarBtnIcn: { width: '25px', height: '25px' },
    toolbarBtnDesktopOnly: {},
    searchInput: { fontSize: '14px', height: '36px', paddingRight: '56px' },
    makeAppBtn: { width: '36px', height: '26px' },
    makeAppBtnIcn: { width: '16px', height: '16px' },
    statusIcon: { width: '14px', height: '14px' },
    zoomLabel: { fontSize: '12px' },
    zoomSlider: { height: '4px' },
    zoomValue: { fontSize: '12px', minWidth: '48px', textAlign: 'right' },
    tabsButton: {},
    tabsButtonSquare: {},
    tabsButtonCount: {},
    settingsButton: {},
    settingsButtonIcon: {}
  },
  mobile: {
    toolbarBtnRegular: {
      width: 'clamp(72px, 10vw, 96px)',
      height: 'clamp(72px, 10vw, 96px)'
    },
    toolbarBtnIcn: {
      width: 'clamp(36px, 5vw, 48px)',
      height: 'clamp(36px, 5vw, 48px)'
    },
    toolbarBtnDesktopOnly: { display: 'none' },
    searchInput: {
      fontSize: '36px',
      height: 'clamp(72px, 10vw, 96px)',
      paddingRight: '30px'
    },
    makeAppBtn: {
      width: 'clamp(60px, 9vw, 84px)',
      height: 'clamp(60px, 9vw, 84px)'
    },
    makeAppBtnIcn: {
      width: 'clamp(32px, 5vw, 42px)',
      height: 'clamp(32px, 5vw, 42px)'
    },
    statusIcon: {
      width: 'clamp(22px, 3.5vw, 28px)',
      height: 'clamp(22px, 3.5vw, 28px)'
    },
    zoomLabel: { fontSize: 'clamp(24px, 3.3vw, 28px)' },
    zoomSlider: { height: 'clamp(14px, 2.2vw, 20px)' },
    zoomValue: {
      minWidth: 'clamp(80px, 12vw, 108px)',
      textAlign: 'right',
      fontSize: 'clamp(24px, 3.3vw, 28px)'
    },
    tabsButton: {
      width: 'clamp(72px, 10vw, 96px)',
      height: 'clamp(72px, 10vw, 96px)',
      borderRadius: '24px'
    },
    tabsButtonSquare: {
      width: 'clamp(44px, 6.5vw, 60px)',
      height: 'clamp(44px, 6.5vw, 60px)',
      borderRadius: '16px',
      border: '2px solid rgba(148, 163, 184, 0.55)'
    },
    tabsButtonCount: {
      fontSize: 'clamp(30px, 4.8vw, 38px)'
    },
    settingsButton: {
      height: 'clamp(72px, 10vw, 96px)',
      width: 'clamp(72px, 10vw, 96px)',
      borderRadius: '24px',
      fontSize: 'clamp(30px, 4.8vw, 38px)'
    },
    settingsButtonIcon: {
      width: 'clamp(36px, 5vw, 48px)',
      height: 'clamp(36px, 5vw, 48px)'
    }
  }
};
