import React, { useEffect, useMemo, useState } from 'react';
import type { Mode, SavingsSettings, MerchantEntry, MerchantsCatalogCache } from '../../types/models';
import type { ServicePageProps } from '../services/types';
import { useI18n } from '../../i18n/I18nProvider';
import CountrySelect from '../../components/coupons/CountrySelect';

const infoSections = [
  {
    headingKey: 'coupons.info.section.privacy.heading',
    bodyKeys: [
      'coupons.info.section.privacy.body1',
      'coupons.info.section.privacy.body2',
      'coupons.info.section.privacy.body3'
    ]
  },
  {
    headingKey: 'coupons.info.section.toggle.heading',
    bodyKeys: ['coupons.info.section.toggle.body']
  },
  {
    headingKey: 'coupons.info.section.country.heading',
    bodyKeys: [
      'coupons.info.section.country.body',
      'coupons.info.section.country.optionSaved',
      'coupons.info.section.country.optionPopup'
    ]
  },
  {
    headingKey: 'coupons.info.section.find.heading',
    bodyKeys: [
      'coupons.info.section.find.step1',
      'coupons.info.section.find.step2',
      'coupons.info.section.find.step3',
      'coupons.info.section.find.step4',
      'coupons.info.section.find.helper'
    ]
  },
  {
    headingKey: 'coupons.info.section.use.heading',
    bodyKeys: [
      'coupons.info.section.use.body',
      'coupons.info.section.use.applyLead',
      'coupons.info.section.use.applyStep1',
      'coupons.info.section.use.applyStep2',
      'coupons.info.section.use.applyStep3',
      'coupons.info.section.use.cartLead',
      'coupons.info.section.use.cartStep1',
      'coupons.info.section.use.cartStep2',
      'coupons.info.section.use.cartStep3'
    ]
  },
  {
    headingKey: 'coupons.info.section.important.heading',
    bodyKeys: [
      'coupons.info.section.important.body1',
      'coupons.info.section.important.body2',
      'coupons.info.section.important.body3'
    ]
  },
  {
    headingKey: 'coupons.info.section.note.heading',
    bodyKeys: ['coupons.info.section.note.body1', 'coupons.info.section.note.body2']
  }
];

type CouponsInfoPageProps = ServicePageProps & {
  mode: Mode;
  savingsSettings: SavingsSettings;
  effectiveCountry: string;
  onCountryChange: (value: string | null) => void;
  performCatalogFetch: (country: string, etag: string | null) => void;
};

const formatBoldMarkup = (value: string): React.ReactNode => {
  if (!value.includes('**')) return value;
  const nodes: React.ReactNode[] = [];
  let remaining = value;
  let counter = 0;

  while (true) {
    const match = remaining.match(/\*\*(.*?)\*\*/);
    if (!match) {
      if (remaining) nodes.push(remaining);
      break;
    }
    const matchIndex = match.index ?? 0;
    if (matchIndex > 0) {
      nodes.push(remaining.slice(0, matchIndex));
    }
    nodes.push(
      <strong key={`bold-${counter++}`}>{match[1]}</strong>
    );
    remaining = remaining.slice(matchIndex + match[0].length);
  }

  return nodes;
};

const EMPTY_MERCHANTS: MerchantEntry[] = [];
type MerchantDisplay = {
  domain: string;
  name: string;
  label: string;
  imageUrl: string;
};

const getMerchantDisplay = (raw: MerchantEntry): MerchantDisplay | null => {
  const record = raw as Record<string, unknown>;
  const domain = typeof record.domain === 'string' ? record.domain.trim() : '';
  if (!domain) return null;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const label = name || domain;
  const imageUrl = typeof record.imageUrl === 'string' ? record.imageUrl.trim() : '';
  return { domain, name, label, imageUrl };
};

const MerchantLogo: React.FC<{ imageUrl: string; label: string }> = ({ imageUrl, label }) => {
  const [errorSrc, setErrorSrc] = useState<string | null>(null);
  const shouldShowImage = !!imageUrl && errorSrc !== imageUrl;

  if (shouldShowImage) {
    return (
      <img
        src={imageUrl}
        alt={label}
        onError={() => {
          if (imageUrl) setErrorSrc(imageUrl);
        }}
        style={{
          width: 36,
          height: 36,
          borderRadius: '6px',
          objectFit: 'contain'
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: 36,
        height: 36,
        minWidth: 36,
        borderRadius: 12,
        background: 'var(--mzr-accent)',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 10l1-6h16l1 6" />
        <path d="M5 10v9h14v-9" />
        <path d="M9 19v-6h6v6" />
      </svg>
    </div>
  );
};

const CouponsInfoPage: React.FC<CouponsInfoPageProps> = ({
  mode,
  onClose,
  openInNewTab,
  savingsSettings,
  effectiveCountry,
  onCountryChange,
  performCatalogFetch
}) => {
  const { t } = useI18n();
  const isMobile = mode === 'mobile';
  const [selectedCountry, setSelectedCountry] = useState<string>(effectiveCountry);
  const [search, setSearch] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    setSelectedCountry(effectiveCountry);
  }, [effectiveCountry]);

  useEffect(() => {
    if (!selectedCountry) return;
    const catalog = savingsSettings.catalog;
    const isCurrent = catalog.country === selectedCountry;
    const nextAllowedAt = catalog.nextAllowedFetchAt ? Date.parse(catalog.nextAllowedFetchAt) : null;
    const canRetry = Number.isFinite(nextAllowedAt) && (nextAllowedAt as number) <= Date.now();
    if (isCurrent && catalog.lastFetchAttemptAt && !canRetry) return;
    setIsFetching(true);
    performCatalogFetch(selectedCountry, isCurrent ? catalog.etag : null);
  }, [
    selectedCountry,
    savingsSettings.catalog,
    performCatalogFetch
  ]);

  useEffect(() => {
    if (savingsSettings.catalog.country !== selectedCountry) return;
    if (savingsSettings.catalog.updatedAt || savingsSettings.catalog.nextAllowedFetchAt || savingsSettings.catalog.merchants.length > 0) {
      setIsFetching(false);
    }
  }, [
    savingsSettings.catalog.country,
    savingsSettings.catalog.updatedAt,
    savingsSettings.catalog.nextAllowedFetchAt,
    savingsSettings.catalog.merchants.length,
    selectedCountry
  ]);

  const catalog: MerchantsCatalogCache = savingsSettings.catalog;
  const catalogForCountry = catalog.country === selectedCountry ? catalog : null;
  const merchants = catalogForCountry?.merchants ?? EMPTY_MERCHANTS;
  useEffect(() => {
    setCurrentTime(Date.now());
  }, [catalogForCountry]);
  const isSyncing = useMemo(() => {
    if (!catalogForCountry || merchants.length > 0) return false;
    if (!catalogForCountry.nextAllowedFetchAt) return false;
    if (currentTime === null) return false;
    const nextAllowedMs = Date.parse(catalogForCountry.nextAllowedFetchAt);
    if (!Number.isFinite(nextAllowedMs)) return false;
    return nextAllowedMs > currentTime;
  }, [catalogForCountry, merchants.length, currentTime]);

  const filteredMerchants = useMemo<MerchantDisplay[]>(() => {
    const term = search.trim().toLowerCase();
    const list: MerchantDisplay[] = [];
    for (const raw of merchants) {
      const display = getMerchantDisplay(raw);
      if (!display) continue;
      const labelLower = display.label.toLowerCase();
      const domainLower = display.domain.toLowerCase();
      if (!term || labelLower.includes(term) || domainLower.includes(term)) {
        list.push(display);
      }
    }
    list.sort((a, b) => a.label.localeCompare(b.label));
    return list;
  }, [merchants, search]);

  const handleCountryChange = (value: string | null) => {
    const next = value ?? '';
    setSelectedCountry(next);
    onCountryChange(value);
  };

  const listStatus = isSyncing
    ? t('coupons.info.listStatus.syncing')
    : isFetching
      ? t('coupons.info.listStatus.fetching')
      : filteredMerchants.length === 0
        ? t('coupons.info.listStatus.empty')
        : '';

  const handleMerchantClick = (domain: string) => {
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    openInNewTab(url);
  };

  return (
    <div
      className="service-scroll"
      style={{
        width: '100%',
        height: '100%',
        padding: mode === 'mobile' ? '28px 20px 40px' : '24px 28px',
        boxSizing: 'border-box',
        color: 'var(--mzr-text-primary)',
        background: 'var(--mzr-surface)'
      }}
    >
      <div
        style={{
          maxWidth: mode === 'mobile' ? 'none' : 920,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 24 : 18
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: isMobile ? 18 : 14
          }}
        >
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('global.close')}
              style={{
                width: isMobile ? 56 : 36,
                height: isMobile ? 56 : 36,
                border: 'none',
                background: 'var(--mzr-surface-weak)',
                color: 'var(--mzr-text-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <svg
                width={isMobile ? 48 : 18}
                height={isMobile ? 48 : 18}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          <h1 style={{ fontSize: isMobile ? 46 : 28, fontWeight: 800, margin: 0 }}>{t('coupons.info.title')}</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 22 : 16 }}>
          {infoSections.map((section) => (
            <section
              key={section.headingKey}
              style={{ background: 'var(--mzr-surface-transparent)', borderRadius: 16, padding: isMobile ? '18px 18px' : '14px 18px' }}
            >
              <h2 style={{ fontSize: isMobile ? 44 : 20, margin: 0, fontWeight: 700 }}>{t(section.headingKey)}</h2>
              {section.bodyKeys.map((line) => (
                <p
                  key={`${section.headingKey}-${line}`}
                  style={{ margin: isMobile ? '10px 0 0' : '8px 0 0', fontSize: isMobile ? 40 : 16, lineHeight: 1.5 }}
                >
                  {formatBoldMarkup(t(line))}
                </p>
              ))}
            </section>
          ))}
        </div>

        <section
          style={{
            background: 'var(--mzr-surface-transparent)',
            borderRadius: 16,
            padding: isMobile ? '18px 18px' : '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}
        >
          <h2 style={{ margin: 0, fontSize: isMobile ? 47 : 20, fontWeight: 700 }}>{t('coupons.info.stores.heading')}</h2>
          <p style={{ margin: 0, fontSize: isMobile ? 40 : 16 }}>{formatBoldMarkup(t('coupons.info.stores.body1'))}</p>
          <p style={{ margin: 0, fontSize: isMobile ? 40 : 16 }}>{formatBoldMarkup(t('coupons.info.stores.body2'))}</p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 6, marginTop: isMobile ? 30 : 5 }}>
            <span style={{ fontSize: isMobile ? 40 : 16, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mzr-text-muted)' }}>
              {t('coupons.info.country.label')}
            </span>
            <CountrySelect
              value={selectedCountry}
              onChange={handleCountryChange}
              chevronSize={isMobile ? 36 : 14}
              selectStyle={{
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--mzr-border)',
                background: 'var(--mzr-surface)',
                color: 'var(--mzr-text-primary)',
                fontSize: isMobile ? 40 : 16
              }}
            />
          </label>
          <div 
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row', 
              gap: isMobile ? 25 : 10, 
              alignItems: 'center',
              padding: isMobile ? '0 15px' : 0,
              marginTop: isMobile ? 30 : 5
            }}>
            <input
              type="text"
              placeholder={t('coupons.info.search.placeholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--mzr-border)',
                background: 'var(--mzr-surface)',
                color: 'var(--mzr-text-primary)',
                fontSize: isMobile ? 40 : 15,
                width: isMobile ? '100%' : undefined
              }}
            />
            <span style={{ fontSize: isMobile ? 40 : 15, color: 'var(--mzr-text-muted)' }}>{selectedCountry || '—'}</span>
          </div>
          <div
            style={{
              maxHeight: isMobile ? 600 : 400,
              overflowY: 'auto',
              paddingRight: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? 25 : 12,
              marginTop: isMobile ? 30 : 5
            }}
          >
            {listStatus && (
              <p style={{ margin: 0, color: 'var(--mzr-text-muted)', fontSize: isMobile ? 40 : 16 }}>{listStatus}</p>
            )}
            {!listStatus && filteredMerchants.length === 0 && (
              <p style={{ margin: 0, color: 'var(--mzr-text-muted)', fontSize: isMobile ? 40 : 16 }}>{t('coupons.info.list.emptyMessage')}</p>
            )}
            {filteredMerchants.map((merchant) => {
              const { domain, name, label, imageUrl } = merchant;
              const showDomain = !!name && name.toLowerCase() !== domain.toLowerCase();
              const handleClick = () => handleMerchantClick(domain);
              return (
                <button
                  key={domain}
                  type="button"
                  onClick={handleClick}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? 20 : 12,
                    borderRadius: 14,
                    border: '1px solid var(--mzr-border)',
                    padding: '10px 14px',
                    background: 'var(--mzr-surface-weak)',
                    color: 'var(--mzr-text-primary)',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <MerchantLogo imageUrl={imageUrl} label={label} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: isMobile ? 40 : 15, fontWeight: 600 }}>{label}</span>
                    {showDomain && (
                      <span style={{ fontSize: isMobile ? 38 : 15, color: 'var(--mzr-text-muted)' }}>{merchant.domain}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default CouponsInfoPage;
