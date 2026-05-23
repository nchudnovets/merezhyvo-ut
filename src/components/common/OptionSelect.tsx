import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type OptionSelectOption = {
  value: string | number;
  label: string;
};

type Props = {
  value: string | number;
  options: OptionSelectOption[];
  onChange: (value: string | number) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  optionStyle?: React.CSSProperties;
  chevronSize?: number;
  ariaLabel?: string;
};

const OptionSelect: React.FC<Props> = ({
  value,
  options,
  onChange,
  disabled = false,
  style,
  optionStyle,
  chevronSize = 16,
  ariaLabel
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((option) => String(option.value) === String(value)) ?? options[0],
    [options, value]
  );

  const handleToggle = useCallback(() => {
    if (disabled) {
      setOpen(false);
      return;
    }
    setOpen((prev) => !prev);
  }, [disabled]);

  const handleSelect = useCallback((nextValue: string | number) => {
    onChange(nextValue);
    setOpen(false);
  }, [onChange]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', handleOutside);
    return () => window.removeEventListener('pointerdown', handleOutside);
  }, [open]);

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: style?.width ?? '100%'
  };

  const buttonStyle: React.CSSProperties = {
    ...style,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1
  };

  const listStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    zIndex: 150,
    background: 'var(--mzr-surface)',
    border: '1px solid var(--mzr-border)',
    borderRadius: 12,
    padding: 6,
    boxShadow: '0 12px 24px rgba(0,0,0,0.22)',
    maxHeight: 420,
    overflowY: 'auto'
  };

  const baseOptionStyle: React.CSSProperties = {
    width: '100%',
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    padding: '10px 12px',
    borderRadius: 10,
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer',
    fontSize: style?.fontSize,
    ...optionStyle
  };

  const activeOptionStyle: React.CSSProperties = {
    background: 'var(--mzr-surface-weak)'
  };

  return (
    <div ref={rootRef} style={wrapperStyle}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={handleToggle}
        style={buttonStyle}
        disabled={disabled}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? ''}
        </span>
        <span style={{ color: 'var(--mzr-text-muted)', display: 'flex', alignItems: 'center' }}>
          <svg
            width={chevronSize}
            height={chevronSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {open && (
        <div role="listbox" style={listStyle}>
          {options.map((option) => {
            const isActive = String(option.value) === String(value);
            return (
              <button
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(option.value)}
                style={isActive ? { ...baseOptionStyle, ...activeOptionStyle } : baseOptionStyle}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OptionSelect;
