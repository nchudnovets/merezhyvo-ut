# Changelog

## 0.4.3 - 2025-12-06

## Added
- Pull-to-refresh gesture to reload pages
- In-app certificate validation with a security indicator, warning screen, and certificate info popover
- Configurable HTTPS mode (Strict / Preferred)
- WebRTC privacy modes (Always allowed / Always blocked / Blocked when Tor is enabled)
- UI improvements

## Changed
- Updated Electron/Chromium engine (Chromium 142.0.7444.177)
----

## 0.4.2.1 - 2025-11-30
a page specific keyboard issue fixed

----

## 0.4.2 — 2025-11-30

### Added
- UI translations for:
  - Ukrainian
  - French
  - German
  - Polish
- Tab search: quickly find an open tab by typing part of its title or URL.
- Address bar suggestions: as you type, the URL bar now searches your history and bookmarks and shows a list of previously visited or saved sites.

### Fixed
- Multiple issues with keyboard layouts in the integrated on-screen keyboard.
- Bug where some passwords were not saved correctly in the password manager.
- Various UI glitches and small visual inconsistencies.

---

## 0.4.1 — 2025-11-26

* Initial public release (MVP) of Merezhyvo on the OpenStore.
* Confined Ubuntu Touch browser with:
  - convergent UI (phone + external display),
  - built-in optional Tor integration,
  - simple bookmarks and password manager,
  - dedicated mDownloads/mDocuments folders for safe downloads/uploads,
  - integrated on-screen keyboard with 12 layouts.
