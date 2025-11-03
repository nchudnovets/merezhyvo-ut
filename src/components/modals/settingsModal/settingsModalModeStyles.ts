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
    settingsAboutDescription: {},
    settingsTorInfoValue: {},
    settingsTorInputLabel: {},
    settingsTorInput: {},
    settingsTorInputHint: {},
    settingsTorMessage: {},
    settingsTorSaveButton: {},
    settingsKeyboardToggleButton: {},
    settingsKeyboardSavedPill: {},
    settingsKeyboardLayoutsList: {},
    settingsKeyboardLayoutRow: {},
    settingsKeyboardLayoutCode: {},
    settingsKeyboardLayoutId: {},
    settingsKeyboardRadioLabel: {},
    settingsKeyboardInput: {
      width: '25px',
      height: '25px'
    },
    settingsKeyboardActions: {},
    settingsKeyboardHeaderActions: {},
    settingsMessengerRow: {},
    settingsMessengerActionButton: {},
    settingsMessengerActionIcn: {
      width: '20px'
    },
    settingsMessengerName: {},
    settingsMessengerUrl: {},
    settingsMessengerMessage: {},
    settingsMessengerHint: {}
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
    },
    settingsTorInfoValue: {
      fontSize: 'clamp(36px, 5vw, 45px)'
    },
    settingsTorInputLabel: {
      fontSize: 'clamp(33px, 4.8vw, 42px)'
    },
    settingsTorInput: {
      height: 'clamp(78px, 10vw, 96px)',
      borderRadius: '24px',
      fontSize: 'clamp(33px, 4.8vw, 42px)',
      padding: '0 clamp(36px, 5vw, 48px)'
    },
    settingsTorInputHint: {
      fontSize: 'clamp(30px, 4.5vw, 39px)'
    },
    settingsTorMessage: {
      fontSize: 'clamp(30px, 4.5vw, 39px)'
    },
    settingsTorSaveButton: {
      height: 'clamp(78px, 10vw, 96px)',
      borderRadius: '24px',
      padding: '0 clamp(42px, 6vw, 60px)',
      fontSize: 'clamp(33px, 4.8vw, 42px)'
    },
    settingsKeyboardToggleButton: {
      width: 'clamp(65px, 12vw, 108px)',
      height: 'clamp(84px, 12vw, 108px)',
      borderRadius: '28px',
      fontSize: 'clamp(42px, 6vw, 52px)'
    },
    settingsKeyboardSavedPill: {
      fontSize: 'clamp(30px, 4.6vw, 38px)',
      letterSpacing: '0.14em',
      padding: 'clamp(10px, 1.8vw, 18px) clamp(26px, 4vw, 38px)'
    },
    settingsKeyboardLayoutsList: {
      maxHeight: 'clamp(620px, 60vh, 720px)',
      gap: 'clamp(28px, 4.4vw, 36px)',
      paddingRight: 'clamp(18px, 3vw, 26px)'
    },
    settingsKeyboardLayoutRow: {
      gap: 'clamp(22px, 3.6vw, 32px)',
      padding: 'clamp(32px, 4.8vw, 40px)',
      borderRadius: '32px'
    },
    settingsKeyboardLayoutCode: {
      width: 'clamp(140px, 18vw, 180px)',
      fontSize: 'clamp(42px, 6vw, 54px)'
    },
    settingsKeyboardLayoutId: {
      fontSize: 'clamp(33px, 4.8vw, 40px)'
    },
    settingsKeyboardRadioLabel: {
      gap: 'clamp(20px, 3.4vw, 30px)',
      fontSize: 'clamp(33px, 4.8vw, 40px)'
    },
    settingsKeyboardInput: {
      width: '50px',
      height: '50px'
    },
    settingsKeyboardActions: {
      gap: 'clamp(30px, 4.6vw, 38px)'
    },
    settingsKeyboardHeaderActions: {
      gap: 'clamp(22px, 3.5vw, 30px)'
    },
    settingsMessengerRow: {
      gap: 'clamp(24px, 4vw, 32px)',
      padding: 'clamp(36px, 5vw, 48px)',
      borderRadius: '32px'
    },
    settingsMessengerActionButton: {
      width: 'clamp(78px, 11vw, 96px)',
      height: 'clamp(78px, 11vw, 96px)',
      borderRadius: '26px'
    },
    settingsMessengerActionIcn: {
      width: '65px'
    },
    settingsMessengerName: {
      fontSize: 'clamp(36px, 5.5vw, 48px)'
    },
    settingsMessengerUrl: {
      fontSize: 'clamp(30px, 4.5vw, 38px)'
    },
    settingsMessengerMessage: {
      fontSize: 'clamp(30px, 4.5vw, 38px)'
    },
    settingsMessengerHint: {
      fontSize: 'clamp(30px, 4.5vw, 38px)'
    }
  }
};
