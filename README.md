# Merezhyvo

**Merezhyvo** is a minimalist Chromium-based browser built specifically for **Ubuntu Touch (Lomiri)**.

It focuses on:

*   feeling native on Ubuntu Touch (phone and desktop/convergence);
    
*   strong privacy defaults (no tracking, no telemetry);
    
*   a simple UI with optional **Tor** integration;
    
*   running as a **confined** app following UT security and sandbox rules.
    

> Pronunciation: roughly **"meh-REH-zhy-vo"** (from the Ukrainian word for lace / web).

This repository contains the full source code and build scripts for the Ubuntu Touch `.click` package.

- - -

## Status

*   **MVP / early access** – the browser is usable for daily browsing, but development is still ongoing.
    
*   Target platform: **Ubuntu Touch 24.04** (Lomiri).
    
*   Architecture: currently **arm64** only.
    

- - -

## Features (current MVP)

- **Ubuntu Touch–first & confined**

  - Designed specifically for Ubuntu Touch 24.04 (Lomiri), running as a confined app.

  - Plays nicely with the sandbox/AppArmor model; file access is limited to internal app folders.


- **Convergent UI (phone & desktop)**

  - Single-window layout optimised for phones and convergence mode with external display, keyboard and mouse.

  - Adjustable UI scaling: change the size of toolbar, tabs and controls independently from page zoom.

  - Page zoom is persisted per tab across sessions, separately for mobile and desktop modes.


- ### Privacy & security features

*   **Certificate validation & shield indicator**
    *   Merezhyvo validates HTTPS certificates in-app and shows a small shield icon before the URL.
    *   White shield: everything looks normal for this site.
    *   Yellow shield: you have enabled a per-site privacy/security exception for this site (for example cookies, trackers/ads, or certificate overrides).
    *   Red shield: the connection is not secure (HTTP only, invalid/expired/revoked certificate, etc.).
    *   Tapping the shield opens a popover with a short summary, certificate details, and links to manage site data or exceptions.

*   **Configurable HTTPS mode (Strict / Preferred)**
    *   **Preferred**: Merezhyvo first tries to load a site via HTTPS; if that fails, it can fall back to HTTP.
    *   **Strict**: Merezhyvo tries HTTPS first and shows a warning instead of silently falling back to HTTP when a secure version is not available.
    *   You can override this with per-site exceptions if you really need to use a specific HTTP-only site.

*   **Third-party cookies control**
    *   Global setting under **Settings → Privacy & Security** to block or allow third-party cookies.
    *   Per-site exceptions: you can explicitly allow third-party cookies for individual sites that break without them (for example some logins or embedded widgets).
    *   Exceptions are visible both on the internal **“Manage security exceptions”** page and in the shield popover for the current site.

*   **Tracker & ads blocking (domain-based)**
    *   Two separate global toggles under **Settings → Privacy & Security**: block trackers (recommended) and block ads.
    *   Per-site exceptions: you can allow trackers and/or ads for individual sites if something breaks.
    *   The shield popover shows counters for the current site: blocked total / ads / trackers.

*   **WebRTC privacy modes**
    *   WebRTC is a browser technology used for real-time audio/video and peer-to-peer connections.
    *   Merezhyvo lets you choose between:
        *   **Always allowed**,
        *   **Always blocked**,
        *   **Blocked when Tor is enabled**.
    *   Blocking WebRTC can reduce some IP leak surface for privacy-sensitive use, but it is not a magic “anonymous mode”.

*   **Site data management**
    *   Internal **“Site data”** page where you can inspect and clear cookies and stored data per site.
    *   Includes a global **“Clear all data”** option, plus per-site actions to remove cookies, site data, or both.
    *   The same page is linked from the shield popover (“Manage site data”) with the current site pre-filtered.

*   **Built-in explanation page**
    *   A **“Privacy & Security – How this works”** internal page explains, in plain language, how HTTPS, certificates, cookies, tracker/ad blocking, WebRTC, and the internal tools (exceptions, site data) behave in Merezhyvo.
    *   Accessible from **Settings → Privacy & Security** and intended for non-experts who want to understand what the knobs actually do.


- **Optional Tor integration**

  - Built-in Tor binary, with a simple toggle to route traffic through Tor.

  - Optional “keep Tor enabled” behaviour and a Tor-check tab when you turn it on.


- **Bookmarks, passwords & search**

  - Simple bookmarks manager with search and Netscape HTML import/export.

  - Local-only password manager protected by a master password.

  - Built-in autofill flows credentials directly from storage into forms (without using the system clipboard).

  - Search across open tabs and smart address bar suggestions from history and bookmarks.


- **Predictable downloads & safe uploads**

  - Dedicated sandboxed folders for downloads (`mDownloads`) and uploads (`mDocuments`) under `~/.local/share/merezhyvo.naz.r/`.

  - Compatible with symlinks from your usual `Downloads` / documents directories.


- **Integrated on-screen keyboard**

  - Custom OSK tailored for the browser with multiple layouts (including `en`, `uk`, `de`, `pl`, `fr`, `es`, `it`, `pt`, `tr`, `nl`, `no`, `ro`, `ar`).

  - Long-press alternates, symbol pages, Caps Lock via long-press Shift and layout switching managed in **Settings → Keyboard**.


- ### Localization

*   App UI is available in multiple languages:

    *   English
    *   Ukrainian
    *   French
    *   German
    *   Polish
    *   Dutch
    *   Spanish
    *   Italian
    *   Norwegian

*   More translations can be added over time based on user feedback.
    

- - -

## Project layout (high level)

The repository is organised roughly as follows:


src/ # React renderer (UI, pages, modals, keyboard, etc.)

  App.tsx

  index.tsx

  components/

  keyboard/

...
  
electron/ # Electron main process and preload

  main.ts # Electron app lifecycle, windows, IPC

  preload.ts # exposes window.merezhyvo.\* to the renderer

  lib/ # main-process helpers (settings, Tor, geo, etc.)


assets/

  blocklists/ # generated domain lists used by the blocker

    trackers.seed.txt # small committed fallback list

    ads.seed.txt # small committed fallback list

    trackers.txt # generated during build (ignored by git)

    ads.txt # generated during build (ignored by git)


resources/

  tor/tor # cached Tor binary (host side, before packaging)

  tor/LICENSE # cached Tor license text

  tor/version.txt # cached Tor version

  legal/LICENSE.txt # Merezhyvo application license text

  legal/THIRD-PARTY-NOTICES.txt # generated third-party notices


tools/

  build-click.sh # one-shot full build to .click

  update-blocklists.mjs # downloads and generates trackers.txt / ads.txt during build (with seed fallback)

  tor-update.sh # refresh cached Tor binary/license/version


manifest.json # Click manifest

merezhyvo.apparmor # AppArmor profile (confined)

app.desktop # Launcher entry for Lomiri

package.json

README.md


...

Details may change over time, but this should give you a rough mental model of where things live.

- - -

## Prerequisites (development machine)

You need a Linux dev machine with:

*   **Node.js 18+** and **npm** (using `nvm` is recommended);
    
*   **Clickable** installed and working (`clickable --version`);
    
*   **Docker** running (Clickable uses it to build the final `.click`).
    

Quick sanity check:

node \-v

npm \-v

clickable \--version

docker ps

- - -

## Updating the embedded Tor binary (optional)

Merezhyvo embeds the `tor` binary from a Debian package. The cached copy lives under `resources/tor/`.

If you want to refresh it to the latest supported Tor package, run:

./tools/tor-update.sh

This script will:

1.  Remove any existing cached Tor files from `resources/tor/`.
    
2.  Download the Tor `.deb` for arm64 (URL can be overridden via `TOR_DEB_URL`).
    
3.  Extract `/usr/bin/tor`, the license and version.
    
4.  Save them into `resources/tor/` as:
    
    *   `tor` (binary),
        
    *   `LICENSE` (Tor license text),
        
    *   `version.txt` (plain-text version string).
        

The build script then copies these into the final `app/resources/tor/` inside the `.click`.

- - -

## Building the .click package

The main entry point is:

./tools/build-click.sh

This script will:

1.  Ensure there is a cached Tor binary under `resources/tor/` (downloading and extracting from `.deb` if needed).
    
2.  Run `npm ci` to install dependencies.

3.  Update the tracker/ad domain blocklists into `assets/blocklists/` (using seed files as fallback if offline).
    
4.  Run `npm run package` to build the React UI and package the Electron app into `./app/` for arm64.
    
5.  Copy UT-specific resources (e.g. `location_once.qml`) and the Tor binary into `app/resources/`.
    
6.  Run **Clickable** to build the `.click` using the Ubuntu Touch 24.04 framework.
    

The resulting `.click` file will be placed in the `build/` directory, for example:

build/merezhyvo.naz.r\_0.1.0\_arm64.click

If you prefer to run the steps manually, you can also do:

npm ci

npm run build \# build React UI into dist/

npm run package \# package Electron app into app/

  

\# then inside the Clickable environment

clickable clean

clickable build \--arch arm64 \--accept\-review\-errors

- - -

## Settings & configuration

Internal settings are stored in a JSON file under the user's `~/.config` directory (for example `~/.config/merezhyvo.naz.r/settings.json`).

This includes UI preferences (theme, scaling, keyboard layouts), privacy and security options (HTTPS mode, WebRTC policy, third-party cookie setting, tracker/ad blocking), and per-site exception lists.


- - -

## Privacy

*   No tracking, no analytics, no telemetry.
    *   Merezhyvo does not send usage data to remote servers and does not embed third-party analytics or crash reporting.
*   All browsing data (history, bookmarks, passwords, cookies, site data) stays inside the app sandbox on the device.

Merezhyvo includes several tools that can help improve privacy:

*   **Configurable HTTPS mode (Strict / Preferred)** to encourage secure connections and warn when only HTTP is available.
*   **In-app certificate validation** with a clear shield indicator (white / yellow / red) and a popover with certificate status.
*   **Optional blocking of third-party cookies** with per-site exceptions for cases where functionality depends on them.
*   **Tracker and ad blocking (domain-based)** with separate global toggles and per-site exceptions.
*   **WebRTC privacy modes** (always allowed / always blocked / blocked when Tor is enabled).
*   **Site data management** page to inspect and clear stored cookies and site data per site, or wipe everything at once.

Tor support can further improve privacy by routing traffic through the Tor network, but:

*   Merezhyvo is **not** the official Tor Browser.
*   It does **not** include all Tor Browser hardening and fingerprinting protection.

For sensitive use, please follow the Tor Project's recommendations and combine Tor with good security practices.


- - -

## License

Merezhyvo uses a **proprietary “free to use, source available”** license:

*   The app is free to use.
    
*   The source code is published so that people can see how the browser works.
    
*   Reuse, modification, or redistribution of the **Merezhyvo code** is **not** automatically granted – please contact the author to discuss it.
    

The full license text for the app is stored in:

resources/legal/LICENSE.txt

### Third-party licenses

Merezhyvo is built on top of several third-party components, including but not limited to:

*   **Electron** (MIT license)
    
*   **Chromium** (various permissive licenses)
    
*   **Tor** (BSD-style license)
    
*   Various npm dependencies (MIT / Apache / BSD / ISC, etc.)
    

Third-party notices are collected and stored in:

resources/legal/THIRD-PARTY-NOTICES.txt

The Tor license and version used in the build are stored alongside the Tor binary under `resources/tor/` (and copied into `app/resources/tor/` in the final package).

In the running app, all of this information is surfaced under the **Licenses** / **About** sections.

- - -

## Contributing & feedback

Bug reports, suggestions and UX feedback are very welcome. The easiest ways to help:

*   Report bugs in existing features (tabs, downloads, file picker, bookmarks, password manager, Tor toggle, UI scaling, keyboard).
    
*   Share UX feedback: does the UI feel natural on your device? any small but annoying issues?
    

If you are interested in contributing code, please open an issue first to discuss ideas and to clarify what kind of contributions make sense for the project at its current stage.

- - -
