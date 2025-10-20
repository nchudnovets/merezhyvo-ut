import type { CSSProperties } from 'react';
import type { Mode } from '../../types/models';
import { styles as baseStyles } from '../../styles/styles';
import { modeStyles as baseModeStyles } from '../../styles/modeStyles';

export const zoomBarStyles = {
  bottomToolbar: baseStyles.bottomToolbar,
  zoomLabel: baseStyles.zoomLabel,
  zoomSliderContainer: baseStyles.zoomSliderContainer,
  zoomSlider: baseStyles.zoomSlider,
  zoomValue: baseStyles.zoomValue
} as const;

export const zoomBarModeStyles: Record<Mode, Partial<Record<string, CSSProperties>>> = {
  desktop: {
    zoomLabel: baseModeStyles.desktop.zoomLabel,
    zoomSlider: baseModeStyles.desktop.zoomSlider,
    zoomValue: baseModeStyles.desktop.zoomValue
  },
  mobile: {
    zoomLabel: baseModeStyles.mobile.zoomLabel,
    zoomSlider: baseModeStyles.mobile.zoomSlider,
    zoomValue: baseModeStyles.mobile.zoomValue
  }
} as const;
