import { isRTL, type LayoutId } from '../components/keyboard/layouts';

export type OskLayoutChangedDetail = {
  layoutId: LayoutId;
  rtl: boolean;
};

declare global {
  interface WindowEventMap {
    'mzr-osk-layout-changed': CustomEvent<OskLayoutChangedDetail>;
  }
}

/** Fire a strongly-typed layout-changed event */
export function announceLayoutChanged(layoutId: LayoutId): void {
  const rtl = isRTL(layoutId);
  const evt = new CustomEvent<OskLayoutChangedDetail>('mzr-osk-layout-changed', {
    detail: { layoutId, rtl },
  });
  window.dispatchEvent(evt);
}
