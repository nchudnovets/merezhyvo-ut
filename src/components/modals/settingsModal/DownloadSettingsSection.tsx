import React from 'react';
import type { CSSProperties } from 'react';
import type { Mode } from '../../../types/models';
import { useI18n } from '../../../i18n/I18nProvider';

export type DownloadSettingsSectionProps = {
  mode: Mode;
  concurrent: 1 | 2 | 3;
  saving: boolean;
  onConcurrentChange: (value: 1 | 2 | 3) => void;
  onCopyCommand: () => void;
  command: string;
};

const DownloadSettingsSection: React.FC<DownloadSettingsSectionProps> = ({
  mode,
  concurrent,
  saving,
  onConcurrentChange,
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
  const radioContainer: CSSProperties = {
    display: 'flex',
    width: mode === 'mobile' ? '100%' : '60%',
    maxWidth: '100%',
    borderRadius: mode === 'mobile' ? 20 : 10,
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    background: 'rgba(255,255,255,0.06)'
  };
  const radioButton = (value: 1 | 2 | 3, index: number): CSSProperties => ({
    flex: 1,
    minHeight: buttonMinHeight,
    padding: mode === 'mobile' ? '14px 12px' : '10px 12px',
    border: 'none',
    borderLeft: index === 0 ? 'none' : '1px solid rgba(255,255,255,0.2)',
    background: value === concurrent ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
    color: '#fff',
    cursor: 'pointer',
    fontSize: labelFontSize,
    fontWeight: 600
  });
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
    marginTop: '6px',
    alignItems: 'flex-end'
  };
  const commandTextStyle: CSSProperties = {
    alignSelf: 'stretch',
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
    alignSelf: 'flex-end',
    display: 'inline-flex',
    alignItems: 'center',
    gap: mode === 'mobile' ? 12 : 8
  };

  // const defaultFolderLabel = t('settings.downloads.defaultFolder');
  const concurrentLabel = t('settings.downloads.concurrent');
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
            <svg
              width={mode === 'mobile' ? 30 : 18}
              height={mode === 'mobile' ? 30 : 18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {t('settings.downloads.copy')}
          </button>
        </div>
      </div>
      {/* <div>  //temorary hidden since it doesn't work yet
        <div style={{ fontSize: labelFontSize, color: '#cbd5f5', marginBottom: '6px' }}>
          {defaultFolderLabel}
        </div>
        <div style={rowStyle}>
          <span style={pathStyle} title={defaultDir || ''}>{defaultDir || 'Not set'}</span>
          <button type="button" style={buttonStyle} disabled>
            {t('settings.downloads.choose')}
          </button>
        </div>
      </div> */}
      <div>
        <div style={{ fontSize: labelFontSize, color: '#cbd5f5', marginBottom: '6px' }}>
          {concurrentLabel}
        </div>
        <div style={{ display: 'flex', justifyContent: mode === 'mobile' ? 'stretch' : 'center' }}>
          <div style={radioContainer}>
            {concurrencyValues.map((value, index) => (
              <button
                key={`concurrent-${value}`}
                type="button"
                style={radioButton(value, index)}
                onClick={() => onConcurrentChange(value)}
                disabled={saving}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadSettingsSection;
