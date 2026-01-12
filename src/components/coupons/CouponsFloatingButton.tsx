import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { Mode, SavingsFloatingButtonPos } from '../../types/models';
import { useI18n } from '../../i18n/I18nProvider';

type CouponsFloatingButtonProps = {
  mode: Mode;
  visible: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  position: SavingsFloatingButtonPos | null;
  onPositionChange: (pos: SavingsFloatingButtonPos) => void;
  onClick: () => void;
};

type DragState = {
  active: boolean;
  offsetX: number;
  offsetY: number;
  moved: boolean;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const CouponsFloatingButton: React.FC<CouponsFloatingButtonProps> = ({
  mode,
  visible,
  containerRef,
  position,
  onPositionChange,
  onClick
}) => {
  const isMobile = mode === 'mobile';
  const buttonHight = isMobile ? 150 : 85;
  const buttonWidth = isMobile ? 94 : 54;
  const margin = isMobile ? 20 : 10;
  const [localPos, setLocalPos] = useState<SavingsFloatingButtonPos | null>(null);
  const localPosRef = useRef<SavingsFloatingButtonPos | null>(null);
  const dragRef = useRef<DragState>({ active: false, offsetX: 0, offsetY: 0, moved: false });
  const { t } = useI18n();

  const clampPos = useCallback((pos: SavingsFloatingButtonPos, rect: DOMRect): SavingsFloatingButtonPos => {
    const maxX = Math.max(margin, rect.width - buttonWidth - margin);
    const maxY = Math.max(margin, rect.height - buttonHight - margin);
    return {
      x: clamp(pos.x, margin, maxX),
      y: clamp(pos.y, margin, maxY)
    };
  }, [buttonHight, buttonWidth, margin]);

  useLayoutEffect(() => {
    if (!visible) return;
    const node = containerRef.current;
    if (!node) return;
    const update = () => {
      const rect = node.getBoundingClientRect();
      const fallbackPos = {
        x: rect.width - buttonWidth - margin,
        y: rect.height / 2 - buttonHight / 2
      };
      const basePos = localPosRef.current ?? position ?? fallbackPos;
      const clamped = clampPos(basePos, rect);
      localPosRef.current = clamped;
      setLocalPos(clamped);
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    if (observer) {
      observer.observe(node);
    }
    window.addEventListener('resize', update);
    return () => {
      if (observer) {
        observer.disconnect();
      }
      window.removeEventListener('resize', update);
    };
  }, [visible, position, containerRef, buttonHight, buttonWidth, margin, clampPos]);

  useEffect(() => {
    localPosRef.current = localPos;
  }, [localPos]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (!dragRef.current.active) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextPos = {
      x: event.clientX - rect.left - dragRef.current.offsetX,
      y: event.clientY - rect.top - dragRef.current.offsetY
    };
    const clamped = clampPos(nextPos, rect);
    const prev = localPosRef.current;
    if (prev && (Math.abs(prev.x - clamped.x) > 2 || Math.abs(prev.y - clamped.y) > 2)) {
      dragRef.current.moved = true;
    }
    localPosRef.current = clamped;
    setLocalPos(clamped);
  }, [containerRef, clampPos]);

  const pointerUpHandlerRef = useRef<(() => void) | null>(null);

  const handlePointerUp = useCallback(() => {
    if (!dragRef.current.active) return;
    const moved = dragRef.current.moved;
    dragRef.current.active = false;
    window.removeEventListener('pointermove', handlePointerMove);
    if (pointerUpHandlerRef.current) {
      window.removeEventListener('pointerup', pointerUpHandlerRef.current);
    }
    const finalPos = localPosRef.current;
    if (moved && finalPos) {
      onPositionChange(finalPos);
    }
  }, [handlePointerMove, onPositionChange]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!visible) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const current = localPosRef.current ?? {
      x: rect.width - buttonWidth - margin,
      y: rect.height / 2 - buttonHight / 2
    };
    dragRef.current = {
      active: true,
      offsetX: event.clientX - rect.left - current.x,
      offsetY: event.clientY - rect.top - current.y,
      moved: false
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [visible, containerRef, buttonHight, buttonWidth, margin, handlePointerMove, handlePointerUp]);

  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (dragRef.current.moved) {
      event.preventDefault();
      dragRef.current.moved = false;
      return;
    }
    onClick();
  }, [onClick]);

  useEffect(() => {
    pointerUpHandlerRef.current = handlePointerUp;
  }, [handlePointerUp]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', handlePointerMove);
    if (pointerUpHandlerRef.current) {
      window.removeEventListener('pointerup', pointerUpHandlerRef.current);
    }
  }, [handlePointerMove]);

  const posX = localPos?.x ?? 0;
  const posY = localPos?.y ?? 0;
  const label = t('coupons.button.label');
  const buttonStyle: React.CSSProperties = useMemo(() => ({
    position: 'absolute',
    left: posX,
    top: posY,
    width: buttonWidth,
    height: buttonHight,
    border: '1px solid #259cebff',
    borderRadius: '3px',
    background: '#259cebff',
    padding: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(0,0,0,0.2)',
    touchAction: 'none',
    pointerEvents: 'auto'
  }), [buttonHight, buttonWidth, posX, posY]);
  const iconSize = buttonWidth;
  const iconHeight = buttonHight;
  const iconSvg = (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 162 256"
        width={iconSize}
        height={iconHeight}
        style={{ display: 'block', shapeRendering: 'geometricPrecision', textRendering: 'geometricPrecision', imageRendering: 'auto' }}
      >
      <path style={{ opacity: 0.92 }} fill="#fedc59" d="M4.5-.5h56a19.567 19.567 0 0 0 3.5 4c.183 8.55 4.016 14.716 11.5 18.5 1.634.494 3.3.66 5 .5-.332 30.505.002 60.838 1 91l-1 2a1115.442 1115.442 0 0 1-26.5 31c-2.11 4.128-1.61 7.961 1.5 11.5 2.53 1.422 5.197 1.755 8 1a148.304 148.304 0 0 0 17-18.5v92c-5.12-.024-9.287 1.976-12.5 6a46.911 46.911 0 0 0-4 13 19.555 19.555 0 0 0-3.5 4h-56a19.555 19.555 0 0 0-3.5-4C.333 168.833.333 86.167 1 3.5a19.568 19.568 0 0 0 3.5-4z"/>
      <path style={{ opacity: 0.98 }} fill="#edca41" d="M100.5-.5h56a19.564 19.564 0 0 0 3.5 4c.667 82.667.667 165.333 0 248a19.552 19.552 0 0 0-3.5 4h-56a19.555 19.555 0 0 0-3.5-4c-.183-8.55-4.016-14.716-11.5-18.5a12.93 12.93 0 0 0-5-.5v-93a934.606 934.606 0 0 0 23.5-27c2.565-2.463 4.065-5.463 4.5-9-.908-6.459-4.574-8.959-11-7.5a132.702 132.702 0 0 0-16 17.5 2070.813 2070.813 0 0 1-1-91c5.12.023 9.287-1.977 12.5-6a46.915 46.915 0 0 0 4-13 19.567 19.567 0 0 0 3.5-4z"/>
      <path style={{ opacity: 1 }} fill="#e1e3f8" d="M53.5 95.5c8.178-.658 11.678 3.01 10.5 11-2.226 4.361-5.726 5.861-10.5 4.5-4.36-2.226-5.86-5.726-4.5-10.5 1.025-2.187 2.525-3.854 4.5-5z"/>
      <path style={{ opacity: 1 }} fill="#b7cef0" d="M80.5 139.5v-24l1-2a132.702 132.702 0 0 1 16-17.5c6.426-1.459 10.092 1.041 11 7.5-.435 3.537-1.935 6.537-4.5 9a934.606 934.606 0 0 1-23.5 27z"/>
      <path style={{ opacity: 1 }} fill="#e0e3fc" d="M80.5 115.5v25a148.304 148.304 0 0 1-17 18.5c-2.803.755-5.47.422-8-1-3.11-3.539-3.61-7.372-1.5-11.5a1115.442 1115.442 0 0 0 26.5-31z"/>
      <path style={{ opacity: 1 }} fill="#b8cdec" d="M101.5 143.5c10.667.503 13.333 5.336 8 14.5-9.08 3.215-13.247.048-12.5-9.5 1.025-2.187 2.525-3.854 4.5-5z"/>
    </svg>
  );

  if (!visible || !localPos) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}>
      <button
        type="button"
        aria-label={label}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        style={buttonStyle}
      >
        {iconSvg}
      </button>
    </div>
  );
};

export default CouponsFloatingButton;
