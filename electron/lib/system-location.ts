import { spawn } from 'child_process';
import { Message, type MessageBus, systemBus, type Variant } from 'dbus-next';
import fs from 'fs';
import path from 'path';
import https from 'https';

type Fix = { latitude: number; longitude: number; accuracy?: number };

/* -------------------------------
 * Low-level DBus helpers
 * ------------------------------- */

function dbusCall(
  bus: MessageBus,
  destination: string,
  objectPath: string,
  iface: string,
  member: string,
  signature: string,
  body: unknown[]
): Promise<Message | null> {
  const msg = new Message({
    destination,
    path: objectPath,
    interface: iface,
    member,
    signature,
    body,
  });
  return bus.call(msg);
}

function vGet(x: unknown): unknown {
  // Unwrap dbus-next Variant if present
  const anyObj = x as Record<string, unknown> | null;
  if (anyObj && typeof anyObj === 'object' && 'value' in anyObj && 'signature' in anyObj) {
    return (x as Variant).value;
  }
  return x;
}

function nOrNaN(z: unknown): number {
  const v = Number(z);
  return Number.isFinite(v) ? v : NaN;
}

function normalizeTupleLike(x: unknown): Fix | null {
  // Accept [lat, lon, acc?] or object-like with lat/lon keys.
  if (Array.isArray(x)) {
    const lat = nOrNaN(x[0]);
    const lon = nOrNaN(x[1]);
    const acc = nOrNaN(x[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { latitude: lat, longitude: lon, accuracy: Number.isFinite(acc) ? acc : undefined };
    }
    return null;
  }

  if (x && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    const lat = nOrNaN(o.latitude ?? o.lat ?? o.Latitude ?? o.Lat);
    const lon = nOrNaN(o.longitude ?? o.lon ?? o.lng ?? o.Longitude ?? o.Lon);
    const acc = nOrNaN(o.accuracy ?? o['horizontal-accuracy'] ?? o.Accuracy ?? o.hacc);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { latitude: lat, longitude: lon, accuracy: Number.isFinite(acc) ? acc : undefined };
    }
    const nested = o.Location ?? o.location ?? o.Position ?? o.position;
    if (nested != null) return normalizeTupleLike(nested);
  }

  return null;
}

function extractFixFromProps(props: Record<string, unknown>): Fix | null {
  const cand = normalizeTupleLike(props);
  if (cand) return cand;

  const lat = nOrNaN(props.Latitude ?? props.latitude ?? props.Lat ?? props.lat);
  const lon = nOrNaN(props.Longitude ?? props.longitude ?? props.Lon ?? props.lon ?? props.lng);
  const acc = nOrNaN(
    props.Accuracy ?? props.accuracy ?? props['horizontal-accuracy'] ?? props.HAcc ?? props.hacc
  );

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { latitude: lat, longitude: lon, accuracy: Number.isFinite(acc) ? acc : undefined };
  }

  const nested = props.Location ?? props.location ?? props.Position ?? props.position;
  if (nested != null) return normalizeTupleLike(nested);

  return null;
}

async function getManagedObjects(bus: MessageBus, service: string, objPath: string) {
  try {
    const reply = await dbusCall(
      bus,
      service,
      objPath,
      'org.freedesktop.DBus.ObjectManager',
      'GetManagedObjects',
      '',
      []
    );
    if (!reply) return null;
    const raw = (reply.body?.[0] ?? null) as unknown;
    const out: Array<{ path: string; ifaces: Record<string, Record<string, unknown>> }> = [];

    const objEntries: Array<[string, unknown]> =
      raw instanceof Map ? Array.from(raw.entries()) : Object.entries((raw as object) || {});

    for (const [p, ifaceMap] of objEntries) {
      const ifaceEntries: Array<[string, unknown]> =
        ifaceMap instanceof Map ? Array.from(ifaceMap.entries()) : Object.entries((ifaceMap as object) || {});
      const ifaces: Record<string, Record<string, unknown>> = {};
      for (const [ifaceName, propMap] of ifaceEntries) {
        const propEntries: Array<[string, unknown]> =
          propMap instanceof Map ? Array.from(propMap.entries()) : Object.entries((propMap as object) || {});
        const props: Record<string, unknown> = {};
        for (const [k, v] of propEntries) props[k] = vGet(v);
        ifaces[ifaceName] = props;
      }
      out.push({ path: p, ifaces });
    }

    return out;
  } catch (e) {
    return null;
  }
}

async function propsGet(
  bus: MessageBus,
  service: string,
  objPath: string,
  iface: string,
  prop: string
): Promise<unknown | null> {
  try {
    const reply = await dbusCall(
      bus,
      service,
      objPath,
      'org.freedesktop.DBus.Properties',
      'Get',
      'ss',
      [iface, prop]
    );
    if (!reply) return null;
    const val = vGet(reply.body?.[0]);
    return vGet(val);
  } catch (e) {
    return null;
  }
}

async function introspect(bus: MessageBus, service: string, objPath: string): Promise<string | null> {
  try {
    const reply = await dbusCall(
      bus,
      service,
      objPath,
      'org.freedesktop.DBus.Introspectable',
      'Introspect',
      '',
      []
    );
    if (!reply) return null;
    const xml = String(reply.body?.[0] ?? '');
    return xml || null;
  } catch (e) {
    return null;
  }
}

/* ---------------------------------------------
 * DBus discovery helpers
 * --------------------------------------------- */

let _omProbed = false; // probe ObjectManager only once per process

async function listSystemBusNames(bus: MessageBus): Promise<string[]> {
  try {
    const reply = await dbusCall(
      bus,
      'org.freedesktop.DBus',
      '/org/freedesktop/DBus',
      'org.freedesktop.DBus',
      'ListNames',
      '',
      []
    );
    if (!reply) return [];
    const names = reply.body?.[0] as unknown;
    if (Array.isArray(names)) return names.map((x) => String(x));
  } catch (e) {
  }
  return [];
}

type Introspected = {
  interfaces: Array<{
    name: string;
    methods: Array<{ name: string; inArgs: string[]; outArgs: string[] }>;
    properties: Array<{ name: string; type: string }>;
  }>;
  nodes: string[];
};

function parseIntrospectXml(xml: string): Introspected {
  const interfaces: Introspected['interfaces'] = [];
  const nodes: string[] = [];

  // nodes
  {
    const nodeRe = /<node\s+name="([^"]+)"\s*\/>/g;
    let m: RegExpExecArray | null;
    while ((m = nodeRe.exec(xml))) {
      const name = m[1];
      if (!name) continue;
      nodes.push(name);
    }
  }

  // interfaces
  {
    const ifaceRe = /<interface\s+name="([^"]+)">([\s\S]*?)<\/interface>/g;
    let m: RegExpExecArray | null;
    while ((m = ifaceRe.exec(xml))) {
      const name = (m[1] ?? '').trim();
      const body = (m[2] ?? '').trim();
      if (!name || !body) continue;
      const properties: Array<{ name: string; type: string }> = [];
      const methods: Array<{ name: string; inArgs: string[]; outArgs: string[] }> = [];

      // properties in this interface
      {
        const propRe = /<property\s+name="([^"]+)"\s+type="([^"]+)"/g;
        let p: RegExpExecArray | null;
        while ((p = propRe.exec(body))) {
          const pname = ((p[1] ?? '') as string).trim();
          const ptype = ((p[2] ?? '') as string).trim();
          if (!pname || !ptype) continue;
          properties.push({ name: pname, type: ptype });
        }
      }

      // methods in this interface
      {
        const methRe = /<method\s+name="([^"]+)">([\s\S]*?)<\/method>/g;
        let mm: RegExpExecArray | null;
        while ((mm = methRe.exec(body))) {
          const mname = ((mm[1] ?? '') as string).trim();
          const inner = ((mm[2] ?? '') as string).trim();
          if (!mname || !inner) continue;
          const argsRe = /<arg\s+[^>]*type="([^"]+)"\s+direction="(in|out)"/g;
          const inArgs: string[] = [];
          const outArgs: string[] = [];
          let a: RegExpExecArray | null;
          while ((a = argsRe.exec(inner))) {
            const atype = a[1];
            if (typeof atype !== 'string') continue;
            if (a[2] === 'in') inArgs.push(atype);
            else outArgs.push(atype);
          }
          methods.push({ name: mname, inArgs, outArgs });
        }
      }

      interfaces.push({ name, methods, properties });
    }
  }

  return { interfaces, nodes };
}

async function tryCallLikelyMethod(
  bus: MessageBus,
  service: string,
  objPath: string,
  iface: string,
  method: { name: string; inArgs: string[]; outArgs: string[] }
): Promise<Fix | null> {
  // Only methods with NO inputs and 2–3 double outputs are considered.
  if (method.inArgs.length > 0) return null;
  const out = method.outArgs;
  const allDouble = out.length >= 2 && out.length <= 3 && out.every((t) => t === 'd');
  if (!allDouble) return null;

  try {
    const reply = await dbusCall(bus, service, objPath, iface, method.name, '', []);
    if (!reply) return null;
    const body = (reply.body ?? []) as unknown[];
    const nums = body.map<number>((x) => nOrNaN(vGet(x)));
    if (nums.length >= 2) {
      const latNum = nums[0];
      const lonNum = nums[1];
      if (typeof latNum === 'number' && typeof lonNum === 'number' && Number.isFinite(latNum) && Number.isFinite(lonNum)) {
        const fix: Fix = { latitude: latNum, longitude: lonNum };
        const accNum = nums[2];
        if (typeof accNum === 'number' && Number.isFinite(accNum)) fix.accuracy = accNum;
        return fix;
      }
    }
  } catch (e) {
  }
  return null;
}

async function tryViaGenericDbusScan(timeoutMs: number): Promise<Fix | null> {
  const bus = systemBus();
  const deadline = Date.now() + Math.max(1500, Math.min(timeoutMs, 5000));

  const names = await listSystemBusNames(bus);
  const candNames = names.filter((n) =>
    /(lomiri.*location|location.*lomiri|geoclue|geo\.?clue|gnss|gps|ubuntu.*location)/i.test(n)
  );

  if (candNames.length === 0) {
    return null;
  }

  const visited = new Set<string>();
  const propNames = [
    'Latitude','longitude','Longitude','latitude','Lat','Lon','lng',
    'Accuracy','horizontal-accuracy','accuracy','HAcc','hacc',
    'Location','Position'
  ];

  for (const svc of candNames) {
    const queue: string[] = ['/', '/com', '/com/lomiri', '/com/ubuntu', '/org', '/org/freedesktop'];
    let steps = 0;

    while (queue.length && Date.now() < deadline && steps < 60) {
      steps++;
      const p = queue.shift()!;
      const key = `${svc}::${p}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const xml = await introspect(bus, svc, p);
      if (!xml) continue;

      const parsed = parseIntrospectXml(xml);

      // 1) Try properties we know
      for (const itf of parsed.interfaces) {
        if (!/(Location|Position|Geo|Service|Manager)/i.test(itf.name)) continue;

        // Try to fetch properties bucket
        const bucket: Record<string, unknown> = {};
        for (const prop of itf.properties) {
          if (propNames.includes(prop.name)) {
            const val = await propsGet(bus, svc, p, itf.name, prop.name);
            if (val !== null && val !== undefined) bucket[prop.name] = vGet(val);
          }
        }
        const fix = extractFixFromProps(bucket);
        if (fix) {
          return fix;
        }
      }

      // 2) If no luck, try "likely" methods (no inputs, 2–3 doubles out)
      for (const itf of parsed.interfaces) {
        if (!/(Location|Position|Geo|Service|Manager)/i.test(itf.name)) continue;
        for (const m of itf.methods) {
          const fix = await tryCallLikelyMethod(bus, svc, p, itf.name, m);
          if (fix) return fix;
        }
      }

      // enqueue children
      for (const child of parsed.nodes) {
        const childPath = p === '/' ? `/${child}` : `${p}/${child}`;
        if (!visited.has(`${svc}::${childPath}`)) queue.push(childPath);
      }
    }
  }

  return null;
}

/* ---------------------------------------------
 * Legacy OM and targeted introspect (kept)
 * --------------------------------------------- */

async function tryLomiriOverObjectManager(timeoutMs: number): Promise<Fix | null> {
  if (_omProbed) return null;
  _omProbed = true;

  const bus = systemBus();
  const services = ['com.lomiri.location.Service', 'com.ubuntu.location.Service'];
  const roots = ['/', '/com/lomiri/location', '/com/lomiri/location/Service', '/com/ubuntu/location', '/com/ubuntu/location/Service'];

  const deadline = Date.now() + Math.max(1500, Math.min(timeoutMs, 5000));

  for (const svc of services) {
    for (const root of roots) {
      if (Date.now() > deadline) return null;
      const objs = await getManagedObjects(bus, svc, root);
      if (!objs || objs.length === 0) continue;

      for (const o of objs) {
        for (const [ifaceName, props] of Object.entries(o.ifaces)) {
          if (!/(Location|Position|Geo|Manager|Service)/i.test(ifaceName)) continue;
          const fix = extractFixFromProps(props);
          if (fix) {
            return fix;
          }
        }
      }

      const propNames = [
        'Latitude','longitude','Longitude','latitude','Lat','Lon','lng',
        'Accuracy','horizontal-accuracy','accuracy','HAcc','hacc',
        'Location','Position'
      ];

      for (const o of objs) {
        for (const ifaceName of Object.keys(o.ifaces)) {
          if (!/(Location|Position|Geo|Manager|Service)/i.test(ifaceName)) continue;

          const bucket: Record<string, unknown> = {};
          for (const p of propNames) {
            if (Date.now() > deadline) break;
            const val = await propsGet(bus, svc, o.path, ifaceName, p);
            if (val !== null && val !== undefined) bucket[p] = vGet(val);
          }
          const fix = extractFixFromProps(bucket);
          if (fix) {
            return fix;
          }
        }
      }
    }
  }

  return null;
}

async function tryLomiriViaIntrospect(timeoutMs: number): Promise<Fix | null> {
  const bus = systemBus();
  const services = ['com.lomiri.location.Service', 'com.ubuntu.location.Service'];
  const starts = ['/', '/com', '/com/lomiri', '/com/lomiri/location', '/com/lomiri/location/Service', '/com/ubuntu', '/com/ubuntu/location', '/com/ubuntu/location/Service'];
  const deadline = Date.now() + Math.max(2000, Math.min(timeoutMs, 5000));

  const propNames = [
    'Latitude','longitude','Longitude','latitude','Lat','Lon','lng',
    'Accuracy','horizontal-accuracy','accuracy','HAcc','hacc',
    'Location','Position'
  ];

  for (const svc of services) {
    const visited = new Set<string>();
    const queue = [...starts];
    let steps = 0;
    while (queue.length && Date.now() < deadline && steps < 40) {
      steps++;
      const p = queue.shift()!;
      if (visited.has(p)) continue;
      visited.add(p);

      const xml = await introspect(bus, svc, p);
      if (!xml) continue;

      const parsed = parseIntrospectXml(xml);

      for (const iface of parsed.interfaces) {
        if (!/(Location|Position|Geo|Service)/i.test(iface.name)) continue;

        const bucket: Record<string, unknown> = {};
        for (const pn of propNames) {
          const val = await propsGet(bus, svc, p, iface.name, pn);
          if (val !== null && val !== undefined) bucket[pn] = vGet(val);
        }
        const fix = extractFixFromProps(bucket);
        if (fix) {
          return fix;
        }

        // Try method-based location as well
        for (const m of iface.methods) {
          const viaMethod = await tryCallLikelyMethod(bus, svc, p, iface.name, m);
          if (viaMethod) return viaMethod;
        }
      }

      for (const child of parsed.nodes) {
        const childPath = p === '/' ? `/${child}` : `${p}/${child}`;
        if (!visited.has(childPath)) queue.push(childPath);
      }
    }
  }
  return null;
}

/* ---------------------------
 * QtLocation one-shot helper (kept as reserve)
 * --------------------------- */

function guessClickAppId(): string | null {
  try {
    const pkg = 'merezhyvo.naz.r';
    const base = `/opt/click.ubuntu.com/${pkg}`;
    const cur = path.join(base, 'current');
    if (fs.existsSync(cur)) {
      const real = fs.realpathSync(cur);
      const version = path.basename(path.dirname(real));
      if (version && version !== 'current') {
        return `${pkg}_merezhyvo_${version}`;
      }
    }
    if (fs.existsSync(base)) {
      const vers = fs.readdirSync(base).filter((d) => /^\d/.test(d)).sort();
      const last = vers[vers.length - 1];
      if (last) return `${pkg}_merezhyvo_${last}`;
    }
  } catch {
    // ignore
  }
  return null;
}

function sanitizedEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  // Keep a minimal safe subset; drop X/Wayland/Mir hints completely.
  const allow = new Set(['HOME', 'PATH', 'LANG', 'LC_ALL']);
  const out: NodeJS.ProcessEnv = {};

  for (const k of Object.keys(process.env)) {
    if (allow.has(k)) {
      const v = process.env[k];
      if (typeof v === 'string') out[k] = v;
    }
  }

  // Force remove popular display/session vars by not including them at all.
  // (DISPLAY, WAYLAND_DISPLAY, XDG_SESSION_TYPE, MIR_SOCKET, QT_QPA_PLATFORMTHEME)
  return { ...out, ...extra };
}

function tryQmlOnce(timeoutMs: number): Promise<Fix | null> {
  return new Promise((resolve) => {
    const qmlPath = '/opt/click.ubuntu.com/merezhyvo.naz.r/current/app/resources/ut/location_once.qml';
    const args = ['-platform', 'offscreen', qmlPath, `--timeout=${timeoutMs}`];

    const aa = '/usr/bin/aa-exec-click';
    let cmd = 'qmlscene';
    let cmdArgs = args;

    if (fs.existsSync(aa)) {
      const appId = process.env.MZR_CLICK_APP_ID || guessClickAppId();
      if (appId) {
        cmd = 'aa-exec-click';
        cmdArgs = ['-p', appId, '--', 'qmlscene', ...args];
      }
    }

    const child = spawn(cmd, cmdArgs, {
      env: sanitizedEnv({
        QSG_RENDER_LOOP: 'basic',
        QT_QUICK_BACKEND: 'software',
        QT_LOGGING_RULES: 'qt.positioning.*=true;qt.geoclue.*=true',
        QT_PLUGIN_PATH: '/usr/lib/aarch64-linux-gnu/qt5/plugins:/usr/lib/arm-linux-gnueabihf/qt5/plugins',
        QML2_IMPORT_PATH: '/usr/lib/aarch64-linux-gnu/qt5/qml:/usr/lib/arm-linux-gnueabihf/qt5/qml',
        OZONE_PLATFORM: "wayland"
      }),
    });

    let last: Fix | null = null;
    const onChunk = (buf: Buffer) => {
      const s = buf.toString();
      const m = s.match(/__MZR_FIX__\s*([0-9.-]+)\s*,\s*([0-9.-]+)\s*,\s*([0-9.-]+)/);
      if (m && m[1] && m[2] && m[3]) {
        last = { latitude: +m[1], longitude: +m[2], accuracy: +m[3] };
      }
    };

    child.stderr.on('data', onChunk);
    child.stdout.on('data', onChunk);

    child.on('exit', () => {
      if (last) {
        resolve(last);
        return;
      }
      resolve(null);
    });

    setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
    }, Math.max(5000, timeoutMs + 1500));
  });
}

/* ---------------------------
 * Network IP fallback
 * --------------------------- */

function tryIpFallback(timeoutMs: number): Promise<Fix | null> {
  return new Promise((resolve) => {
    const req = https.get('https://ipinfo.io/json', (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(data) as { loc?: string };
          if (typeof j.loc === 'string' && j.loc.includes(',')) {
            const [latStr, lonStr] = j.loc.split(',');
            const lat = Number(latStr);
            const lon = Number(lonStr);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              const fix: Fix = { latitude: lat, longitude: lon, accuracy: 50000 };
              resolve(fix);
              return;
            }
          }
        } catch {
          // ignore
        }
        resolve(null);
      });
    });
    req.setTimeout(Math.min(4000, timeoutMs), () => {
      try { req.destroy(); } catch { /* ignore */ }
      resolve(null);
    });
    req.on('error', () => resolve(null));
  });
}

/* ---------------------------
 * Public API
 * --------------------------- */

export async function getSystemPosition(timeoutMs: number): Promise<Fix | null> {

  const qmlTimeout = Math.min(Math.max(timeoutMs, 20000), 60000); // 20–60s window
  const skipDbus = process.env.MZR_SKIP_DBUS === '1';

  if (!skipDbus) {
    // 1) Generic DBus scan across location-like services (first, most robust)
    try {
      const generic = await tryViaGenericDbusScan(3000);
      if (generic) return generic;
    } catch (e) {
      // noop
    }

    // 2) Targeted legacy probes (kept for completeness)
    try {
      const om = await tryLomiriOverObjectManager(2000);
      if (om) return om;
    } catch (e) {
      // noop
    }

    try {
      const viaIntrospect = await tryLomiriViaIntrospect(3000);
      if (viaIntrospect) return viaIntrospect;
    } catch (e) {
      // noop
    }
  }

  // 3) QML one-shot (reserve) — may still be blocked by X check on some builds
  try {
    const q = await tryQmlOnce(qmlTimeout);
    if (q) return q;
  } catch (e) {
    // no op
  }

  // 4) Last resort
  return await tryIpFallback(timeoutMs);
}
