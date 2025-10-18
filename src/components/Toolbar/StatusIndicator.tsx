import React from 'react';
import type { Mode } from '../../types/models';
import { toolbarStyles, toolbarModeStyles } from './toolbarStyles';

interface StatusIndicatorProps {
  mode: Mode;
  status: 'loading' | 'ready' | 'error';
  label: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  mode,
  status,
  label
}) => (
  <div style={toolbarStyles.statusIndicator} role="status" aria-label={label}>
    {status === 'loading' && <span style={toolbarStyles.spinner} aria-hidden="true" />}
    {status === 'ready' && (
      <svg
        viewBox="0 0 16 16"
        style={{
          ...toolbarStyles.statusSvg,
          ...toolbarStyles.statusIconReady,
          ...(toolbarModeStyles[mode].statusIcon || {})
        }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M3.5 8.5 6.5 11.5 12.5 5.5"
        />
      </svg>
    )}
    {status === 'error' && (
      <svg
        viewBox="0 0 16 16"
        style={{ ...toolbarStyles.statusSvg, ...toolbarStyles.statusIconError }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5"
        />
      </svg>
    )}
  </div>
);

export default StatusIndicator;
