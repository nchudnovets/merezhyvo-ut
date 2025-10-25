'use strict';

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { getProfileDir, ensureDir } = require('./shortcuts.ts');

const TOR_SETTINGS_FILE = path.join(getProfileDir(), 'tor-settings.json');

function sanitizeTorConfig(raw) {
  const containerId = typeof raw === 'object' && raw && typeof raw.containerId === 'string'
    ? raw.containerId.trim()
    : '';
  return { containerId };
}

async function readTorConfig() {
  try {
    const raw = await fsp.readFile(TOR_SETTINGS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return sanitizeTorConfig(parsed);
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.warn('[merezhyvo] tor config read failed, falling back', err);
    }
    return sanitizeTorConfig(null);
  }
}

async function writeTorConfig(config) {
  const sanitized = sanitizeTorConfig(config);
  try {
    ensureDir(path.dirname(TOR_SETTINGS_FILE));
    await fsp.writeFile(TOR_SETTINGS_FILE, JSON.stringify(sanitized, null, 2), 'utf8');
  } catch (err) {
    console.error('[merezhyvo] tor config write failed', err);
    throw err;
  }
  return sanitized;
}

async function updateTorConfig(partial) {
  const current = await readTorConfig();
  return writeTorConfig({ ...current, ...(partial || {}) });
}

module.exports = {
  TOR_SETTINGS_FILE,
  sanitizeTorConfig,
  readTorConfig,
  writeTorConfig,
  updateTorConfig
};
