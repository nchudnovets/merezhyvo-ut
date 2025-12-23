import { useRef } from 'react';
import type { WebviewTag } from 'electron';
import type { WebViewHandle } from '../components/webview/WebViewHost';

export const useTabRefs = () => {
  const tabViewsRef = useRef<Map<string, any>>(new Map());
  const backgroundTabRef = useRef<string | null>(null);
  const fullscreenTabRef = useRef<string | null>(null);
  const playingTabsRef = useRef<Set<string>>(new Set());
  const webviewHandleRef = useRef<WebViewHandle | null>(null);
  const webviewRef = useRef<WebviewTag | null>(null);

  return {
    tabViewsRef,
    backgroundTabRef,
    fullscreenTabRef,
    playingTabsRef,
    webviewHandleRef,
    webviewRef
  };
};
