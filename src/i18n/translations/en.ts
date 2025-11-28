const en = {
  'global.loading': 'Loading…',
  'global.close': 'Close',
  'tabs.title': 'Tabs',
  'tabs.openBookmarks': 'Open bookmarks',
  'tabs.openHistory': 'Open history',
  'tabs.newTab': 'New tab',
  'tabs.section.pinned': 'Pinned',
  'tabs.section.others': 'Others',
  'settings.language.title': 'Language',
  'settings.language.description': 'Select the language used across the browser interface.',
  'settings.language.saved': 'Saved',
  'settings.language.save': 'Save',
  'settings.language.saving': 'Saving…',
  'settings.section.tor': 'Tor',
  'settings.section.appearance': 'Appearance',
  'settings.section.keyboardLayout': 'Keyboard layouts',
  'settings.section.passwords': 'Passwords',
  'settings.section.downloads': 'Downloads',
  'settings.section.messengerToolbar': 'Messenger toolbar',
  'settings.section.about': 'About',
  'toolbar.openMessenger': 'Open messenger mode',
  'toolbar.openSettings': 'Open settings',
  'toolbar.tor.enable': 'Enable Tor',
  'toolbar.tor.disable': 'Disable Tor'
} as const;

export type EnglishTranslationKeys = keyof typeof en;
export default en;
