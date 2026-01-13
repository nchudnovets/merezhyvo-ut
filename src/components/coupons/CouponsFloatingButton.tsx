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
  const buttonHight = isMobile ? 150 : 65;
  const buttonWidth = isMobile ? 94 : 40;
  const margin = isMobile ? -60 : -20;
  const [localPos, setLocalPos] = useState<SavingsFloatingButtonPos | null>(null);
  const localPosRef = useRef<SavingsFloatingButtonPos | null>(null);
  const dragRef = useRef<DragState>({ active: false, offsetX: 0, offsetY: 0, moved: false });
  const { t } = useI18n();

  const [hasClicked, setHasClicked] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const wiggleName = 'merez-coupons-wiggle';
  const wiggleCss = `
  @keyframes ${wiggleName} {
    0% { transform: rotate(0deg); }
    2% { transform: rotate(6deg); }
    4% { transform: rotate(-6deg); }
    6% { transform: rotate(4deg); }
    8% { transform: rotate(-4deg); }
    10% { transform: rotate(2deg); }
    12% { transform: rotate(0deg); }
    100% { transform: rotate(0deg); }
  }
  `;

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

    setIsDragging(false);

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

    setIsDragging(true);

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
    setHasClicked(true);
    onClick();
  }, [onClick]);

  useEffect(() => {
    pointerUpHandlerRef.current = handlePointerUp;
  }, [handlePointerUp]);

  useEffect(() => () => {
    setIsDragging(false);
    window.removeEventListener('pointermove', handlePointerMove);
    if (pointerUpHandlerRef.current) {
      window.removeEventListener('pointerup', pointerUpHandlerRef.current);
    }
  }, [handlePointerMove]);

  const posX = localPos?.x ?? 0;
  const posY = localPos?.y ?? 0;
  const label = t('coupons.button.label');
  const shouldWiggle = visible && !hasClicked && !isDragging;
  const buttonStyle: React.CSSProperties = useMemo(() => ({
    position: 'absolute',
    left: posX,
    top: posY,
    width: buttonWidth,
    height: buttonHight,
    border: '1px solid #f8fe59a6',
    borderRadius: '3px',
    background: '#f8fe59a6',
    padding: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(0,0,0,0.2)',
    touchAction: 'none',
    pointerEvents: 'auto',
    transformOrigin: '50% 12%',
  animation: shouldWiggle ? `${wiggleName} 3s ease-in-out infinite` : undefined,
  willChange: shouldWiggle ? 'transform' : undefined
  }), [buttonHight, buttonWidth, posX, posY, shouldWiggle]);

  const iconSvg = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 129 224"
    preserveAspectRatio="xMidYMid meet"
    style={{
      width: '100%',
      height: '100%',
      display: 'block',
      shapeRendering: 'geometricPrecision',
      textRendering: 'geometricPrecision',
    }}
    fillRule="evenodd"
    clipRule="evenodd"
    aria-hidden="true"
    focusable="false"
  >
    <path
      opacity={0.991}
      fill="#235cdc"
      d="M119.5 223.5H7.5a5759.497 5759.497 0 0 1-8-9v-140c9.543-5.078 19.876-7.412 31-7v-6c-11.124.412-21.457-1.922-31-7v-44C2.306 6.863 5.64 3.696 9.5 1a400.25 400.25 0 0 1 40 0c2.236 3.145 3.736 6.645 4.5 10.5 4.091 3.805 8.925 4.972 14.5 3.5a11.529 11.529 0 0 0 4.5-3.5c.763-3.855 2.263-7.355 4.5-10.5a226.864 226.864 0 0 1 42 1 45.238 45.238 0 0 1 7.5 8.5 484.008 484.008 0 0 1 0 44 46.674 46.674 0 0 1-9.5 5 675.93 675.93 0 0 1-21 2v6a675.93 675.93 0 0 1 21 2 46.674 46.674 0 0 1 9.5 5c.667 46.667.667 93.333 0 140a98.521 98.521 0 0 1-7.5 9zm-68-163c9.04-.248 18.04.085 27 1v6c-10 1.333-20 1.333-30 0v-6c1.291.237 2.291-.096 3-1zm36 45c4.23 1.015 5.397 3.348 3.5 7A11126.085 11126.085 0 0 1 40.5 199c-4.95.729-6.45-1.105-4.5-5.5a5691.914 5691.914 0 0 1 51.5-88zm-53 1c9.738-1.387 15.905 2.613 18.5 12 1.88 16.794-5.286 23.294-21.5 19.5-7.197-6.662-9.03-14.496-5.5-23.5 2.098-3.603 4.931-6.27 8.5-8zm48 60c12.626-1.685 19.626 3.815 21 16.5-2.19 14.883-10.19 19.55-24 14-7.118-8.349-7.785-17.182-2-26.5 1.92-1.112 3.586-2.446 5-4z"
    />
    <path
      opacity={0.932}
      fill="#235bdb"
      d="M35.5 113.5c5.272-.951 8.772 1.049 10.5 6 1.638 6.795-.695 11.462-7 14-6.866-2.736-9.2-7.736-7-15a27.251 27.251 0 0 1 3.5-5z"
    />
    <path
      opacity={0.92}
      fill="#225bdb"
      d="M87.5 172.5c7.968 3.223 10.134 8.89 6.5 17-7.721 5.059-12.221 2.892-13.5-6.5-.155-5.317 2.178-8.817 7-10.5z"
    />
  </svg>
);

  if (!visible || !localPos) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}>
      {!hasClicked && <style>{wiggleCss}</style>}
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
