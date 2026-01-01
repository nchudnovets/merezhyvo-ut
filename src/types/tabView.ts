import type { Root } from 'react-dom/client';
import type { WebviewTag } from 'electron';
import type { Mode } from './models';
import type { WebViewHandle } from '../components/webview/WebViewHost';

export type TabViewEntry = {
  container: HTMLDivElement | null;
  root: Root | { unmount: () => void } | null;
  cleanup?: () => void;
  isBackground?: boolean;
  partitionKey?: string;
  handle: WebViewHandle | null;
  view: WebviewTag | null;
  render?: (mode?: Mode, zoom?: number) => void;
};
