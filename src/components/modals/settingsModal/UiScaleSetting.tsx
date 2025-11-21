import React from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import type { Mode } from '../../../types/models';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';

const MIN_SCALE = 0.5;
const MAX_SCALE = 1.6;
const STEP = 0.1;

const clampScale = (value: number): number => {
  const rounded = Math.round(value * 10) / 10;
  return Number(Math.max(MIN_SCALE, Math.min(MAX_SCALE, rounded)).toFixed(1));
};

type UiScaleSettingProps = {
  mode: Mode;
  value: number;
  onChange: (value: number) => void;
  onReset: () => void;
};

const UiScaleSetting: React.FC<UiScaleSettingProps> = ({ mode, value, onChange, onReset }) => {
  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] ?? {};
  const mergeStyle = (key: keyof typeof settingsModalStyles): CSSProperties => ({
    ...styles[key],
    ...(modeStyles[key] ?? {})
  });
  const handleSlider = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value);
    if (Number.isFinite(parsed)) {
      onChange(clampScale(parsed));
    }
  };
  const handleStepper = (delta: number) => {
    onChange(clampScale(value + delta * STEP));
  };

  return (
    <div style={mergeStyle('scaleContainer')}>
      <div style={mergeStyle('scaleRow')}>
        <span style={mergeStyle('scaleLabel')}>UI scale</span>
        <span style={mergeStyle('scaleValue')}>{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={MIN_SCALE}
        max={MAX_SCALE}
        step={STEP}
        value={value}
        onChange={handleSlider}
        style={mergeStyle('scaleRange')}
        aria-label="UI scale"
      />
      <p style={mergeStyle('scaleHelper')}>
        Adjust the size of toolbars and controls. Does not change page zoom.
      </p>
      <div style={mergeStyle('scaleButtons')}>
        <button
          type="button"
          style={mergeStyle('scaleButton')}
          onClick={() => handleStepper(-1)}
          aria-label="Decrease UI scale"
        >
          −
        </button>
        <button
          type="button"
          style={mergeStyle('scaleButton')}
          onClick={onReset}
        >
          Reset
        </button>
        <button
          type="button"
          style={mergeStyle('scaleButton')}
          onClick={() => handleStepper(1)}
          aria-label="Increase UI scale"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default UiScaleSetting;
