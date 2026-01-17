# Changelog

----
## v0.4.9 - 2026-01-17

### New

- Customisable Start Page.

- Built-in Coupons engine for online shopping: a small floating button appears on supported stores to help you find available coupons and save money — with no tracking and no impact on your privacy.

- Automatic cleanup of outdated temporary files to avoid cluttering the system.

## Fixed

- Fixed an issue that prevented opening links in new tabs.

- Minor UI fixes and polish.


----
## v0.4.8 - 2026-01-11

### New

- Emoji panel on the on-screen keyboard.

### Changed

- Added missing « » characters to the OSK symbol layout.

- Security popup now shows a counter for blocked third-party cookies.

### Fixed

- Fixed a bug that prevented renaming bookmark folders.

- Fixed a freeze/hang when wiping Tor data while turning Tor off and closing all open tabs.

----
## 0.4.7 - 2026-01-03

### New

- Custom in-app JavaScript dialogs for alert() and confirm() (better usability on small screens).

- Separate storage partitions for Tor vs non-Tor browsing (no cookie/site-data crossover).

- DNS switcher (Secure DNS / DNS-over-HTTPS) with multiple providers and custom endpoint support.

### Improved

- Better pressed-state visibility for on-screen keyboard keys in the Light theme.

### Fixed

- Fixed caret visibility issues when typing in internal pages, browser dialogs, and the address bar.

----

## 0.4.6 — 2025-12-27

### New

- Added a Light theme.

- Added a Security shield icon and site security popup on the messenger panel.

- Added an option to hide the messenger panel if you don’t use it.

- Added an option to set a default webview zoom.


### Updated

- Improved tracker & ad blocking.

- Added blocking modes: Basic and Strict.

### Fixed

- Fixed an issue where it was not possible to insert a new line in textareas when typing with the on-screen keyboard.

----
## 0.4.5.1 - 2025-12-20

### Fixed
- a bug when trackers blocker blocked the main duckduckgo page

----

## 0.4.5 - 2025-12-20

### Added
- Tracker & ads blocking (domain-based), with per-site exceptions and counters in the security popover.
- Norwegian UI translation and Norwegian keyboard layout.

### Changed
- Page zoom is now persisted per-tab across sessions, separately for mobile and desktop modes.
- Updated and improved UI translations for multiple languages.
- Various UI polish and small layout tweaks.
- Updated Electron/Chromium engine (Chromium 142.0.7444.235)

### Fixed
- File downloads and uploads: fixed several issues with saving downloads and uploading files on websites.
- Fixed text input on some sites where typing did not work.
- Fixed a disappearing caret issue in certain cases.
- Fixed context menu positioning.
- Fixed an issue where the Passwords internal page could remain open / not close correctly when the password manager was locked.

----

## 0.4.4 - 2025-12-13

### Added
- Third-party cookies blocking with a global setting and per-site exceptions.
- New “Site data” internal page to inspect and clear cookies and stored data per site, with a global “Clear all data” option.
- New “Privacy & Security – How this works” page explaining HTTPS modes, certificates, cookies, WebRTC and internal tools in plain language.
- Improved touch support on Ubuntu Touch: fixed drag/rotation gestures on some canvas / map / D3-based sites (for example, earth.nullschool.net).
- New UI translations: NL, ES, IT.

### Changed
- Security popover (shield icon) now also reflects per-site cookie exceptions and other non-default privacy/security settings.
- Improved UX on internal security pages: added Close buttons and clearer explanations for “Manage security exceptions” and “Manage site data”.
- Various UI polish and layout tweaks to make the interface more consistent and easier on the eyes.
- Fixed some issues with accent letters on the on-screen keyboard.

----

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
