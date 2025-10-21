import { useCallback } from 'react';

type WebviewElement = HTMLElement | null | undefined;

interface UseContextMenuResult {
  attach: (webview: WebviewElement) => void;
}

export function useContextMenu(): UseContextMenuResult {

  const attach = useCallback(() => {
    
  }, []);

  return { attach };
}
