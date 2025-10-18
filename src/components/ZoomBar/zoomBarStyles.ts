import { CSSProperties } from 'react';
import type { Mode } from '../../types/models';

type ZoomBarStyleKey =
  | 'bottomToolbar'
  | 'zoomLabel'
  | 'zoomSliderContainer'
  | 'zoomSlider'
  | 'zoomValue';

type ZoomBarModeVariant = {
  zoomLabel?: CSSProperties;
  zoomSlider?: CSSProperties;
  zoomValue?: CSSProperties;
};

export const zoomBarStyles: Record<ZoomBarStyleKey, CSSProperties> = {
  bottomToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '6px 50px',
    backgroundColor: '#121826',
    borderTop: '1px solid rgba(148, 163, 184, 0.18)',
    position: 'relative',
    zIndex: 5,
    flexShrink: 0
  },
  zoomLabel: {
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: '#94a3b8'
  },
  zoomSliderContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center'
  },
  zoomSlider: {
    flex: 1,
    minWidth: 0,
    touchAction: 'none'
  },
  zoomValue: {
    color: '#f8fafc',
    fontVariantNumeric: 'tabular-nums'
  }
};

export const zoomBarModeStyles: Record<Mode, ZoomBarModeVariant> = {
  desktop: {
    zoomLabel: { fontSize: '12px' },
    zoomSlider: { height: '4px' },
    zoomValue: { fontSize: '12px', minWidth: '48px', textAlign: 'right' }
  },
  mobile: {
    zoomLabel: { fontSize: 'clamp(24px, 3.3vw, 28px)' },
    zoomSlider: { height: 'clamp(14px, 2.2vw, 20px)' },
    zoomValue: {
      minWidth: 'clamp(80px, 12vw, 108px)',
      textAlign: 'right',
      fontSize: 'clamp(24px, 3.3vw, 28px)'
    }
  }
};
