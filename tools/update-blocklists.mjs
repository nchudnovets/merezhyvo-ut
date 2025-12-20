#!/usr/bin/env node
/* eslint-disable no-console */

import fs from "node:fs/promises";
import path from "node:path";
import https from "node:https";
import { URL } from "node:url";

const DEFAULT_OUT_DIR = "assets/blocklists";

const SOURCES = {
  trackers: [
    // AdGuard Tracking Protection filter
    "https://filters.adtidy.org/extension/ublock/filters/3.txt",
    // EasyPrivacy (official ABP mirror) — dual-licensed; attribution required
    "https://easylist-downloads.adblockplus.org/easyprivacy.txt",
  ],
  ads: [
    // AdGuard Base filter (includes EasyList + AdGuard English)
    "https://filters.adtidy.org/extension/ublock/filters/2.txt",
    // AdGuard Mobile Ads filter
    "https://filters.adtidy.org/extension/ublock/filters/11.txt",
  ],
};

const LICENSE_NOTE =
  "Licenses: GPL-3.0 (see app/resources/legal/GPL-3.0.txt). Notices: app/resources/legal/BLOCKLISTS-NOTICES.txt";


function parseArgs(argv) {
  const args = {
    outDir: DEFAULT_OUT_DIR,
    offline: false,
    failOnError: false,
    quiet: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out" || a === "--out-dir") args.outDir = argv[++i];
    else if (a === "--offline") args.offline = true;
    else if (a === "--fail-on-error") args.failOnError = true;
    else if (a === "--quiet") args.quiet = true;
    else if (a === "--help" || a === "-h") {
      console.log(`
Usage:
  node tools/update-blocklists.mjs [--out assets/blocklists] [--offline] [--fail-on-error] [--quiet]

Behavior:
  - Downloads filter lists and extracts domains (domain-only).
  - Writes:
      <out>/trackers.txt
      <out>/ads.txt
  - If offline or downloads fail, keeps existing files (unless --fail-on-error).
`);
      process.exit(0);
    }
  }
  return args;
}

function log(quiet, ...msg) {
  if (!quiet) console.log(...msg);
}

function httpsGetText(urlStr, { timeoutMs = 30_000, maxRedirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);

    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          "User-Agent": "Merezhyvo-Blocklist-Updater/1.0",
          "Accept": "text/plain,*/*;q=0.8",
        },
      },
      (res) => {
        const status = res.statusCode || 0;

        // Redirects
        if (status >= 300 && status < 400 && res.headers.location) {
          if (maxRedirects <= 0) {
            reject(new Error(`Too many redirects for ${urlStr}`));
            return;
          }
          const next = new URL(res.headers.location, url).toString();
          resolve(httpsGetText(next, { timeoutMs, maxRedirects: maxRedirects - 1 }));
          return;
        }

        if (status < 200 || status >= 300) {
          reject(new Error(`HTTP ${status} for ${urlStr}`));
          return;
        }

        res.setEncoding("utf8");
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout downloading ${urlStr}`));
    });
    req.end();
  });
}

function isValidDomain(domain) {
  // Accept punycode too (xn--), reject IPs and obvious garbage.
  if (!domain) return false;
  if (domain.length > 253) return false;
  if (domain.includes("..")) return false;
  if (domain.startsWith(".") || domain.endsWith(".")) return false;

  // Basic charset check
  if (!/^[a-z0-9.-]+$/.test(domain)) return false;

  // Must contain at least one dot and a plausible TLD
  const parts = domain.split(".");
  if (parts.length < 2) return false;
  const tld = parts[parts.length - 1];
  if (tld.length < 2) return false;

  // Labels must be 1..63, not start/end with hyphen
  for (const label of parts) {
    if (!label || label.length > 63) return false;
    if (label.startsWith("-") || label.endsWith("-")) return false;
  }

  // Reject IP-like
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(domain)) return false;

  return true;
}

async function loadAllowlist(filePath) {
  try {
    const txt = await fs.readFile(filePath, 'utf8');
    const out = new Set();

    for (const raw of txt.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('#')) continue;

      const d = line.toLowerCase();
      if (d !== 'localhost' && isValidDomain(d)) out.add(d);
    }

    return out;
  } catch {
    return new Set(); // missing allowlist is OK
  }
}

function extractDomainsFromText(text) {
  const out = new Set();

  const lines = text.split(/\r?\n/);
  for (let raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Comments in ABP lists
    if (line.startsWith("!") || line.startsWith("#")) continue;

    // Not a network block: remove tracking params, etc.
    if (line.includes('$removeparam')) continue;

    // Cosmetic filters
    if (line.includes("##") || line.includes("#@#") || line.includes("#?#")) continue;

    // Exceptions: @@||example.com^
    if (line.startsWith("@@")) continue;

    // HOSTS format: "0.0.0.0 example.com"
    // Also allow: "127.0.0.1 example.com"
    if (/^(0\.0\.0\.0|127\.0\.0\.1)\s+/.test(line)) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const d = parts[1].toLowerCase();
        if (d !== "localhost" && isValidDomain(d)) out.add(d);
      }
      continue;
    }

    // ABP network rule typical: ||example.com^...
    if (line.startsWith("||")) {
      let s = line.slice(2);

      // cut at first delimiter: ^ / $ ?
      const cut = s.search(/[\^\/\$\?]/);
      if (cut >= 0) s = s.slice(0, cut);

      s = s.replace(/^\*\./, "");     // *.example.com -> example.com
      s = s.replace(/\*/g, "");       // drop wildcards
      s = s.trim().toLowerCase();

      // Skip "invalid" patterns
      if (!s || s.includes(":")) continue;

      if (s !== "localhost" && isValidDomain(s)) out.add(s);
      continue;
    }

    // Also accept plain domains on their own lines (rare but possible)
    if (!line.includes(" ") && !line.includes("/") && !line.includes(":")) {
      const d = line.toLowerCase();
      if (d !== "localhost" && isValidDomain(d)) out.add(d);
    }
  }

  return out;
}

async function writeListFile(filepath, { kind, domains, sources, quiet }) {
  const sorted = Array.from(domains).sort((a, b) => a.localeCompare(b));
  const now = new Date().toISOString();

  const header = [
    `# ${path.basename(filepath)} (generated)`,
    `# Generated: ${now}`,
    `# Kind: ${kind}`,
    `# ${LICENSE_NOTE}`,
    `# Sources:`,
    ...sources.map((s) => `#  - ${s}`),
    `# Domains: ${sorted.length}`,
    `#`,
  ].join("\n");

  const body = sorted.join("\n") + "\n";
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, header + "\n" + body, "utf8");

  log(quiet, `✔ wrote ${filepath} (${sorted.length} domains)`);
}

async function main() {
  const args = parseArgs(process.argv);

  const outDir = args.outDir;
  const trackersPath = path.join(outDir, "trackers.txt");
  const adsPath = path.join(outDir, "ads.txt");
  const allowlistPath = path.join(outDir, "allowlist.txt");
  const allowlist = await loadAllowlist(allowlistPath);
  if (allowlist.size > 0) {
    log(args.quiet, `Using allowlist: ${allowlistPath} (${allowlist.size} domains)`);
  }

  if (args.offline) {
    log(args.quiet, "Offline mode: skipping downloads; keeping existing lists.");
    return;
  }

  const results = {};

  for (const kind of ["trackers", "ads"]) {
    const sources = SOURCES[kind];
    const combined = new Set();
    let anyOk = false;

    log(args.quiet, `\n== Updating ${kind} list ==`);

    for (const url of sources) {
      try {
        log(args.quiet, `- downloading: ${url}`);
        const txt = await httpsGetText(url);
        const domains = extractDomainsFromText(txt);
        log(args.quiet, `  extracted: ${domains.size} domains`);
        for (const d of domains) combined.add(d);
        anyOk = true;
      } catch (e) {
        console.warn(`  ! failed: ${url}\n    ${e?.message || e}`);
      }
    }

     // Apply allowlist removals
    let removed = 0;
    for (const d of allowlist) {
      if (combined.delete(d)) removed++;
    }
    if (removed > 0) log(args.quiet, `  allowlist removed: ${removed}`);

    results[kind] = { anyOk, combined, sources };
  }

  // If absolutely nothing succeeded, decide whether to fail or keep existing files.
  const okSomething = results.trackers.anyOk || results.ads.anyOk;
  if (!okSomething) {
    const msg = "No sources could be downloaded. Keeping existing blocklists.";
    if (args.failOnError) throw new Error(msg);
    console.warn(msg);
    return;
  }

  if (results.trackers.anyOk) {
    await writeListFile(trackersPath, {
      kind: "trackers",
      domains: results.trackers.combined,
      sources: results.trackers.sources,
      quiet: args.quiet,
    });
  } else {
    console.warn("Trackers list not updated (all sources failed). Keeping existing trackers.txt.");
  }

  if (results.ads.anyOk) {
    await writeListFile(adsPath, {
      kind: "ads",
      domains: results.ads.combined,
      sources: results.ads.sources,
      quiet: args.quiet,
    });
  } else {
    console.warn("Ads list not updated (all sources failed). Keeping existing ads.txt.");
  }
}

main().catch((e) => {
  console.error("Blocklist update failed:", e);
  process.exit(1);
});
