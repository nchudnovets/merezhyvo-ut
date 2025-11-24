#!/usr/bin/env bash
set -euo pipefail

# Перейти в корінь репозиторію (tools/..)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}/.."
cd "${REPO_ROOT}"

APP_NAME="merezhyvo.naz.r"
ARCH="arm64"
OUT_DIR="build"

# .deb, з якого витягаємо tor (arm64)
TOR_DEB_URL_DEFAULT="https://ftp.debian.org/debian/pool/main/t/tor/tor_0.4.5.16-1_arm64.deb"

# Шлях до "кешованого" бінарника tor у репозиторії
TOR_SOURCE_BIN="resources/tor/tor"
# Шлях, куди його треба покласти у зібраний app/
TOR_TARGET_BIN="app/resources/tor/tor"

echo "==> Pre-clean build/"
rm -rf build || true

echo "==> Step 0: ensure cached Tor binary (${TOR_SOURCE_BIN})"

if [ -f "${TOR_SOURCE_BIN}" ]; then
  echo "    Tor source binary already present, skipping download."
else
  TOR_DEB_URL="${TOR_DEB_URL:-$TOR_DEB_URL_DEFAULT}"

  echo "    Tor binary not found, fetching from:"
  echo "      ${TOR_DEB_URL}"

  TMP_DIR="$(mktemp -d)"
  TOR_DEB="${TMP_DIR}/tor.deb"
  ROOTFS_DIR="${TMP_DIR}/rootfs"

  mkdir -p "${ROOTFS_DIR}"

  # завантаження .deb (curl або wget)
  if command -v curl >/dev/null 2>&1; then
    curl -L "${TOR_DEB_URL}" -o "${TOR_DEB}"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "${TOR_DEB}" "${TOR_DEB_URL}"
  else
    echo "ERROR: neither curl nor wget found. Cannot download Tor .deb."
    exit 1
  fi

  if ! command -v dpkg-deb >/dev/null 2>&1; then
    echo "ERROR: dpkg-deb is not installed. Install dpkg (or dpkg-dev) on the host."
    exit 1
  fi

  echo "    Extracting tor from .deb..."
  dpkg-deb -x "${TOR_DEB}" "${ROOTFS_DIR}"

  if [ ! -f "${ROOTFS_DIR}/usr/bin/tor" ]; then
    echo "ERROR: /usr/bin/tor not found inside extracted .deb."
    echo "       Check TOR_DEB_URL or package contents."
    exit 1
  fi

  echo "    Copying tor to ${TOR_SOURCE_BIN}"
  mkdir -p "$(dirname "${TOR_SOURCE_BIN}")"
  cp "${ROOTFS_DIR}/usr/bin/tor" "${TOR_SOURCE_BIN}"
  chmod +x "${TOR_SOURCE_BIN}"

  rm -rf "${TMP_DIR}"

  echo "    Tor source binary cached successfully."
fi

echo "==> Step 1/3: npm ci"
npm ci

echo "==> Step 2/3: npm run package (build React + pack Electron for ${ARCH})"
npm run package

# Додати QML для UT
mkdir -p app/resources/ut
cp electron/ut/location_once.qml app/resources/ut/location_once.qml

# Скопіювати tor всередину зібраного app/
echo "==> Step 2.5: copy Tor into app/resources"
if [ ! -f "${TOR_SOURCE_BIN}" ]; then
  echo "ERROR: cached Tor binary ${TOR_SOURCE_BIN} is missing after package step."
  exit 1
fi

mkdir -p "$(dirname "${TOR_TARGET_BIN}")"
cp "${TOR_SOURCE_BIN}" "${TOR_TARGET_BIN}"
chmod +x "${TOR_TARGET_BIN}"

# sanity-check: бінар має існувати
if [ ! -f "./app/merezhyvo" ]; then
  echo "ERROR: ./app/merezhyvo не знайдено після 'npm run package'."
  exit 1
fi

echo "==> Step 3/3: clickable build (.click packaging)"
export CLICKABLE_FRAMEWORK='ubuntu-touch-24.04-1.x'
clickable clean || true
clickable build --arch "${ARCH}" --accept-review-errors

echo "==> Done. Перевір ${OUT_DIR}/ на наявність *.click"
