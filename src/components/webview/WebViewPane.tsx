import React, { RefObject, ReactNode } from 'react';
import type { CSSProperties } from 'react';

interface WebViewPaneProps {
  webviewHostRef: RefObject<HTMLDivElement>;
  backgroundHostRef: RefObject<HTMLDivElement>;
  webviewStyle: CSSProperties;
  webviewHostStyle?: CSSProperties;
  backgroundStyle: CSSProperties;
  overlay?: ReactNode;
}

const WebViewPane: React.FC<WebViewPaneProps> = ({
  webviewHostRef,
  webviewHostStyle,
  backgroundHostRef,
  webviewStyle,
  backgroundStyle,
  overlay
}) => (
  <>
    <div style={webviewStyle}>
      <div ref={webviewHostRef} style={webviewHostStyle} />
      {overlay}
    </div>
    <div ref={backgroundHostRef} style={backgroundStyle} />
  </>
);

export default WebViewPane;
