import type { CSSProperties } from 'react';
import type { Mode } from '../../types/models';
import { styles as baseStyles } from '../../styles/styles';
import { modeStyles as baseModeStyles } from '../../styles/modeStyles';

export const toolbarStyles = {
  toolbar: baseStyles.toolbar,
  navGroup: baseStyles.navGroup,
  navButton: baseStyles.navButton,
  navIcon: baseStyles.navIcon,
  navButtonDisabled: baseStyles.navButtonDisabled,
  form: baseStyles.form,
  addressField: baseStyles.addressField,
  downloadIndicator: baseStyles.downloadIndicator,
  input: baseStyles.input,
  makeAppBtn: baseStyles.makeAppBtn,
  tabsButton: baseStyles.tabsButton,
  tabsButtonDisabled: baseStyles.tabsButtonDisabled,
  tabsButtonSquare: baseStyles.tabsButtonSquare,
  tabsButtonCount: baseStyles.tabsButtonCount,
  settingsButton: baseStyles.settingsButton,
  settingsButtonIcon: baseStyles.settingsButtonIcon,
  visuallyHidden: baseStyles.visuallyHidden
} as const;

export const toolbarModeStyles: Record<Mode, Partial<Record<string, CSSProperties>>> = {
  desktop: {
    toolbarBtnRegular: baseModeStyles.desktop.toolbarBtnRegular,
    toolbarBtnIcn: baseModeStyles.desktop.toolbarBtnIcn,
    toolbarBtnDesktopOnly: baseModeStyles.desktop.toolbarBtnDesktopOnly,
    searchInput: baseModeStyles.desktop.searchInput,
    makeAppBtn: baseModeStyles.desktop.makeAppBtn,
    makeAppBtnIcn: baseModeStyles.desktop.makeAppBtnIcn,
    statusIcon: baseModeStyles.desktop.statusIcon,
    tabsButton: baseModeStyles.desktop.tabsButton,
    tabsButtonSquare: baseModeStyles.desktop.tabsButtonSquare,
    tabsButtonCount: baseModeStyles.desktop.tabsButtonCount,
    settingsButton: baseModeStyles.desktop.settingsButton,
    settingsButtonIcon: baseModeStyles.desktop.settingsButtonIcon
  },
  mobile: {
    toolbarBtnRegular: baseModeStyles.mobile.toolbarBtnRegular,
    toolbarBtnIcn: baseModeStyles.mobile.toolbarBtnIcn,
    toolbarBtnDesktopOnly: baseModeStyles.mobile.toolbarBtnDesktopOnly,
    searchInput: baseModeStyles.mobile.searchInput,
    makeAppBtn: baseModeStyles.mobile.makeAppBtn,
    makeAppBtnIcn: baseModeStyles.mobile.makeAppBtnIcn,
    statusIcon: baseModeStyles.mobile.statusIcon,
    tabsButton: baseModeStyles.mobile.tabsButton,
    tabsButtonSquare: baseModeStyles.mobile.tabsButtonSquare,
    tabsButtonCount: baseModeStyles.mobile.tabsButtonCount,
    settingsButton: baseModeStyles.mobile.settingsButton,
    settingsButtonIcon: baseModeStyles.mobile.settingsButtonIcon
  }
} as const;
