import React from 'react';
import type { Mode } from '../../types/models';
import type { StatusState } from '../webview/WebViewHost';
import { styles } from '../../styles/styles';

type WebviewLoadingOverlayProps = {
  mode: Mode;
  status: StatusState;
  activeTabIsLoading: boolean;
};

export const WebviewLoadingOverlay: React.FC<WebviewLoadingOverlayProps> = ({
  mode,
  status,
  activeTabIsLoading
}) => {
  if (status === 'error' || !activeTabIsLoading) return null;

  return (
    <div
      style={{
        ...styles.webviewLoadingOverlay,
        ...(mode === 'mobile' ? styles.webviewLoadingOverlayMobile : null)
      }}
      aria-live="polite"
      aria-label="Loading"
    >
      <div
        aria-hidden="true"
        className="mzv-spinner"
        style={{
          ...styles.webviewLoadingSpinner,
          ...(mode === 'mobile' ? styles.webviewLoadingSpinnerMobile : null)
        }}
      />
    </div>
  );
};
