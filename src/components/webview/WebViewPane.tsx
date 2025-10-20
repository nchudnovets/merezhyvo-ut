import React, { RefObject } from 'react';

interface WebViewPaneProps {
  webviewHostRef: RefObject<HTMLDivElement>;
  backgroundHostRef: RefObject<HTMLDivElement>;
  webviewStyle: any;
  backgroundStyle: any;
}

const WebViewPane: React.FC<WebViewPaneProps> = ({
  webviewHostRef,
  backgroundHostRef,
  webviewStyle,
  backgroundStyle
}) => (
  <>
    <div ref={webviewHostRef} style={webviewStyle} />
    <div ref={backgroundHostRef} style={backgroundStyle} />
  </>
);

export default WebViewPane;
