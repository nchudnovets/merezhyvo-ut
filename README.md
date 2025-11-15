- - -

# merezhyvo

**merezhyvo** is a minimalist Chromium browser for **Ubuntu Touch (Lomiri)**. It’s an Electron fullscreen window with a lightweight React UI, optimized for portrait mode. Where possible, hardware acceleration (VA-API, EGL) is enabled so video decoding happens on the GPU.

> ⚠️ Security: the package ships with an `unconfined` AppArmor profile. This is **for personal use only** (it will not pass OpenStore review).

## Highlights

*   Fullscreen under Lomiri; `Esc` exits the app.
    
*   Minimal UI: address bar + `<webview>` with a search fallback.
    *   Includes a **Messenger mode** toolbar with WhatsApp, Telegram, and Messenger shortcuts (desktop UA only) and per-user button ordering.
    
*   Local ARM64 Electron packaging; final `.click` is built via **Clickable** (container with `click` CLI).
    
*   Single `.click` artifact ready to sideload on your UT device.
    
*   **Integrated on-screen keyboard (OSK)** tailored for mobile:
    
    *   Based on `react-simple-keyboard`, Maliit-like layout and behavior.
        
    *   Multi-language: **EN, UK, DE, PL, ES, IT, PT, FR, TR, NL, RO, AR**.
        
    *   Long-press alternates (e.g., `o → ó, ö, ô, õ`; Ukrainian `ʼ, ґ, ₴`; Turkish `ğ, ş`, etc.).
        
    *   Symbols **1/2** pages, **Shift** tap for one uppercase, **Shift long-press → Caps**.
        
 *   Language switcher shows the current layout label **on the Space key**.

*   **Bookmarks & History manager** (service tabs `mzr://bookmarks`, `mzr://history`)
    *   Accessed only through the Tabs panel header (⭐ / 🕘). Bookmarks live in a single `MyBookmarks` root, with search/tag filtering, context menus, import/export dialogs, and selection helpers; history groups visits by time, supports per-item/domain removal, and shares the same scrollable service chrome.
        
    *   Works in the main window and inside the `<webview>` without stealing focus.
    *   Import/export now understands the Netscape bookmark HTML format (Chrome/Firefox compatible), with scoped preview counts, add/replace modes, canonical headers, icons persisted via `favicons`, and the same IPC surface exposed to renderer pages.
- **Permissions & privacy (new)**
  - Built-in permission broker for **geolocation, camera, microphone, notifications**.
  - Per-site rules (**Allow / Deny**) + **Global defaults** (**Prompt / Allow / Deny**).
  - UI: runtime **Permission Prompt** + **Settings → Permissions** panel (search/reset).
- **System notifications (new)**
  - Site `Notification` calls are **delivered via Lomiri system notifications** by default.
  - In-app toasts exist for debugging but are disabled by default.
- **Geolocation without Google API key (new)**
  - A system backend uses **QtPositioning** via a tiny QML helper (`qmlscene -platform offscreen`).
  - Falls back to GeoClue2 when available.
  - Works on-device without any Google Geolocation API/Billing.
- **Stable config path (new)**: all state lives under `~/.config/merezhyvo`.

        

## Project layout


``merezhyvo/ ├─ dist-electron/main.js          # Electron main (compiled from TS) ├─ src/ │  ├─ App.tsx │  ├─ index.html │  ├─ index.tsx                   # React renderer │  ├─ components/messenger/       # Messenger mode toolbar UI │  └─ keyboard/ │     ├─ KeyboardPane.tsx         # OSK component │     ├─ layouts.ts               # languages, long-press, symbols 1/2 │     ├─ keyboardCss.ts           # runtime CSS injection for OSK │     └─ inject.ts                # text injection (webview + main window) ├─ electron/ │  ├─ lib/messenger-settings.ts   # messenger order persistence │  ├─ lib/keyboard-settings.ts    # settings read/write (keyboard section) │  └─ preload.ts                  # exposes `window.merezhyvo.*` API ├─ app.desktop                    # Lomiri desktop file ├─ manifest.json                  # Click manifest ├─ merezhyvo.apparmor             # AppArmor (unconfined) ├─ merezhyvo_256.png              # app icon ├─ tools/ │  └─ build-click.sh              # one-shot end-to-end .click build ├─ package.json ├─ .electronignore └─ .gitignore``

## Prerequisites (on your dev machine)

*   **Node.js 18+** and **npm** (nvm recommended)
    
*   **Clickable** (pip/snap/apt — any installation where `clickable` works)
    
*   **Docker** (used by Clickable to build the final `.click`)
    

Quick check:

`node -v npm -v clickable --version docker ps`

## Packaging for Ubuntu Touch (.click)

> Two-stage process:
> 
> 1.  locally package ARM64 Electron into `./app/`
>     
> 2.  run Clickable in a container to produce the `.click`
>     

### One command


`tools/build-click.sh`

### Or step by step


`# 1) locally prepare ARM64 Electron payload npm ci npm run package  # 2) build .click (inside Clickable container with click CLI) clickable clean clickable build --arch arm64 --accept-review-errors`

The artifact will be in `build/`, e.g.:


`build/merezhyvo.naz.r_0.1.0_arm64.click`

> `manifest.json` uses `framework: "ubuntu-sdk-20.04"` and `architecture: ["@CLICK_ARCH@"]` (UT 24.04 compatible). Clickable substitutes `arm64`.

### Packaging notes

*   `apparmor.json` is referenced from `manifest.json → hooks.<your-hook>.apparmor`.
    
*   We copy `electron/ut/location_once.qml` into the package under `app/resources/ut/location_once.qml` so that `process.resourcesPath/ut/location_once.qml` is available on device.
    
*   `dbus-next` is used in the main process (GeoClue2 path). Esbuild excludes optional native `x11` with `--external:x11` in the **main** bundle.


## Install on device

Copy the `.click` to your phone and run on the **device** (via `adb shell` or SSH):


`click install /path/to/merezhyvo.naz.r_0.1.0_arm64.click`

Find **merezhyvo** in the launcher. If it doesn’t start, run manually to see logs:

`adb shell cd /opt/click.ubuntu.com/merezhyvo.naz.r/current ./app/merezhyvo`


## On-screen keyboard (OSK) & Settings

*   **Languages supported**: `en, uk, de, pl, es, it, pt, fr, tr, nl, ro, ar`
    
*   **Symbols**: two pages (`1/2`) with common and extended symbols/currency.
    
*   **Long-press**: alternative characters per language (e.g., `ñ, ä, ß, ₴, ğ, ș/ţ`, etc.).
    
*   **Shift / Caps**: tap for Shift; long-press Shift for Caps (icon switches to `⇪`).
    
*   **Language switch**: cycles enabled layouts; active language label shown on **Space**.
    

### Where OSK settings live

*   File: `~/.config/<AppName>/settings.json`

    `{   "keyboard": {     "enabledLayouts": ["en", "uk", "de"],     "defaultLayout": "en"   },   "messenger": { "order": ["whatsapp", "telegram", "messenger"] } }`

*   In-app: **Settings → Keyboard**
    
    *   Enable/disable layouts (at least one must remain enabled).
        
    *   Set a default layout.
        
    *   Click **Save** to persist. The UI applies changes immediately.
        
*   Messenger toolbar order is stored under `messenger.order` and can be rearranged in **Settings → Messenger toolbar**.

- - -

## Permissions & Prompts

*   **Permission Prompt** appears on first use (per origin) for: **geolocation, camera, microphone, notifications**.
    
*   Decisions can be persisted per-site (Allow/Deny) or handled by **Global defaults** (Prompt/Allow/Deny per type).
    
*   Manage saved rules in **Settings → Permissions**:
    
    *   Search by origin, clear one or all.
        
    *   Adjust Global defaults.
        
*   Chromium‐side `session.setPermissionRequestHandler` is wired to the same broker, so native permission requests and our “soft requests” share one UI and storage.
    

- - -

## Notifications

*   Site calls to `new Notification(title, options)` are intercepted in the WebView and **forwarded to system notifications**.
    
*   If system notifications are not available, an internal toast center can be enabled for development (off by default).
    

- - -

## Geolocation (no Google API key)

*   We override `navigator.geolocation` in the **page’s main world** (CSP-safe), and dispatch requests to the main process.
    
*   Main process tries:
    
    1.  **QtPositioning** via `qmlscene -platform offscreen` and `electron/ut/location_once.qml`.
        
    2.  **GeoClue2** via D-Bus (`org.freedesktop.GeoClue2`) if present.
        
*   This avoids the Chromium Google WebService provider and works on UT without any Google keys.
    
### Requirements on device

*   `qmlscene`, Qt offscreen platform plugin, and `QtPositioning` QML module (present on stock UT images).
    
*   AppArmor policy groups include: `location`, `networking` (plus `camera`, `microphone`, `audio` for other features).

### Debugging

*   Logs are written to `~/.config/merezhyvo/geo.log`.
    
*   Typical useful commands on device:
    
    bash
    
    Копіювати код
    
    `tail -f ~/.config/merezhyvo/geo.log journalctl -kf | grep -i 'apparmor\|denied' journalctl -f  | grep -Ei 'qmlscene|QtPositioning|geoclue|lomiri' which qmlscene && qmlscene -version`


## Bookmarks & History

*   Service tabs `mzr://bookmarks` and `mzr://history` are reached only through the Tabs panel header buttons (⭐ / 🕘) so they never persist as regular tabs.
*   **Bookmarks** live under the single `MyBookmarks` root (`profiles/<profile>/bookmarks.json`). The UI gives search (title/URL/tags), tag chips, breadcrumbs, folder picker, context menus (open/edit/move/delete), selection mode, import/export, and a star control on each tab card. Backend writes are atomic and URLs are normalized.
*   **History** is append-only NDJSON (`profiles/<profile>/history.ndjson`), driven by webview navigation/title/favicon events, grouped by time buckets, searchable, and supports item/domain removal plus “clear all”, with favicons stored under `profiles/<profile>/favicons/<sha1>.<ext>` and provided via the preload API.


## Scripts

*   `npm run lint` — static code analysis (ESLint)
    
*   `npm run typecheck` — TypeScript check without emit
    
*   `npm run build` — build UI (React → `dist/`)
    
*   `npm run package` — build + package Electron ARM64 into `app/`
    
*   `tools/build-click.sh` — full cycle to `.click`
    

## Known limitations

*   AppArmor profile is **unconfined** → not OpenStore-ready.
    
*   Browser features (history/bookmarks/passwords) are **WIP**.
    
*   UT specifics: graphics flags can vary by device; see “Rendering tips”.
    

## Troubleshooting

*   **“No space left on device” during electron-packager**  
    Usually recursive packaging because `build/` got included. Clean `build/` and verify `.electronignore`.
    
*   **Clickable complains about framework/maintainer**  
    Use `framework: "ubuntu-sdk-20.04"` and `Maintainer: "Name <email>"`. For `unconfined`, pass `--accept-review-errors`.
    
*   **`click: command not found` on host**  
    You don’t need it locally — Clickable runs it inside the container.
    
*   **OSK does not appear or doesn’t type**  
    Ensure at least one language layout is enabled in Settings; defaults to `en`. The OSK listens to focus changes in inputs (`<input>`, `<textarea>`, `contenteditable`) both in the main window and inside `<webview>`.
    

## License

MIT © Naz.R

- - -
