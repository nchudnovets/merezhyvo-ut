- - -

# merezhyvo

merezhyvo — мінімалістичний Chromium-браузер для **Ubuntu Touch (Lomiri)**. Це повноекранне вікно Electron з легким React-UI, оптимізоване під портретний режим. Включені прапорці апаратного прискорення (VA-API, EGL) — де можливо, відео декодується на GPU.

> ⚠️ Безпека: пакет використовує AppArmor-профіль `unconfined`. Це **лише для особистого використання** (не пройде рев’ю OpenStore).

## Highlights

*   Повноекранний запуск під Lomiri; `Esc` закриває вікно.
    
*   Просте UI: адресний рядок + `<webview>` із пошуковим фолбеком.
    
*   ARM64-збірка Electron пакується **локально**, `.click` збирається **через Clickable** (контейнер, де є `click` CLI).
    
*   Один `.click` артефакт для встановлення на пристрій UT.
    

## Project layout

bash

Копіювати код

`merezhyvo/ ├─ electron/main.js        # головний процес Electron ├─ src/ │  ├─ App.js │  ├─ index.html │  └─ index.js            # React renderer ├─ app.desktop             # Lomiri desktop-файл ├─ manifest.json           # Click manifest ├─ merezhyvo.apparmor      # AppArmor (unconfined) ├─ package.json            # Node/Electron налаштування ├─ merezhyvo_256.png                # іконка застосунку ├─ tools/ │  └─ build-click.sh       # скрипт повної збірки (.click) ├─ .electronignore └─ .gitignore`

## Prerequisites (на робочій машині)

*   **Node.js 18+** та **npm** (рекомендовано через nvm).
    
*   **Clickable** (pip-версія або snap/apt — будь-яка, важливо щоб працювала команда `clickable`).
    
*   **Docker** для Clickable-контейнера (саме для упакування `.click`; npm ми запускаємо локально).
    

Перевірка:

bash

Копіювати код

`node -v npm -v clickable --version docker ps`

## Local development

bash

Копіювати код

`npm install npm start`

*   `npm start` зіб’є React у `dist/` і запустить Electron: `electron electron/main.js`.
    
*   Для повноекранного тесту на ПК додай:  
    `npm start -- -- --fullscreen`
    

## Packaging for Ubuntu Touch (.click)

> Ми використовуємо **двоетапну** схему:  
> (1) локально пакуємо ARM64 Electron → `./app/`  
> (2) Clickable у контейнері збирає `.click` (там є `click` CLI).

### Один рядок

bash

Копіювати код

`tools/build-click.sh`

### Або вручну, покроково

bash

Копіювати код

`# 1) Локально: зібрати ARM64 Electron і підготувати ./app/ npm ci npm run package  # 2) Упакувати в .click (через контейнер із click CLI) clickable clean clickable build --arch arm64 --accept-review-errors`

Після успіху артефакт лежить у `build/`, наприклад:

arduino

Копіювати код

`build/merezhyvo.naz.r_0.1.0_arm64.click`

> Маніфест використовує `framework: "ubuntu-sdk-20.04"` та `architecture: ["@CLICK_ARCH@"]`. Це сумісно з UT 24.04, а Clickable автоматично підставить `arm64`.

## Install на пристрій

Скопіюй `.click` на телефон і виконай на **самому пристрої** (через `adb shell` або SSH):

bash

Копіювати код

`click install /path/to/merezhyvo.naz.r_0.1.0_arm64.click`

Після встановлення шукай іконку **merezhyvo**. Якщо запуск із лаунчера мовчить — подивись лог вручну:

bash

Копіювати код

`adb shell cd /opt/click.ubuntu.com/merezhyvo.naz.r/current ./app/merezhyvo`

### Підказки по рендеру

Якщо чорний екран/миготіння — спробуй змінити Exec у `app.desktop`:

*   з `env OZONE_PLATFORM=wayland ./app/merezhyvo --fullscreen`
    
*   на просто `./app/merezhyvo --fullscreen` (без OZONE),
    
*   або навпаки додати `--enable-features=UseOzonePlatform`.
    

## Scripts

*   **`npm run build`** — збірка UI (React → `dist/`).
    
*   **`npm run package`** — `build` + пакування Electron ARM64 у `app/`.
    
*   **`tools/build-click.sh`** — повний цикл до `.click`.
    

## Known limitations

*   AppArmor: `unconfined` (приватна інсталяція, не для OpenStore).
    
*   On-screen keyboard (OSK) у мобільному режимі поки **не інтегрована** (фокус на desktop/convergence).
    
*   Рамка UI мінімальна; історія/закладки/паролі — WIP.
    

## License

MIT © Naz.R

- - -

### Додаток: типові збої та швидкі фікси

*   **`ENOSPC: no space left on device` під час electron-packager**  
    Зазвичай це рекурсивне пакування через включення `build/` у вхід. Вирішено `.electronignore` та очищення `build/` перед `npm run package`.
    
*   **Clickable лається на framework/maintainer**  
    Використовуй `framework: "ubuntu-sdk-20.04"` та формат `Maintainer: "Name <email>"`. Для `unconfined` додавай `--accept-review-errors`.
    
*   **`click: command not found` на хості**  
    Ми його не використовуємо напряму; пакування робить Clickable у контейнері (`clickable build --arch arm64 …`).