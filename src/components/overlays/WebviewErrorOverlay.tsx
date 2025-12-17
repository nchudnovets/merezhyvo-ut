import React from 'react';
import type { Mode } from '../../types/models';
import type { StatusState } from '../webview/WebViewHost';
import { styles } from '../../styles/styles';

type WebviewErrorOverlayProps = {
  mode: Mode;
  status: StatusState;
  pageError: { url: string | null } | null;
  title: string;
  subtitle: string;
  retryLabel: string;
  onRetry: () => void;
};

export const WebviewErrorOverlay: React.FC<WebviewErrorOverlayProps> = ({
  mode,
  status,
  pageError,
  title,
  subtitle,
  retryLabel,
  onRetry
}) => {
  if (!pageError || status !== 'error') return null;

  return (
    <div
      style={{
        ...styles.webviewErrorOverlay,
        ...(mode === 'mobile' ? styles.webviewErrorOverlayMobile : null)
      }}
      role="alert"
      aria-live="assertive"
    >
      <div
        style={{
          ...styles.webviewErrorTitle,
          ...(mode === 'mobile' ? styles.webviewErrorTitleMobile : null)
        }}
      >
        {title}
      </div>
      <div
        style={{
          ...styles.webviewErrorSubtitle,
          ...(mode === 'mobile' ? styles.webviewErrorSubtitleMobile : null)
        }}
      >
        {subtitle}
        {pageError.url ? (
          <div
            style={{
              ...styles.webviewErrorUrl,
              ...(mode === 'mobile' ? styles.webviewErrorUrlMobile : null)
            }}
            title={pageError.url}
          >
            {pageError.url}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onRetry}
        style={{
          ...styles.webviewErrorButton,
          ...(mode === 'mobile' ? styles.webviewErrorButtonMobile : null)
        }}
      >
        {retryLabel}
      </button>
    </div>
  );
};
