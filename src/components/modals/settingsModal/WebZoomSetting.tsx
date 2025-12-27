import React from 'react';
import type { ChangeEvent, CSSProperties } from 'react';
import type { Mode } from '../../../types/models';
import { useI18n } from '../../../i18n/I18nProvider';
import { settingsModalStyles } from './settingsModalStyles';
import { settingsModalModeStyles } from './settingsModalModeStyles';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.5;
const STEP = 0.05;

const clampZoom = (value: number): number => {
  const steps = Math.round(value / STEP);
  const rounded = steps * STEP;
  const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rounded));
  return Number(clamped.toFixed(2));
};

type WebZoomSettingProps = {
  mode: Mode;
  mobileValue: number;
  desktopValue: number;
  onMobileChange: (v: number) => void;
  onDesktopChange: (v: number) => void;
};

export const WebZoomSetting: React.FC<WebZoomSettingProps> = ({
  mode,
  mobileValue,
  desktopValue,
  onMobileChange,
  onDesktopChange
}) => {
  const { t } = useI18n();
  const styles = settingsModalStyles;
  const modeStyles = settingsModalModeStyles[mode] ?? {};
  const mergeStyle = (key: keyof typeof settingsModalStyles): CSSProperties => ({
    ...styles[key],
    ...(modeStyles[key] ?? {})
  });

  const handleSlider = (handler: (v: number) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value);
    if (Number.isFinite(parsed)) {
      handler(clampZoom(parsed));
    }
  };

  const renderRow = (label: string, value: number, onChange: (v: number) => void) => (
    <div style={{ ...mergeStyle('scaleContainer'), marginTop: 4 }}>
      <div style={mergeStyle('scaleRow')}>
        <span style={mergeStyle('scaleLabel')}>{label}</span>
        <span style={mergeStyle('scaleValue')}>{(value * 100).toFixed(0)}%</span>
      </div>
      <input
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={STEP}
        value={value}
        onChange={handleSlider(onChange)}
        style={mergeStyle('scaleRange')}
      />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={mergeStyle('scaleRow')}>
        <span style={mergeStyle('scaleLabel')}>{t('settings.webzoom.title')}</span>
      </div>
      {renderRow(t('settings.webzoom.mobile'), mobileValue, onMobileChange)}
      {renderRow(t('settings.webzoom.desktop'), desktopValue, onDesktopChange)}
    </div>
  );
};

export default WebZoomSetting;
