#!/usr/bin/env bash
set -euo pipefail

# Refresh the bundled arm64 Tor binary without replacing the current cache
# until the official package has been downloaded, verified, and extracted.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}/.."
cd "${REPO_ROOT}"

TOR_DIR="resources/tor"
TOR_REPOSITORY_BASE="${TOR_REPOSITORY_BASE:-https://deb.torproject.org/torproject.org}"
TOR_DISTRIBUTION="${TOR_DISTRIBUTION:-noble}"
TOR_ARCH="arm64"
TOR_PACKAGES_URL="${TOR_REPOSITORY_BASE}/dists/${TOR_DISTRIBUTION}/main/binary-${TOR_ARCH}/Packages"

TMP_DIR="$(mktemp -d)"
STAGE_DIR="${TMP_DIR}/tor-stage"
ROOTFS_DIR="${TMP_DIR}/rootfs"
PACKAGES_FILE="${TMP_DIR}/Packages"
TOR_DEB="${TMP_DIR}/tor.deb"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

download_file() {
  local url="$1"
  local output="$2"

  if command -v curl >/dev/null 2>&1; then
    curl --fail --location --silent --show-error "${url}" --output "${output}"
  elif command -v wget >/dev/null 2>&1; then
    wget --quiet --output-document="${output}" "${url}"
  else
    echo "ERROR: curl or wget is required to download Tor." >&2
    exit 1
  fi
}

sha256_file() {
  local file="$1"

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${file}" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${file}" | awk '{print $1}'
  else
    echo "ERROR: sha256sum or shasum is required to verify Tor." >&2
    exit 1
  fi
}

extract_deb() {
  local package="$1"
  local destination="$2"

  if command -v dpkg-deb >/dev/null 2>&1; then
    dpkg-deb -x "${package}" "${destination}"
    return
  fi

  if ! command -v ar >/dev/null 2>&1 || ! command -v bsdtar >/dev/null 2>&1; then
    echo "ERROR: need dpkg-deb, or both ar and bsdtar, to extract the Tor .deb." >&2
    exit 1
  fi

  local deb_contents="${TMP_DIR}/deb-contents"
  mkdir -p "${deb_contents}"
  (
    cd "${deb_contents}"
    ar -x "${package}"
  )

  local data_archive
  data_archive="$(find "${deb_contents}" -maxdepth 1 -type f -name 'data.tar.*' -print -quit)"
  if [ -z "${data_archive}" ]; then
    echo "ERROR: Tor .deb does not contain a data archive." >&2
    exit 1
  fi

  bsdtar -xf "${data_archive}" -C "${destination}"
}

read_deb_version() {
  local package="$1"

  if command -v dpkg-deb >/dev/null 2>&1; then
    dpkg-deb -f "${package}" Version
    return
  fi

  local control_archive
  control_archive="$(find "${TMP_DIR}/deb-contents" -maxdepth 1 -type f -name 'control.tar.*' -print -quit)"
  if [ -z "${control_archive}" ]; then
    echo "ERROR: Tor .deb does not contain a control archive." >&2
    exit 1
  fi

  bsdtar -xOf "${control_archive}" ./control | awk -F ': ' '$1 == "Version" { print $2; exit }'
}

read_package_field() {
  local field_name="$1"
  awk -v wanted="${field_name}" '
    BEGIN { RS=""; FS="\n" }
    $1 == "Package: tor" {
      for (i = 1; i <= NF; i++) {
        split($i, pair, ": ")
        if (pair[1] == wanted) {
          print substr($i, length(wanted) + 3)
          exit
        }
      }
    }
  ' "${PACKAGES_FILE}"
}

if [ -n "${TOR_DEB_URL:-}" ]; then
  if [ -z "${TOR_DEB_SHA256:-}" ]; then
    echo "ERROR: TOR_DEB_SHA256 is required when overriding TOR_DEB_URL." >&2
    exit 1
  fi
  TOR_DEB_URL_RESOLVED="${TOR_DEB_URL}"
  TOR_DEB_SHA256_RESOLVED="${TOR_DEB_SHA256}"
  TOR_VERSION_EXPECTED="${TOR_VERSION_EXPECTED:-unknown}"
  echo "==> Using explicitly supplied Tor package URL and SHA-256."
else
  echo "==> Reading the official Tor ${TOR_DISTRIBUTION} ${TOR_ARCH} package index"
  download_file "${TOR_PACKAGES_URL}" "${PACKAGES_FILE}"
  TOR_DEB_PATH="$(read_package_field Filename)"
  TOR_DEB_SHA256_RESOLVED="$(read_package_field SHA256)"
  TOR_VERSION_EXPECTED="$(read_package_field Version)"

  if [ -z "${TOR_DEB_PATH}" ] || [ -z "${TOR_DEB_SHA256_RESOLVED}" ] || [ -z "${TOR_VERSION_EXPECTED}" ]; then
    echo "ERROR: Could not resolve the arm64 Tor package from ${TOR_PACKAGES_URL}." >&2
    exit 1
  fi

  TOR_DEB_URL_RESOLVED="${TOR_REPOSITORY_BASE}/${TOR_DEB_PATH}"
fi

echo "==> Downloading Tor ${TOR_VERSION_EXPECTED}"
echo "    ${TOR_DEB_URL_RESOLVED}"
download_file "${TOR_DEB_URL_RESOLVED}" "${TOR_DEB}"

TOR_DEB_SHA256_ACTUAL="$(sha256_file "${TOR_DEB}")"
if [ "${TOR_DEB_SHA256_ACTUAL}" != "${TOR_DEB_SHA256_RESOLVED}" ]; then
  echo "ERROR: Tor package SHA-256 verification failed." >&2
  echo "       Expected: ${TOR_DEB_SHA256_RESOLVED}" >&2
  echo "       Actual:   ${TOR_DEB_SHA256_ACTUAL}" >&2
  exit 1
fi
echo "==> Tor package SHA-256 verified"

mkdir -p "${ROOTFS_DIR}" "${STAGE_DIR}"
echo "==> Extracting Tor package"
extract_deb "${TOR_DEB}" "${ROOTFS_DIR}"

TOR_BINARY="${ROOTFS_DIR}/usr/bin/tor"
TOR_COPYRIGHT="${ROOTFS_DIR}/usr/share/doc/tor/copyright"
if [ ! -f "${TOR_BINARY}" ] || [ ! -f "${TOR_COPYRIGHT}" ]; then
  echo "ERROR: Extracted package is missing the Tor binary or copyright file." >&2
  exit 1
fi

TOR_VERSION_ACTUAL="$(read_deb_version "${TOR_DEB}")"
if [ -z "${TOR_VERSION_ACTUAL}" ]; then
  echo "ERROR: Could not read the Tor package version." >&2
  exit 1
fi
if [ "${TOR_VERSION_EXPECTED}" != "unknown" ] && [ "${TOR_VERSION_ACTUAL}" != "${TOR_VERSION_EXPECTED}" ]; then
  echo "ERROR: Tor package version does not match the official package index." >&2
  echo "       Expected: ${TOR_VERSION_EXPECTED}" >&2
  echo "       Actual:   ${TOR_VERSION_ACTUAL}" >&2
  exit 1
fi

cp "${TOR_BINARY}" "${STAGE_DIR}/tor"
chmod +x "${STAGE_DIR}/tor"
cp "${TOR_COPYRIGHT}" "${STAGE_DIR}/LICENSE"
printf '%s\n' "${TOR_VERSION_ACTUAL}" > "${STAGE_DIR}/version.txt"

if ! file "${STAGE_DIR}/tor" | grep -q 'ARM aarch64'; then
  echo "ERROR: Extracted Tor binary is not ARM aarch64." >&2
  exit 1
fi

echo "==> Replacing ${TOR_DIR} after successful verification"
rm -rf "${TOR_DIR}"
mv "${STAGE_DIR}" "${TOR_DIR}"

echo "==> Tor update completed: ${TOR_VERSION_ACTUAL}"
