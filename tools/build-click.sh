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
TOR_DEB_URL_DEFAULT="https://ftp.debian.org/debian/pool/main/t/tor/tor_0.4.8.16-1_arm64.deb"

# Шлях до "кешованого" бінарника tor у репозиторії
TOR_SOURCE_BIN="resources/tor/tor"
TOR_LICENSE_SOURCE="resources/tor/LICENSE"
TOR_VERSION_SOURCE="resources/tor/version.txt"

# Шляхи, куди їх треба покласти у зібраний app/
TOR_TARGET_BIN="app/resources/tor/tor"
TOR_LICENSE_TARGET="app/resources/tor/LICENSE"
TOR_VERSION_TARGET="app/resources/tor/version.txt"

echo "==> Pre-clean build/"
rm -rf build || true

echo "==> Step 0: ensure cached Tor binary and metadata (${TOR_SOURCE_BIN})"

if [ -f "${TOR_SOURCE_BIN}" ] && [ -f "${TOR_LICENSE_SOURCE}" ] && [ -f "${TOR_VERSION_SOURCE}" ]; then
  echo "    Tor source binary and metadata already present, skipping download."
else
  TOR_DEB_URL="${TOR_DEB_URL:-$TOR_DEB_URL_DEFAULT}"

  echo "    Tor binary not found or metadata missing, fetching from:"
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

  # зчитати версію tor з метаданих deb
  echo "    Reading tor version from .deb metadata..."
  TOR_VERSION="$(dpkg-deb -f "${TOR_DEB}" Version || echo "unknown")"
  mkdir -p "$(dirname "${TOR_VERSION_SOURCE}")"
  printf '%s\n' "${TOR_VERSION}" > "${TOR_VERSION_SOURCE}"
  echo "    Tor version: ${TOR_VERSION}"

  # витягти license/copyright
  TOR_COPYRIGHT_PATH="${ROOTFS_DIR}/usr/share/doc/tor/copyright"
  mkdir -p "$(dirname "${TOR_LICENSE_SOURCE}")"
  if [ -f "${TOR_COPYRIGHT_PATH}" ]; then
    echo "    Copying tor license from deb copyright file..."
    cp "${TOR_COPYRIGHT_PATH}" "${TOR_LICENSE_SOURCE}"
  else
    echo "WARNING: tor copyright file not found in deb; writing placeholder LICENSE."
    printf 'Tor license file not found in deb package.\n' > "${TOR_LICENSE_SOURCE}"
  fi

  echo "    Copying tor binary to ${TOR_SOURCE_BIN}"
  mkdir -p "$(dirname "${TOR_SOURCE_BIN}")"
  cp "${ROOTFS_DIR}/usr/bin/tor" "${TOR_SOURCE_BIN}"
  chmod +x "${TOR_SOURCE_BIN}"

  rm -rf "${TMP_DIR}"

  echo "    Tor source binary and metadata cached successfully."
fi

echo "==> Step 1/3: npm ci"
npm ci

echo "==> Step 2/3: npm run package (build React + pack Electron for ${ARCH})"
npm run package

# Додати QML для UT
mkdir -p app/resources/ut
cp electron/ut/location_once.qml app/resources/ut/location_once.qml

# Скопіювати tor та його метадані всередину зібраного app/
echo "==> Step 2.5: copy Tor and metadata into app/resources"
if [ ! -f "${TOR_SOURCE_BIN}" ] || [ ! -f "${TOR_LICENSE_SOURCE}" ] || [ ! -f "${TOR_VERSION_SOURCE}" ]; then
  echo "ERROR: cached Tor binary and/or metadata missing."
  echo "       Expected:"
  echo "         ${TOR_SOURCE_BIN}"
  echo "         ${TOR_LICENSE_SOURCE}"
  echo "         ${TOR_VERSION_SOURCE}"
  exit 1
fi

mkdir -p "$(dirname "${TOR_TARGET_BIN}")"
cp "${TOR_SOURCE_BIN}" "${TOR_TARGET_BIN}"
chmod +x "${TOR_TARGET_BIN}"

cp "${TOR_LICENSE_SOURCE}" "${TOR_LICENSE_TARGET}"
cp "${TOR_VERSION_SOURCE}" "${TOR_VERSION_TARGET}"

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
