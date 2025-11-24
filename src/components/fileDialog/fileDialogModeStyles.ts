import type { CSSProperties } from 'react';
import type { Mode } from '../../types/models';
import type { FileDialogStyleKeys } from './fileDialogStyles';

const override = (key: FileDialogStyleKeys, props: CSSProperties): Record<FileDialogStyleKeys, CSSProperties> => ({ [key]: props } as Record<FileDialogStyleKeys, CSSProperties>);

export const fileDialogModeStyles: Record<Mode, Partial<Record<FileDialogStyleKeys, CSSProperties>>> = {
  desktop: {},
  mobile: {
    ...override('dialog', {
      width: '100%',
      maxHeight: '100%',
      borderRadius: '20px',
      padding: '28px'
    }),
    ...override('title', {
      fontSize: '40px'
    }),
    ...override('subtitle', {
      fontSize: '26px'
    }),
    ...override('pathText', {
      fontSize: '28px'
    }),
    ...override('entryRow', {
      padding: '24px',
      borderRadius: '16px'
    }),
    ...override('entryName', {
      fontSize: '38px'
    }),
    ...override('entryMeta', {
      fontSize: '32px'
    }),
    ...override('button', {
      fontSize: '32px'
    }),
    ...override('buttonPrimary', {
      fontSize: '32px'
    })
    ,
    ...override('hiddenToggleLabel', {
      fontSize: '35px'
    }),
    ...override('breadcrumb', {
      gap: '12px'
    }),
    ...override('breadcrumbButton', {
      fontSize: '35px'
    }),
    ...override('hiddenToggleInput', {
      width: '32px',
      height: '32px'
    })
    ,
    ...override('notice', {
      padding: '20px',
      gap: '10px'
    }),
    ...override('noticeText', {
      fontSize: '38px',
      overflowX: 'auto'
    }),
    ...override('noticeCommand', {
      fontSize: '36px',
      padding: '10px 14px'
    }),
    ...override('noticeCheckboxLabel', {
      fontSize: '35px'
    }),
    ...override('noticeCheckboxInput', {
      width: '40px',
      height: '40px'
    }),
    ...override('noticeCommandRow', {
      gap: '16px'
    }),
    ...override('noticeCopyButton', {
      fontSize: '38px',
      padding: '12px 18px'
    })
  }
};
