import React, { useMemo } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { getCountryLabel, getCountryOptions } from '../../utils/countries';
import { normalizeCountryCode } from '../../utils/savings';

type CountrySelectProps = {
  value: string | null;
  onChange: (value: string | null) => void;
  includeAuto?: boolean;
  autoLabel?: string;
  selectStyle?: React.CSSProperties;
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
  disabled = false,
  id,
  name,
  className
}) => {
  const { t, language } = useI18n();
  const normalizedValue = normalizeCountryCode(value);
  const selectedValue = normalizedValue ?? (includeAuto ? '' : value ?? '');

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

  return (
    <select
      id={id}
      name={name}
      className={className}
      value={selectedValue}
      onChange={(event) => {
        const next = event.target.value;
        onChange(next ? next : null);
      }}
      style={selectStyle}
      disabled={disabled}
    >
      {includeAuto && <option value="">{autoLabel ?? t('settings.savings.country.auto')}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default CountrySelect;
