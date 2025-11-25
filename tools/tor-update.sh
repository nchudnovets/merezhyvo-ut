#!/usr/bin/env bash
set -euo pipefail

# Перейти в корінь репозиторію (tools/..)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}/.."
cd "${REPO_ROOT}"

TOR_DIR="resources/tor"
TOR_SOURCE_BIN="${TOR_DIR}/tor"
TOR_LICENSE_SOURCE="${TOR_DIR}/LICENSE"
TOR_VERSION_SOURCE="${TOR_DIR}/version.txt"

DEBIAN_POOL_URL_DEFAULT="https://ftp.debian.org/debian/pool/main/t/tor/"

echo "==> Tor update: cleaning cache in ${TOR_DIR}"
rm -rf "${TOR_DIR}"
mkdir -p "${TOR_DIR}"

# Визначити URL .deb:
# 1) якщо вказано TOR_DEB_URL у середовищі — використовуємо його;
# 2) інакше автоматично визначаємо останній tor_*_arm64.deb з Debian pool.
if [ "${TOR_DEB_URL:-}" != "" ]; then
  TOR_DEB_URL_RESOLVED="${TOR_DEB_URL}"
  echo "==> Using TOR_DEB_URL from environment:"
  echo "    ${TOR_DEB_URL_RESOLVED}"
else
  echo "==> Discovering latest tor arm64 .deb from Debian pool..."
  if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
    echo "ERROR: neither curl nor wget found. Cannot fetch index from Debian pool."
    exit 1
  fi

  # завантажуємо HTML/листинг каталогу
  if command -v curl >/dev/null 2>&1; then
    INDEX_HTML="$(curl -fsSL "${DEBIAN_POOL_URL_DEFAULT}")"
  else
    INDEX_HTML="$(wget -qO- "${DEBIAN_POOL_URL_DEFAULT}")"
  fi

  # шукаємо всі tor_*_arm64.deb, сортуємо за версією, беремо останній
  TOR_DEB_FILE="$(printf '%s\n' "${INDEX_HTML}" \
    | grep -o 'tor_[0-9][0-9a-zA-Z\.\+\:\~\-]*_arm64\.deb' \
    | sort -u -V \
    | tail -n1 || true)"

  if [ -z "${TOR_DEB_FILE}" ]; then
    echo "ERROR: failed to detect latest tor_*_arm64.deb in Debian pool index."
    exit 1
  fi

  TOR_DEB_URL_RESOLVED="${DEBIAN_POOL_URL_DEFAULT}${TOR_DEB_FILE}"
  echo "    Detected latest deb: ${TOR_DEB_FILE}"
  echo "    Full URL: ${TOR_DEB_URL_RESOLVED}"
fi

TMP_DIR="$(mktemp -d)"
TOR_DEB="${TMP_DIR}/tor.deb"
ROOTFS_DIR="${TMP_DIR}/rootfs"
mkdir -p "${ROOTFS_DIR}"

echo "==> Downloading tor deb package..."
if command -v curl >/dev/null 2>&1; then
  curl -L "${TOR_DEB_URL_RESOLVED}" -o "${TOR_DEB}"
elif command -v wget >/dev/null 2>&1; then
  wget -O "${TOR_DEB}" "${TOR_DEB_URL_RESOLVED}"
fi

if ! command -v dpkg-deb >/dev/null 2>&1; then
  echo "ERROR: dpkg-deb is not installed. Install dpkg (or dpkg-dev) on the host."
  rm -rf "${TMP_DIR}"
  exit 1
fi

echo "==> Extracting deb contents..."
dpkg-deb -x "${TOR_DEB}" "${ROOTFS_DIR}"

if [ ! -f "${ROOTFS_DIR}/usr/bin/tor" ]; then
  echo "ERROR: /usr/bin/tor not found inside extracted .deb."
  echo "       URL used: ${TOR_DEB_URL_RESOLVED}"
  rm -rf "${TMP_DIR}"
  exit 1
fi

echo "==> Reading tor version from deb metadata..."
TOR_VERSION="$(dpkg-deb -f "${TOR_DEB}" Version || echo "unknown")"
printf '%s\n' "${TOR_VERSION}" > "${TOR_VERSION_SOURCE}"
echo "    Tor version: ${TOR_VERSION}"

echo "==> Extracting tor license/copyright..."
TOR_COPYRIGHT_PATH="${ROOTFS_DIR}/usr/share/doc/tor/copyright"
if [ -f "${TOR_COPYRIGHT_PATH}" ]; then
  cp "${TOR_COPYRIGHT_PATH}" "${TOR_LICENSE_SOURCE}"
else
  echo "WARNING: tor copyright file not found in deb; writing placeholder LICENSE."
  printf 'Tor license file not found in deb package.\n' > "${TOR_LICENSE_SOURCE}"
fi

echo "==> Copying tor binary to ${TOR_SOURCE_BIN}"
cp "${ROOTFS_DIR}/usr/bin/tor" "${TOR_SOURCE_BIN}"
chmod +x "${TOR_SOURCE_BIN}"

rm -rf "${TMP_DIR}"

echo "==> Tor update completed."
echo "    Cached files:"
echo "      ${TOR_SOURCE_BIN}"
echo "      ${TOR_LICENSE_SOURCE}"
echo "      ${TOR_VERSION_SOURCE}"
echo "    You can now run tools/build-click.sh to rebuild the .click."