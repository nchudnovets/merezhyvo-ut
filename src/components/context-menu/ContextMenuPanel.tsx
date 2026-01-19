import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { Mode } from '../../types/models';
import type { ContextMenuState } from '../../types/preload';

type Props = {
  visible: boolean;
  mode: Mode;
  state: ContextMenuState | null;
  onClose: () => void;
  onAction: (id: string) => void;
  onHeightChange?: (height: number) => void;
};

const wrenchIcon = (size: number, mode: string) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{marginLeft: mode === 'mobile' ? 7 : 5}}
  >
    <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.1-2.1 2.6-2.6Z" />
  </svg>
);

const reloadIcon = (size: number) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
);

const closeIcon = (size: number) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ContextMenuPanel: React.FC<Props> = ({
  visible,
  mode,
  state,
  onClose,
  onAction,
  onHeightChange
}) => {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);
  const handledPointerRef = useRef<boolean>(false);
  const iconSize = mode === 'mobile' ? 100 : 26;

  useLayoutEffect(() => {
    if (!visible) {
      onHeightChange?.(0);
      return;
    }
    const updateHeight = () => {
      const h = ref.current?.getBoundingClientRect().height ?? 0;
      onHeightChange?.(Math.ceil(h));
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [visible, onHeightChange, state]);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, onClose]);

  const normalized = useMemo<ContextMenuState | null>(() => {
    if (!state) return null;
    return {
      canBack: !!state.canBack,
      canForward: !!state.canForward,
      hasSelection: !!state.hasSelection,
      isEditable: !!state.isEditable,
      canPaste: !!state.canPaste,
      linkUrl: typeof state.linkUrl === 'string' ? state.linkUrl : '',
      mediaType: typeof state.mediaType === 'string' ? state.mediaType : undefined,
      mediaSrc: typeof state.mediaSrc === 'string' ? state.mediaSrc : undefined,
      pageUrl: typeof state.pageUrl === 'string' ? state.pageUrl : undefined,
      autofill: state.autofill
    };
  }, [state]);

  if (!visible) return null;

  const showPasswords = !!(normalized?.isEditable && normalized?.autofill?.available);

  const fontSize = mode === 'mobile' ? 40 : 16;

  const commonButtonStyle: React.CSSProperties = {
    border: '1px solid var(--mzr-border-strong)',
    background: 'var(--mzr-surface)',
    color: 'var(--mzr-text-primary)',
    borderRadius: mode === 'mobile' ? 18 : 12,
    width: mode === 'mobile' ? 68 : 48,
    height: mode === 'mobile' ? 68 : 48,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0
  };

  const loginItems: Array<{ id: string; label: string; disabled?: boolean }> = showPasswords
    ? normalized?.autofill?.locked
      ? [{ id: 'pw-unlock', label: t('ctx.autofill.unlock') }]
      : normalized?.autofill?.options?.length
        ? normalized.autofill.options.map((option) => ({
            id: `pw-fill:${option.id}`,
            label: `${option.username} — ${option.siteName}`
          }))
        : [{ id: '', label: t('ctx.autofill.none'), disabled: true }]
    : [];

  const iconItems =
    normalized
      ? [
          {
            id: 'back',
            icon: (
              <svg viewBox="0 0 16 16" width={iconSize} height={iconSize} xmlns="http://www.w3.org/2000/svg">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M13 8H5M8.5 4.5L5 8l3.5 3.5"
                />
              </svg>
            ),
            title: t('ctx.back'),
            disabled: !normalized.canBack
          },
          {
            id: 'forward',
            icon: (
              <svg viewBox="0 0 16 16" width={iconSize} height={iconSize} xmlns="http://www.w3.org/2000/svg">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M3 8h8M7.5 4.5L11 8l-3.5 3.5"
                />
              </svg>
            ),
            title: t('ctx.forward'),
            disabled: !normalized.canForward
          },
          {
            id: 'reload',
            icon: reloadIcon(iconSize),
            title: t('ctx.reload')
          },
          {
            id: 'copy-selection',
            icon: (
              <svg
                width={iconSize}
                height={iconSize}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="6.5" y="6.5" width="9" height="13" rx="1.5" />
                <path d="M8.5 6C8.5 5.17157 9.17157 4.5 10 4.5H16C16.8284 4.5 17.5 5.17157 17.5 6V16C17.5 16.8284 16.8284 17.5 16 17.5" />
              </svg>
            ),
            title: t('ctx.copySelection'),
            disabled: !normalized.hasSelection
          },
          {
            id: 'paste',
            icon: (
              <svg
                width={iconSize}
                height={iconSize}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <path d="M8 5v0a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v0" />
                <path d="M8 5v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0" />
              </svg>
            ),
            title: t('ctx.paste'),
            disabled: !normalized.canPaste
          },
          { id: 'inspect', icon: wrenchIcon(iconSize, mode), title: t('ctx.devtools') },
          {
            id: 'close',
            icon: closeIcon(iconSize),
            title: t('global.close')
          }
        ].filter(Boolean) as Array<{ id: string; icon: React.ReactNode; title: string; disabled?: boolean }>
      : [];

  const textItems =
    normalized
      ? [
          normalized.linkUrl
            ? { id: 'open-link', label: t('ctx.openLinkNewTab'), disabled: false }
            : null,
          normalized.linkUrl
            ? { id: 'copy-link', label: t('ctx.copyLink'), disabled: false }
            : null,
          normalized.mediaType === 'image'
            ? { id: 'download-image', label: t('ctx.downloadImage'), disabled: false }
            : null,
          normalized.mediaType === 'video'
            ? { id: 'download-video', label: t('ctx.downloadVideo'), disabled: false }
            : null,
          normalized.mediaType === 'audio'
            ? { id: 'download-audio', label: t('ctx.downloadAudio'), disabled: false }
            : null
        ].filter(Boolean) as Array<{ id: string; label: string; disabled?: boolean }>
      : [];

  const handleButtonAction = (id: string, isClose = false) => {
    if (isClose) {
      onClose();
    } else {
      onAction(id);
    }
  };

  const handlePointerDown = (id: string, isClose = false) => {
    handledPointerRef.current = true;
    handleButtonAction(id, isClose);
  };

  const handleClick = (id: string, isClose = false) => {
    if (handledPointerRef.current) {
      handledPointerRef.current = false;
      return;
    }
    handleButtonAction(id, isClose);
  };

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: mode === 'mobile' ? 18 : 12,
        background: 'var(--mzr-surface-elevated, var(--mzr-surface))',
        borderTop: '1px solid var(--mzr-border-strong)',
        boxShadow: '0 -8px 24px rgba(0,0,0,0.18)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: mode === 'mobile' ? 16 : 10,
        alignItems: 'center',
        maxHeight: 400,
        overflowY: 'auto'
      }}
    >
      {!!iconItems.length && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: mode === 'mobile' ? 16 : 10,
            justifyContent: 'center',
            width: '100%',
            maxWidth: 960
          }}
        >
          {iconItems.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onPointerDown={(e) => {
                e.preventDefault();
                if (item.disabled) return;
                handlePointerDown(item.id, item.id === 'close');
              }}
              onClick={() => {
                if (item.disabled) return;
                handleClick(item.id, item.id === 'close');
              }}
              aria-label={item.title}
              title={item.title}
              style={{
                ...commonButtonStyle,
                opacity: item.disabled ? 0.4 : 1,
                cursor: item.disabled ? 'default' : 'pointer'
              }}
            >
              {item.icon}
            </button>
          ))}
        </div>
      )}

      {!!textItems.length && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: mode === 'mobile' ? 12 : 8,
            justifyContent: 'center',
            width: '100%',
            maxWidth: 960
          }}
        >
          {textItems.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onPointerDown={(e) => {
                e.preventDefault();
                if (item.disabled) return;
                handlePointerDown(item.id);
              }}
              onClick={() => {
                if (item.disabled) return;
                handleClick(item.id);
              }}
              style={{
                border: '1px solid var(--mzr-border-strong)',
                background: 'var(--mzr-surface)',
                color: 'var(--mzr-text-primary)',
                borderRadius: mode === 'mobile' ? 18 : 12,
                padding: mode === 'mobile' ? '18px 22px' : '10px 16px',
                fontSize,
                minWidth: mode === 'mobile' ? 220 : 160,
                textAlign: 'center',
                cursor: item.disabled ? 'default' : 'pointer'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {showPasswords && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: mode === 'mobile' ? 14 : 8,
            width: '100%',
            maxWidth: 840,
            alignItems: 'stretch'
          }}
        >
          {loginItems.map((item) => (
            <button
              key={item.id || item.label}
              type="button"
              disabled={item.disabled}
              onPointerDown={(e) => {
                e.preventDefault();
                if (item.disabled) return;
                if (item.id) handlePointerDown(item.id);
              }}
              onClick={() => {
                if (item.disabled) return;
                if (item.id) handleClick(item.id);
              }}
              style={{
                border: '1px solid var(--mzr-border-strong)',
                background: 'var(--mzr-surface)',
                color: 'var(--mzr-text-primary)',
                borderRadius: mode === 'mobile' ? 18 : 12,
                padding: mode === 'mobile' ? '18px 20px' : '10px 14px',
                fontSize,
                textAlign: 'center',
                cursor: item.disabled ? 'default' : 'pointer'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContextMenuPanel;
