import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { getCountryLabel, getCountryOptions } from '../../utils/countries';
import { normalizeCountryCode } from '../../utils/savings';

type CountrySelectProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  includeAuto?: boolean;
  autoLabel?: string;
  selectStyle?: React.CSSProperties;
  chevronSize?: number;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
};

const CountrySelect: React.FC<CountrySelectProps> = ({
  value,
  onChange,
  includeAuto = false,
  autoLabel,
  selectStyle,
  chevronSize = 16,
  disabled = false,
  id,
  name,
  className
}) => {
  const { t, language } = useI18n();
  const normalizedValue = normalizeCountryCode(value);
  const selectedValue = normalizedValue ?? (includeAuto ? '' : value ?? '');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const options = useMemo(() => {
    const list = getCountryOptions(language);
    if (normalizedValue && !list.some((option) => option.value === normalizedValue)) {
      const label = getCountryLabel(language, normalizedValue);
      list.unshift({
        value: normalizedValue,
        label: label === normalizedValue ? normalizedValue : `${label} (${normalizedValue})`
      });
    }
    return list;
  }, [language, normalizedValue]);

  const allOptions = useMemo(() => {
    const list = [...options];
    if (includeAuto) {
      list.unshift({ value: '', label: autoLabel ?? t('settings.savings.country.auto') });
    }
    return list;
  }, [autoLabel, includeAuto, options, t]);

  const selectedOption = allOptions.find((option) => option.value === selectedValue);
  const selectedLabel =
    selectedOption?.label ??
    selectedValue ??
    autoLabel ??
    t('settings.savings.country.auto');

  const handleToggle = useCallback(() => {
    if (disabled) {
      setOpen(false);
      return;
    }
    setOpen((prev) => !prev);
  }, [disabled]);

  const handleSelect = useCallback((nextValue: string) => {
    onChange(nextValue ? nextValue : null);
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

  const buttonStyle: React.CSSProperties = {
    ...selectStyle,
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
    zIndex: 50,
    background: 'var(--mzr-surface)',
    border: '1px solid var(--mzr-border)',
    borderRadius: 12,
    padding: 6,
    boxShadow: '0 12px 24px rgba(0,0,0,0.18)',
    maxHeight: 420,
    overflowY: 'auto'
  };

  const optionStyle: React.CSSProperties = {
    width: '100%',
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    padding: '10px 12px',
    borderRadius: 10,
    color: 'var(--mzr-text-primary)',
    cursor: 'pointer',
    fontSize: selectStyle?.fontSize
  };

  const activeOptionStyle: React.CSSProperties = {
    background: 'var(--mzr-surface-weak)'
  };

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    width: selectStyle?.width ?? '100%'
  };

  const buttonLabelStyle: React.CSSProperties = {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  const chevron = (
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
  );

  return (
    <div ref={rootRef} style={wrapperStyle}>
      <button
        id={id}
        name={name}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={className}
        onClick={handleToggle}
        style={buttonStyle}
        disabled={disabled}
      >
        <span style={buttonLabelStyle}>{selectedLabel}</span>
        <span style={{ color: 'var(--mzr-text-muted)', display: 'flex', alignItems: 'center' }}>
          {chevron}
        </span>
      </button>
      {open && (
        <div role="listbox" style={listStyle}>
          {allOptions.map((option) => {
            const isActive = option.value === selectedValue;
            return (
              <button
                key={option.value || 'auto'}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(option.value)}
                style={isActive ? { ...optionStyle, ...activeOptionStyle } : optionStyle}
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

export default CountrySelect;
