import React from 'react';
import type { CSSProperties } from 'react';
import type { Mode } from '../../../types/models';
import { useI18n } from '../../../i18n/I18nProvider';

export type DownloadSettingsSectionProps = {
  mode: Mode;
  defaultDir: string;
  concurrent: 1 | 2 | 3;
  saving: boolean;
  onConcurrentChange: (value: 1 | 2 | 3) => void;
  onSave: () => void;
  onCopyCommand: () => void;
  command: string;
};

const DownloadSettingsSection: React.FC<DownloadSettingsSectionProps> = ({
  mode,
  defaultDir,
  concurrent,
  saving,
  onConcurrentChange,
  onSave,
  onCopyCommand,
  command
}) => {
  const { t } = useI18n();
  const labelFontSize = mode === 'mobile' ? '41px' : '16px';
  const valueFontSize = mode === 'mobile' ? '39px' : '14px';
  const buttonMinHeight = mode === 'mobile' ? 48 : 36;
  const concurrencyValues: Array<1 | 2 | 3> = [1, 2, 3];
  const sectionStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  };
  const rowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap'
  };
  const pathStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    fontSize: valueFontSize,
    color: '#f8fafc',
    lineHeight: 1.25,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };
  const buttonStyle: CSSProperties = {
    minHeight: buttonMinHeight,
    padding: '10px 18px',
    borderRadius: '10px',
    border: '1px solid rgba(59, 130, 246, 0.6)',
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#fff',
    cursor: 'not-allowed',
    fontSize: labelFontSize
  };
  const radioButton = (value: 1 | 2 | 3): CSSProperties => ({
    minWidth: 48,
    minHeight: buttonMinHeight,
    padding: '8px 12px',
    borderRadius: '999px',
    border: value === concurrent ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(255, 255, 255, 0.4)',
    background: value === concurrent ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
    color: '#fff',
    cursor: 'pointer',
    fontSize: labelFontSize
  });
  const saveButtonStyle: CSSProperties = {
    ...buttonStyle,
    alignSelf: 'flex-start',
    opacity: saving ? 0.6 : 1,
    cursor: saving ? 'not-allowed' : 'pointer',
    width: '100%'
  };

  const noteFontSize = mode === 'mobile' ? '38px' : '15px';
  const noteStyle: CSSProperties = {
    fontSize: noteFontSize,
    lineHeight: 1.4,
    color: '#cbd5f5',
    marginBottom: '12px',
    fontWeight: 300
  };
  const noticeBlockStyle: CSSProperties = {
    fontSize: noteFontSize,
    color: '#f8fafc',
    fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
    background: 'rgba(255, 255, 255, 0.04)',
    padding: '10px 12px',
    borderRadius: '8px',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.5
  };
  const commandWrapperStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '6px'
  };
  const commandTextStyle: CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };
  const commandButtonStyle: CSSProperties = {
    ...buttonStyle,
    borderRadius: '8px',
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: mode === 'mobile' ? '36px' : '14px',
    alignSelf: 'flex-start'
  };

  const defaultFolderLabel = t('settings.downloads.defaultFolder');
  const concurrentLabel = t('settings.downloads.concurrent');
  const saveLabel = saving ? t('settings.downloads.saving') : t('settings.downloads.save');
  return (
    <div style={sectionStyle}>
      <div style={noteStyle}>
        {t('settings.downloads.note')}
      </div>
      <div style={noticeBlockStyle}>
        <div>{t('settings.downloads.helper')}</div>
        <div style={commandWrapperStyle}>
          <span style={{ ...commandTextStyle, fontSize: noteFontSize }}>{command}</span>
          <button type="button" style={commandButtonStyle} onClick={onCopyCommand}>
            {t('settings.downloads.copy')}
          </button>
        </div>
      </div>
      <div>
        <div style={{ fontSize: labelFontSize, color: '#cbd5f5', marginBottom: '6px' }}>
          {defaultFolderLabel}
        </div>
        <div style={rowStyle}>
          <span style={pathStyle} title={defaultDir || ''}>{defaultDir || 'Not set'}</span>
          <button type="button" style={buttonStyle} disabled>
            {t('settings.downloads.choose')}
          </button>
        </div>
      </div>
      <div>
        <div style={{ fontSize: labelFontSize, color: '#cbd5f5', marginBottom: '6px' }}>
          {concurrentLabel}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {concurrencyValues.map((value) => (
            <button
              key={`concurrent-${value}`}
              type="button"
              style={radioButton(value)}
              onClick={() => onConcurrentChange(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <button type="button" style={saveButtonStyle} onClick={onSave} disabled={!defaultDir || saving}>
        {saveLabel}
      </button>
    </div>
  );
};

export default DownloadSettingsSection;
