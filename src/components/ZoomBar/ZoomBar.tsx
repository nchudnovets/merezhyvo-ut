import React, { PointerEvent, ChangeEvent } from 'react';

interface ZoomBarProps {
  mode: string;
  styles: any;
  modeStyles: Record<string, any>;
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
  styles,
  modeStyles,
  zoomLevel,
  zoomDisplay,
  min,
  max,
  step,
  onPointerDown,
  onChange
}) => (
  <div className="zoom-toolbar" style={styles.bottomToolbar}>
    <span style={styles.zoomLabel}>Zoom</span>
    <div style={styles.zoomSliderContainer}>
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
        style={{ ...styles.zoomSlider, ...modeStyles[mode].zoomSlider }}
      />
    </div>
    <span style={{ ...styles.zoomValue, ...modeStyles[mode].zoomValue }}>{zoomDisplay}</span>
  </div>
);

export default ZoomBar;
