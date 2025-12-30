import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { JsDialogRequestDetail, JsDialogResult } from '../../../types/models';
import { onJsDialogRequest, resolveJsDialogRequest } from '../../../services/jsDialog/jsDialogService';
import { useI18n } from '../../../i18n/I18nProvider';

type Props = {
  mode: 'mobile' | 'desktop';
};

export const JsDialogHost: React.FC<Props> = ({ mode }) => {
  const { t } = useI18n();
  const [dialog, setDialog] = useState<JsDialogRequestDetail | null>(null);

  useEffect(() => {
    const undo = onJsDialogRequest((detail: JsDialogRequestDetail) => {
      setDialog(detail);
    });
    return undo;
  }, []);

  const closeWith = useCallback((value: boolean | string | null) => {
    if (!dialog) return;
    const dialogId: string = dialog.id;
    const result: JsDialogResult = { id: dialogId, type: dialog.type, value };
    resolveJsDialogRequest(dialogId, result);
    setDialog(null);
  }, [dialog]);

  const styles = useMemo(() => {
    const overlayBg = 'rgba(2,6,23,0.85)';
    const surface = 'var(--mzr-surface-elevated)';
    const border = 'var(--mzr-border-strong)';
    const text = 'var(--mzr-text-primary)';
    const accent = 'var(--mzr-focus-ring)';
    const radius = mode === 'mobile' ? 18 : 14;
    const padding = mode === 'mobile' ? '32px 24px' : '28px';
    const width = mode === 'mobile' ? '90vw' : 'min(480px, 92vw)';
    return {
      overlay: {
        position: 'fixed' as const,
        inset: 0,
        background: overlayBg,
        zIndex: 120000,
        display: dialog ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        padding: mode === 'mobile' ? '18px' : '12px'
      },
      card: {
        background: surface,
        color: text,
        borderRadius: radius,
        border: `1px solid ${border}`,
        width,
        maxWidth: '720px',
        boxShadow: '0 30px 60px rgba(0,0,0,0.65)',
        padding,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: mode === 'mobile' ? 20 : 16
      },
      message: {
        fontSize: mode === 'mobile' ? 38 : 15,
        lineHeight: 1.35,
        color: text
      },
      actions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 6
      },
      button: {
        borderRadius: 12,
        border: `1px solid ${border}`,
        padding: mode === 'mobile' ? '16px 26px' : '10px 14px',
        minWidth: mode === 'mobile' ? 160 : 100,
        fontSize: mode === 'mobile' ? 28 : 16,
        fontWeight: 600,
        cursor: 'pointer',
        background: 'var(--mzr-surface-muted)',
        color: text,
        transition: 'transform 0.1s ease, filter 0.15s ease'
      },
      primary: {
        background: accent,
        color: '#0b1328',
        border: `1px solid ${accent}`
      }
    };
  }, [dialog, mode]);

  if (!dialog) return null;

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true">
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.message}>{dialog.message}</div>
        <div style={styles.actions}>
          {dialog.type === 'confirm' && (
            <button type="button" style={styles.button} onClick={() => closeWith(false)}>
              {t('jsDialog.cancel')}
            </button>
          )}
          <button
            type="button"
            style={{ ...styles.button, ...styles.primary }}
            onClick={() => {
              closeWith(true);
            }}
          >
            {t('jsDialog.ok')}
          </button>
        </div>
      </div>
    </div>
  );
};
