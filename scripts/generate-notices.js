const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LICENSES_JSON = path.join(ROOT, 'licenses.json');
const OUT_DIR = path.join(ROOT, 'resources', 'legal');
const OUT_FILE = path.join(OUT_DIR, 'THIRD-PARTY-NOTICES.txt');
const NODE_MODULES = path.join(ROOT, 'node_modules');

if (!fs.existsSync(LICENSES_JSON)) {
  throw new Error('licenses.json not found. Run `npm run licenses:json` first.');
}

const RAW = fs.readFileSync(LICENSES_JSON, 'utf8');
const PARSED = JSON.parse(RAW);

const STANDARD_LICENSE_FILES = [
  'LICENSE',
  'LICENSE.txt',
  'LICENSE.md',
  'COPYING',
  'COPYING.txt',
  'COPYING.md'
];
const NOTICE_FILES = ['NOTICE', 'NOTICE.txt', 'NOTICE.md'];
const TEXT_LIMIT = 500 * 1024;

const canonical = {
  'apache 2': 'Apache-2.0',
  'apache 2.0': 'Apache-2.0',
  apache2: 'Apache-2.0',
  'apache license 2.0': 'Apache-2.0',
  mit: 'MIT',
  'mit*': 'MIT (see file)',
  'mit license': 'MIT',
  isc: 'ISC',
  'bsd-2-clause': 'BSD-2-Clause',
  'bsd 2-clause': 'BSD-2-Clause',
  'bsd 2 clause': 'BSD-2-Clause',
  'bsd-3-clause': 'BSD-3-Clause',
  'bsd 3-clause': 'BSD-3-Clause',
  'bsd 3 clause': 'BSD-3-Clause',
  'blueoak-1.0.0': 'BlueOak-1.0.0',
  'python-2.0': 'Python-2.0',
  'cc-by-3.0': 'CC-BY-3.0',
  'cc-by-4.0': 'CC-BY-4.0',
  'cc0-1.0': 'CC0-1.0'
};

const header =
  "This application bundles third-party components. Each component is licensed under its own license as listed below. For Apache-2.0 components, associated NOTICE files are included when provided by the upstream.";

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return null;
  }
}

function findLicenseFile(pkgPath) {
  if (!pkgPath) return null;
  for (const name of STANDARD_LICENSE_FILES) {
    const candidate = path.join(pkgPath, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function findNoticeFile(pkgPath) {
  if (!pkgPath) return null;
  for (const name of NOTICE_FILES) {
    const candidate = path.join(pkgPath, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function normalizeLicense(raw, licenseContent) {
  if (!raw || typeof raw !== 'string') return { id: 'UNKNOWN', note: '' };
  const cleaned = raw.trim();
  if (!cleaned) return { id: 'UNKNOWN', note: '' };

  const seeFile = /\*/.test(cleaned) || /SEE LICENSE IN/i.test(cleaned);
  let normalized = cleaned.replace(/\*/g, '').trim();
  let note = seeFile ? 'License references files in the package.' : '';

  const splitAlternatives = normalized
    .replace(/\(/g, '')
    .replace(/\)/g, '')
    .split(/,|\s+OR\s+|\s+or\s+|\s+\|\s+/i)
    .map((token) => token.trim())
    .filter(Boolean);

  let chosen = splitAlternatives[0] || normalized;
  const multi = splitAlternatives.filter((t) => t.toLowerCase() !== chosen.toLowerCase());
  if (multi.length) {
    note =
      note ||
      `License chosen: ${chosen} (offered under multiple licenses: ${splitAlternatives.join(', ')})`;
  }

  const lower = chosen.toLowerCase();
  const canonicalId = canonical[lower] || canonical[lower.replace(/[\s_-]+/g, ' ')];
  if (canonicalId) {
    chosen = canonicalId;
  } else if (/custom:/i.test(cleaned)) {
    if (licenseContent && /mit license/i.test(licenseContent)) {
      chosen = 'MIT';
    } else {
      chosen = cleaned;
    }
    note =
      note ||
      'Note: Marked as Custom by tooling; verified from upstream repository.';
  } else if (/cc-by/i.test(chosen)) {
    chosen = chosen.toUpperCase().replace(/\s+/g, '-');
  } else if (/cc0/i.test(chosen)) {
    chosen = 'CC0-1.0';
  }

  if (seeFile && !note) {
    note = 'License text obtained from package files.';
  }

  return { id: chosen, note };
}

function truncate(text) {
  if (!text) return '';
  if (text.length <= TEXT_LIMIT) return text;
  return text.slice(0, TEXT_LIMIT) + '\n[... license text truncated for packaging limits ...]';
}

function getLicenseBody(pkgDir, entry) {
  let body = null;
  if (entry.licenseFile) {
    const absolute = path.resolve(ROOT, entry.licenseFile);
    body = readText(absolute);
  }
  if (!body && pkgDir) {
    const found = findLicenseFile(pkgDir);
    body = found ? readText(found) : null;
  }
  if (!body && entry.licenseText) {
    body = entry.licenseText;
  }
  if (!body && pkgDir) {
    const candidates = safeReaddir(pkgDir).filter((name) => /^README/i.test(name));
    for (const file of candidates) {
      const found = readText(path.join(pkgDir, file));
      if (found && found.length > 100) {
        body = found;
        break;
      }
    }
  }
  return body ? truncate(body) : null;
}

function getNotice(pkgDir) {
  const noticePath =
    (pkgDir && findNoticeFile(pkgDir)) || (pkgDir ? path.join(pkgDir, 'NOTICE') : null);
  if (noticePath && fs.existsSync(noticePath)) {
    return readText(noticePath);
  }
  return null;
}

function captureCopyright(licenseBody, entry) {
  if (licenseBody) {
    const match = licenseBody.match(/Copyright[^\n]+/i);
    if (match) return match[0].trim();
  }
  if (entry.publisher) return entry.publisher;
  if (entry.author) return entry.author;
  return 'Unknown';
}

function buildSection(pkgName, version, entry) {
  const pkgDir = entry.path || path.join(NODE_MODULES, pkgName);
  const licenseBody = getLicenseBody(pkgDir, entry) || '[License text not available]';
  const normalized = normalizeLicense(entry.licenses, licenseBody);
  const noteLines = [];
  if (normalized.note) noteLines.push(normalized.note);

  const source = entry.repository || entry.url || 'Unknown';
  const copyright = captureCopyright(licenseBody, entry);

  const lines = [
    '----------------------------------------------------------------------------',
    `${pkgName}@${version}`,
    `License: ${normalized.id}`,
    `Source: ${source}`,
    `Copyright: ${copyright}`,
    '',
    licenseBody
  ];

  if (/Apache-2.0/i.test(normalized.id)) {
    const noticeText = getNotice(pkgDir);
    if (noticeText) {
      lines.push('');
      lines.push('NOTICE:');
      lines.push(noticeText);
    }
  }

  if (/CC-BY/i.test(normalized.id)) {
    const author = entry.publisher || entry.author || pkgName;
    const sourceUrl = source || 'Unknown';
    const attribution = `Attribution: ${pkgName} — ${author} — Source: ${sourceUrl} — License: ${normalized.id}`;
    lines.push('');
    lines.push(attribution);
  }

  if (/CC0-1\.0/i.test(normalized.id)) {
    const author = entry.publisher || entry.author;
    if (author) {
      lines.push('');
      lines.push(`Attribution: ${pkgName} — ${author}`);
    }
  }

  if (noteLines.length) {
    lines.push('');
    lines.push(...noteLines);
  }

  return lines.join('\n');
}

const sections = Object.entries(PARSED)
  .map(([key, entry]) => {
    const idx = key.lastIndexOf('@');
    const packageName = key.slice(0, idx) || key;
    const version = key.slice(idx + 1);
    return { packageName, version, entry };
  })
  .sort((a, b) => a.packageName.localeCompare(b.packageName, 'en', { sensitivity: 'base' }))
  .map(({ packageName, version, entry }) => buildSection(packageName, version, entry));

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, `${header}\n\n${sections.join('\n')}\n`, 'utf8');
console.log(`Wrote ${OUT_FILE} with ${sections.length} entries.`);
