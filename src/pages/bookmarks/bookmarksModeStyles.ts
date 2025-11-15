import type { CSSProperties } from 'react';
import type { Mode } from '../../types/models';

export const bookmarksModeStyles: Record<Mode, Partial<Record<string, CSSProperties>>> = {
  desktop: {
    dialogRadioInput: {}
  },
  mobile: {
    container: {
      padding: '18px',
      fontSize: '35px'
    },
    heroTitle: {
      fontSize: 'clamp(42px, 6vw, 54px)'
    },
    feedback: {
      fontSize: '27px',
    },
    smallButton: {
      fontSize: '37px'
    },
    badge: {
      fontSize: '34px',
      padding: '10px 18px'
    },
    button: {
      fontSize: '45px',
      minWidth: '80px',
      height: '80px'
    },
    menuItem: {
      fontSize: '45px'
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
    crumbItem: {
      fontSize: '35px'
    },
    crumbButton: {
      fontSize: '35px'
    },
    crumbSeparator: {
      fontSize: '35px'
    },
    list: {
      gap: '18px',
      fontSize: '35px'
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
      fontSize: '40px'
    },
    bookmarkSubtitle: {
      fontSize: '35px'
    },
    bookmarkFavicon: {
      fontSize: '40px'
    },
    starButton: {
      fontSize: '40px'
    },
    clearButton: {
      fontSize: '38px'
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
      fontSize: '32px',
      padding: '8px 12px'
    },
    tagMore: {
      fontSize: '32px',
      padding: '8px 12px'
    },
    checkbox: {
      width: '40px',
      height: '40px'
    },
    overlay: {
      padding: '8px'
    },
    dialog: {
      width: '90%',
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
      fontSize: '33px',
      padding: '18px'
    },
    dialogRadioInput: {
      width: '25px'
    },
    dialogActions: {
      flexDirection: 'column',
      alignItems: 'stretch'
    },
    dialogMessage: {
      fontSize: '35px'
    },
    folderListPicker: {
      maxHeight: '60vh'
    },
    folderPickerRow: {
      fontSize: '35px',
      padding: '18px 20px'
    },
    folderPickerValue: {
      fontSize: '35px'
    },
    folderPickerLabel: {
      fontSize: '32px'
    },
    folderPickerActions: {
      justifyContent: 'center'
    },
    folderIcon: {
      fontSize: '35px'
    },
    folderTitle: {
      fontSize: '45px'
    },
    folderMeta: {
      fontSize: '35px'
    },
    folderChevron: {
      fontSize: '35px'
    },
    contextMenuItem: {
      fontSize: '33px'
    }
  }
};
