import React, { type PointerEvent, type ChangeEvent } from 'react';
import type { Mode } from '../../types/models';
import { zoomBarStyles, zoomBarModeStyles } from './zoomBarStyles';

interface ZoomBarProps {
  mode: Mode;
  zoomLevel: number;
  zoomDisplay: string;
  min: number;
  max: number;
  step: number;
  onPointerDown: (event: PointerEvent<HTMLInputElement>) => void;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const ZoomBar: React.FC<ZoomBarProps> = ({
  mode,
  zoomLevel,
  zoomDisplay,
  min,
  max,
  step,
  onPointerDown,
  onChange
}) => (
  <div className="zoom-toolbar" style={zoomBarStyles.bottomToolbar}>
    <span style={{ ...zoomBarStyles.zoomLabel, ...(zoomBarModeStyles[mode].zoomLabel || {}) }}>Zoom</span>
    <div style={zoomBarStyles.zoomSliderContainer}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={zoomLevel}
        onPointerDown={onPointerDown}
        onInput={onChange}
        onChange={onChange}
        aria-label="Zoom level"
        className="zoom-slider"
        style={{ ...zoomBarStyles.zoomSlider, ...(zoomBarModeStyles[mode].zoomSlider || {}) }}
      />
    </div>
    <span style={{ ...zoomBarStyles.zoomValue, ...(zoomBarModeStyles[mode].zoomValue || {}) }}>{zoomDisplay}</span>
  </div>
);

export default ZoomBar;
