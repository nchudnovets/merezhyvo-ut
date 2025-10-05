#!/usr/bin/env bash
set -euo pipefail

APP_NAME="uchromium.naz.r"
ARCH="arm64"
OUT_DIR="build"

echo "==> Pre-clean build/"
rm -rf build || true

echo "==> Step 1/3: npm ci"
npm ci

echo "==> Step 2/3: npm run package (build React + pack Electron for ${ARCH})"
npm run package

# sanity-check: бінар має існувати
if [ ! -f "./app/uchromium" ]; then
  echo "ERROR: ./app/uchromium не знайдено після 'npm run package'."
  exit 1
fi

echo "==> Step 3/3: clickable build (.click packaging)"
clickable clean || true
clickable build --arch "${ARCH}" --accept-review-errors

echo "==> Done. Перевір ${OUT_DIR}/ на наявність *.click"
