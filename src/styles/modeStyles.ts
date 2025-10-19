import type { Mode } from '../types/models';
import type { CSSProperties } from 'react';

type ModeStyleMap = Partial<Record<string, CSSProperties>>;

export const modeStyles: Record<Mode, ModeStyleMap> = {
  desktop: {
    toolbarBtnRegular: { width: '40px', height: '40px' },
    toolbarBtnIcn: { width: '18px', height: '18px' },
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
    tabRow: {},
    tabTitle: {},
    tabSubtitle: {},
    tabFaviconWrap: {},
    tabFaviconFallback: {},
    tabIconButton: {},
    tabIcon: {},
    tabActions: {},
    newTabButton: {},
    settingsButton: {},
    settingsButtonIcon: {},
    settingsModalTitle: {},
    settingsBlock: {},
    settingsBlockTitle: {},
    settingsBlockBody: {},
    settingsAppRow: {},
    settingsAppHeader: {},
    settingsAppActions: {},
    settingsAppTitle: {},
    settingsAppUrl: {},
    settingsIconButton: {},
    settingsIcon: {},
    settingsLoading: {},
    settingsMessage: {}
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
      paddingRight: 'clamp(120px, 16vw, 144px)'
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
    },
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
    }
  }
};
