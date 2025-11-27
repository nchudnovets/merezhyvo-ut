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

### Ubuntu Touch–first design

*   Runs as a **confined** UT app.
    
*   Plays nicely with the UT sandbox and AppArmor policy.
    
*   File access is intentionally limited to internal app folders.
    

### Convergent UI (phone & desktop)

*   UI designed for mobile screens but works well in convergence mode with external display, keyboard and mouse.
    
*   **UI scaling** option to change the size of browser chrome (toolbar, tabs, controls) independently from page zoom, so you can tune it to your particular screen and DPI.
    

### Tor integration (optional)

*   Bundles the **Tor** binary as part of the app (downloaded from a Debian package during build and cached in `resources/tor/`).
    
*   Single toggle in the UI to route traffic through Tor.
    
*   Automatic Tor check tab when Tor is enabled, with an option to start Tor on browser launch ("Keep Tor enabled").
    
*   Tor version and license are displayed in the **About** / **Licenses** sections.
    

> Note: Merezhyvo uses Tor as an optional connection layer, but it is **not** the official Tor Browser and does **not** implement all of Tor Browser's fingerprinting protections.

### Bookmarks and password manager

*   Simple bookmark system:
    
    *   one root tree, search and basic filtering;
        
    *   import/export using the standard Netscape bookmark HTML format (Chrome/Firefox compatible).
        
*   Basic password manager:
    
    *   local storage only;
        
    *   protected with a master password.
        

### Predictable downloads & safe uploads

To respect confinement and keep the model simple, the browser uses two dedicated folders inside the app sandbox:

*   **Downloads:**
    
    *   all HTTP/HTTPS downloads go to:
        
        *   `~/.local/share/merezhyvo.naz.r/mDownloads`
            
    *   the system file dialog is skipped for downloads.
        
    *   You can create a symlink from your regular `Downloads` folder to this path for easier access from the file manager.
        
*   **Uploads / imports:**
    
    *   file pickers (imports/exports, `<input type="file">`, etc.) are pinned to:
        
        *   `~/.local/share/merezhyvo.naz.r/mDocuments`
            
    *   a message explains this restriction and shows a one-liner command to create a convenient symlink.
        

Both folders are created automatically on first start if they do not exist.

### Integrated on-screen keyboard (OSK)

*   Custom on-screen keyboard tailored for the browser (based on `react-simple-keyboard`).
    
*   **12 languages/layouts** supported (including `en`, `uk`, `de`, `pl`, `es`, `it`, `pt`, `fr`, `tr`, `nl`, `ro`, `ar`).
    
*   Features:
    
    *   long-press alternates (e.g. `ó, ö, ô, ñ, ä, ß, ₴, ğ, ş` ...);
        
    *   two symbol pages (`1/2`);
        
    *   tap **Shift** for one uppercase; long-press **Shift** for Caps Lock;
        
    *   language switch cycles enabled layouts; current layout label is shown on the **Space** key.
        
*   All keyboard settings are managed in **Settings → Keyboard**.
    

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

resources/
  app.asar # packaged renderer
  ut/location\_once.qml # UT-specific QML snippet
  tor/tor # embedded Tor binary (copied at build time)
  tor/LICENSE # Tor license
  tor/version.txt # Tor version used in this build

resources/
  tor/tor # cached Tor binary (host side, before packaging)
  tor/LICENSE # cached Tor license text
  tor/version.txt # cached Tor version
  legal/LICENSE.txt # Merezhyvo application license text
  legal/THIRD-PARTY-NOTICES.txt # generated third-party notices

tools/
  build-click.sh # one-shot full build to .click
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
    
3.  Run `npm run package` to build the React UI and package the Electron app into `./app/` for arm64.
    
4.  Copy UT-specific resources (e.g. `location_once.qml`) and the Tor binary into `app/resources/`.
    
5.  Run **Clickable** to build the `.click` using the Ubuntu Touch 24.04 framework.
    

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

- - -

## Privacy

*   No tracking, no analytics, no telemetry.
    
*   No calls to third-party analytics or crash reporting services.
    
*   All browsing data (history, bookmarks, passwords) stays inside the app sandbox on the device.
    

Tor support can improve privacy by routing traffic through the Tor network, but:

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
