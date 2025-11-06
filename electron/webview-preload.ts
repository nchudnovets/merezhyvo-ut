import { ipcRenderer } from 'electron';

// Preserve native Notification
const NativeNotification = window.Notification;

// Lightweight proxy that mirrors notifications to host (renderer) via sendToHost
class MirrorNotification extends NativeNotification {
  constructor(title: string, options?: NotificationOptions) {
    super(title, options);
    try {
      ipcRenderer.sendToHost('mzr:webview:notification', {
        title,
        options: {
          body: options?.body ?? '',
          icon: options?.icon ?? '',
          data: options?.data ?? null,
          tag: options?.tag ?? ''
        }
      });
    } catch {
      // ignore
    }
  }
}

// Replace window.Notification only if it exists and is configurable
try {
  Object.defineProperty(window, 'Notification', { value: MirrorNotification, configurable: true });
} catch {
  // ignore override errors (some sites may lock down globals)
}