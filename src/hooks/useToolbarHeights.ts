import { useEffect, useRef, useState } from 'react';
import type { Mode } from '../types/models';

type UseToolbarHeightsParams = {
  mode: Mode;
  uiScale: number;
  mainViewMode: 'browser' | 'messenger';
  isHtmlFullscreen: boolean;
};

export const useToolbarHeights = ({
  mode,
  uiScale,
  mainViewMode,
  isHtmlFullscreen
}: UseToolbarHeightsParams) => {
  const toolbarRef = useRef<HTMLDivElement>(null!);
  const messengerToolbarRef = useRef<HTMLDivElement>(null!);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [messengerToolbarHeight, setMessengerToolbarHeight] = useState(0);

  useEffect(() => {
    if (isHtmlFullscreen) {
      setToolbarHeight(0);
      return undefined;
    }
    const node = toolbarRef.current;
    if (!node) {
      setToolbarHeight(0);
      return;
    }
    const update = () => {
      try {
        const rect = node.getBoundingClientRect();
        setToolbarHeight(rect.height || 0);
      } catch {
        setToolbarHeight(0);
      }
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => update());
      observer.observe(node);
      return () => {
        observer.disconnect();
        setToolbarHeight(0);
      };
    }
    const id = window.setInterval(update, 200);
    return () => {
      window.clearInterval(id);
      setToolbarHeight(0);
    };
  }, [mode, uiScale, mainViewMode, isHtmlFullscreen]);

  useEffect(() => {
    if (isHtmlFullscreen) {
      setMessengerToolbarHeight(0);
      return undefined;
    }
    const node = messengerToolbarRef.current;
    if (!node) {
      setMessengerToolbarHeight(0);
      return;
    }
    const update = () => {
      try {
        const rect = node.getBoundingClientRect();
        setMessengerToolbarHeight(rect.height || 0);
      } catch {
        setMessengerToolbarHeight(0);
      }
    };
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => update());
      observer.observe(node);
      return () => {
        observer.disconnect();
        setMessengerToolbarHeight(0);
      };
    }
    const id = window.setInterval(update, 200);
    return () => {
      window.clearInterval(id);
      setMessengerToolbarHeight(0);
    };
  }, [mode, uiScale, mainViewMode, isHtmlFullscreen]);

  return {
    toolbarRef,
    messengerToolbarRef,
    toolbarHeight,
    messengerToolbarHeight
  };
};
