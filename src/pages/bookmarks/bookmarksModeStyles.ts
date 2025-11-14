import type { CSSProperties } from 'react';
import type { Mode } from '../../types/models';

export const bookmarksModeStyles: Record<Mode, Partial<Record<string, CSSProperties>>> = {
  desktop: {},
  mobile: {
    container: {
      padding: '18px'
    },
    heroTitle: {
      fontSize: 'clamp(40px, 6vw, 50px)'
    },
    badge: {
      fontSize: '34px',
      padding: '10px 18px'
    },
    button: {
      fontSize: '40px',
      minWidth: '60px',
      height: '60px'
    },
    section: {
      gap: '20px'
    },
    label: {
      fontSize: '32px'
    },
    searchInput: {
      fontSize: '38px',
      padding: '16px'
    },
    breadcrumbs: {
      gap: '8px'
    },
    crumbButton: {
      fontSize: '28px'
    },
    list: {
      gap: '18px'
    },
    nodeRow: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      padding: '24px'
    },
    nodeActions: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '12px'
    },
    nodeTitle: {
      fontSize: 'clamp(35px, 6vw, 48px)'
    },
    nodeUrl: {
      fontSize: '30px'
    },
    bookmarkRow: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '16px'
    },
    bookmarkTitle: {
      fontSize: 'clamp(36px, 6.5vw, 50px)'
    },
    bookmarkSubtitle: {
      fontSize: '30px'
    },
    clearButton: {
      fontSize: '36px'
    },
    menu: {
      top: '70px'
    },
    searchWrapper: {
      gap: '12px'
    },
    filterBar: {
      gap: '16px'
    },
    filterChip: {
      fontSize: '32px',
      padding: '12px 18px'
    },
    filterChipClear: {
      fontSize: '32px'
    },
    tagChip: {
      fontSize: '28px',
      padding: '8px 12px'
    },
    tagMore: {
      fontSize: '28px',
      padding: '8px 12px'
    },
    checkbox: {
      width: '28px',
      height: '28px'
    },
    overlay: {
      padding: '8px'
    },
    dialog: {
      padding: '32px',
      borderRadius: '20px'
    },
    dialogTitle: {
      fontSize: '40px'
    },
    dialogLabel: {
      fontSize: '32px',
      gap: '12px'
    },
    dialogInput: {
      fontSize: '30px',
      padding: '18px'
    },
    dialogActions: {
      flexDirection: 'column',
      alignItems: 'stretch'
    },
    dialogMessage: {
      fontSize: '32px'
    },
    folderListPicker: {
      maxHeight: '60vh'
    },
    folderPickerRow: {
      fontSize: '32px',
      padding: '18px 20px'
    },
    folderPickerValue: {
      fontSize: '32px'
    },
    folderPickerLabel: {
      fontSize: '28px'
    },
    folderPickerActions: {
      justifyContent: 'center'
    }
  }
};
