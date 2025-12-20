#!/usr/bin/env bash
set -euo pipefail

# Move to the repository root (tools/..)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}/.."
cd "${REPO_ROOT}"

APP_NAME="merezhyvo.naz.r"
ARCH="arm64"
OUT_DIR="build"

# .deb package we extract Tor from (arm64)
TOR_DEB_URL_DEFAULT="https://ftp.debian.org/debian/pool/main/t/tor/tor_0.4.8.16-1_arm64.deb"

# Cached Tor binary + metadata stored in the repo
TOR_SOURCE_BIN="resources/tor/tor"
TOR_LICENSE_SOURCE="resources/tor/LICENSE"
TOR_VERSION_SOURCE="resources/tor/version.txt"

# Where they must end up inside the packaged app/
TOR_TARGET_BIN="app/resources/tor/tor"
TOR_LICENSE_TARGET="app/resources/tor/LICENSE"
TOR_VERSION_TARGET="app/resources/tor/version.txt"

# Legal notices (licenses, third-party notices, blocklists notices)
LEGAL_SOURCE_DIR="resources/legal"
LEGAL_TARGET_DIR="app/resources/legal"

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

  # Download .deb (curl or wget)
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

  # Read Tor version from deb metadata
  echo "    Reading tor version from .deb metadata..."
  TOR_VERSION="$(dpkg-deb -f "${TOR_DEB}" Version || echo "unknown")"
  mkdir -p "$(dirname "${TOR_VERSION_SOURCE}")"
  printf '%s\n' "${TOR_VERSION}" > "${TOR_VERSION_SOURCE}"
  echo "    Tor version: ${TOR_VERSION}"

  # Extract license/copyright
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

echo "==> Step 1/4: npm ci"
npm ci

echo "==> Step 2/4: update blocklists (trackers/ads) -> assets/blocklists/"
# Set MEREZHYVO_OFFLINE=1 to skip downloading and use existing lists (or seeds)
if [ "${MEREZHYVO_OFFLINE:-0}" = "1" ]; then
  node tools/update-blocklists.mjs --offline --out assets/blocklists
else
  if ! node tools/update-blocklists.mjs --out assets/blocklists; then
    echo "WARNING: blocklist update failed; continuing with existing lists (or seeds)."
  fi
fi

# Seed fallback: if generated lists are missing, copy from seeds
mkdir -p assets/blocklists

if [ ! -f "assets/blocklists/trackers.txt" ]; then
  if [ -f "assets/blocklists/trackers.seed.txt" ]; then
    echo "[blocklists] trackers.txt missing -> using trackers.seed.txt"
    cp assets/blocklists/trackers.seed.txt assets/blocklists/trackers.txt
  else
    echo "ERROR: assets/blocklists/trackers.txt is missing and trackers.seed.txt not found."
    exit 1
  fi
fi

if [ ! -f "assets/blocklists/ads.txt" ]; then
  if [ -f "assets/blocklists/ads.seed.txt" ]; then
    echo "[blocklists] ads.txt missing -> using ads.seed.txt"
    cp assets/blocklists/ads.seed.txt assets/blocklists/ads.txt
  else
    echo "ERROR: assets/blocklists/ads.txt is missing and ads.seed.txt not found."
    exit 1
  fi
fi

echo "==> Step 3/4: npm run package (build React + pack Electron for ${ARCH})"
npm run package

# Add UT QML helper(s)
mkdir -p app/resources/ut
cp electron/ut/location_once.qml app/resources/ut/location_once.qml

# Copy Tor and metadata into the packaged app/resources
echo "==> Step 3.5: copy Tor and metadata into app/resources"
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

echo "==> Step 3.6: copy legal notices into app/resources/legal"
if [ ! -d "${LEGAL_SOURCE_DIR}" ]; then
  echo "ERROR: ${LEGAL_SOURCE_DIR} not found."
  exit 1
fi

mkdir -p "${LEGAL_TARGET_DIR}"
cp -a "${LEGAL_SOURCE_DIR}/." "${LEGAL_TARGET_DIR}/"

# Sanity-check: expected legal files should exist in the packaged app
REQUIRED_LEGAL_FILES=(
  "${LEGAL_TARGET_DIR}/LICENSE.txt"
  "${LEGAL_TARGET_DIR}/THIRD-PARTY-NOTICES.txt"
  "${LEGAL_TARGET_DIR}/BLOCKLISTS-NOTICES.txt"
  "${LEGAL_TARGET_DIR}/GPL-3.0.txt"
)

for f in "${REQUIRED_LEGAL_FILES[@]}"; do
  if [ ! -f "${f}" ]; then
    echo "WARNING: missing legal file in packaged app: ${f}"
  fi
done

# Sanity check: the packaged binary must exist
if [ ! -f "./app/merezhyvo" ]; then
  echo "ERROR: ./app/merezhyvo not found after 'npm run package'."
  exit 1
fi

echo "==> Step 4/4: clickable build (.click packaging)"
export CLICKABLE_FRAMEWORK='ubuntu-touch-24.04-1.x'
clickable clean || true
clickable build --arch "${ARCH}" --accept-review-errors

echo "==> Done. Check ${OUT_DIR}/ for *.click"
