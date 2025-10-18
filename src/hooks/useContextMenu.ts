import { useCallback, useEffect, useRef } from 'react';
import type { Unsubscribe } from '../types/models';
import { ipc } from '../services/ipc';

type WebviewElement = HTMLElement | null | undefined;

interface UseContextMenuResult {
  attach: (webview: WebviewElement) => void;
}

export function useContextMenu(): UseContextMenuResult {
  const cleanupRef = useRef<Unsubscribe>(() => {});

  const attach = useCallback((webview: WebviewElement) => {
    cleanupRef.current?.();
    if (!webview) {
      cleanupRef.current = () => {};
      return;
    }

    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    let startX = 0;
    let startY = 0;

    const openAt = (clientX: number, clientY: number) => {
      const dpr = window.devicePixelRatio || 1;
      ipc.openContextMenuAt(clientX, clientY, dpr);
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      openAt(event.clientX, event.clientY);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (!event.touches || event.touches.length !== 1) return;
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      pressTimer = setTimeout(() => {
        pressTimer = null;
        event.preventDefault();
        openAt(startX, startY);
      }, 500);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pressTimer) return;
      const touch = event.touches && event.touches[0];
      if (!touch) return;
      const dx = Math.abs(touch.clientX - startX);
      const dy = Math.abs(touch.clientY - startY);
      if (dx > 10 || dy > 10) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    const cancel = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    webview.addEventListener('contextmenu', onContextMenu);
    webview.addEventListener('touchstart', onTouchStart, { passive: false });
    webview.addEventListener('touchmove', onTouchMove, { passive: false });
    webview.addEventListener('touchend', cancel);
    webview.addEventListener('touchcancel', cancel);

    cleanupRef.current = () => {
      webview.removeEventListener('contextmenu', onContextMenu);
      webview.removeEventListener('touchstart', onTouchStart);
      webview.removeEventListener('touchmove', onTouchMove);
      webview.removeEventListener('touchend', cancel);
      webview.removeEventListener('touchcancel', cancel);
      cancel();
    };
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  return { attach };
}
