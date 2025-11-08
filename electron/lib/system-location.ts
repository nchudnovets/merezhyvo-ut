import { systemBus, Variant } from 'dbus-next';
import { spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

export type PositionFix = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number; // ms since epoch
};

type DBusProps = {
  Get(interfaceName: string, property: string): Promise<Variant>;
};
type GeoClueManager = {
  CreateClient(): Promise<string>; // object path
};
type GeoClueClient = {
  Start(): Promise<void>;
  Stop(): Promise<void>;
};

function geoLog(msg: string): void {
  try {
    const dir = app.getPath('userData');
    const file = path.join(dir, 'geo.log');
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(file, line, 'utf8');
  } catch {
    // ignore logging errors
  }
}

function asNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}
function variantValue(v: Variant | unknown): unknown {
  return (v as Variant)?.value ?? v;
}

async function getWithGeoClue2(timeoutMs: number): Promise<PositionFix | null> {
  const bus = systemBus();

  // Manager
  const managerObj = await bus.getProxyObject('org.freedesktop.GeoClue2', '/org/freedesktop/GeoClue2/Manager');
  const manager = managerObj.getInterface('org.freedesktop.GeoClue2.Manager') as unknown as GeoClueManager;

  // Client
  const clientPath = await manager.CreateClient();
  const clientObj = await bus.getProxyObject('org.freedesktop.GeoClue2', clientPath);
  const client = clientObj.getInterface('org.freedesktop.GeoClue2.Client') as unknown as GeoClueClient;
  const clientProps = clientObj.getInterface('org.freedesktop.DBus.Properties') as unknown as DBusProps;

  // Optional: set RequestedAccuracyLevel/DesktopId if available (best-effort, ignore errors)
  try {
    const propsIf = clientObj.getInterface('org.freedesktop.DBus.Properties') as unknown as {
      Set: (iface: string, prop: string, value: Variant) => Promise<void>;
    };
    await propsIf.Set(
      'org.freedesktop.GeoClue2.Client',
      'RequestedAccuracyLevel',
      new Variant('u', 3) // 1: country, 2: city, 3: neighborhood, 4: street, 5: exact
    );
  } catch {
    // ignore
  }

  // Start updates
  await client.Start();

  const deadline = Date.now() + Math.max(1000, timeoutMs);
  let lastError: unknown = null;

  try {
    while (Date.now() < deadline) {
      try {
        const locPathVar = await clientProps.Get('org.freedesktop.GeoClue2.Client', 'Location');
        const locPath = asString(variantValue(locPathVar));
        if (locPath) {
          const locObj = await bus.getProxyObject('org.freedesktop.GeoClue2', locPath);
          const locProps = locObj.getInterface('org.freedesktop.DBus.Properties') as unknown as DBusProps;
          const lat = asNumber(variantValue(await locProps.Get('org.freedesktop.GeoClue2.Location', 'Latitude')));
          const lon = asNumber(variantValue(await locProps.Get('org.freedesktop.GeoClue2.Location', 'Longitude')));
          const acc = asNumber(variantValue(await locProps.Get('org.freedesktop.GeoClue2.Location', 'Accuracy')));
          const tsVar = await locProps.Get('org.freedesktop.GeoClue2.Location', 'Timestamp'); // optional
          const tsVal = variantValue(tsVar);
          const ts = typeof tsVal === 'object' && tsVal !== null && 'seconds' in (tsVal as Record<string, unknown>)
            ? Number((tsVal as Record<string, unknown>).seconds) * 1000
            : Date.now();

          if (lat != null && lon != null) {
            return {
              latitude: lat,
              longitude: lon,
              accuracy: acc ?? 0,
              timestamp: Number.isFinite(ts) ? ts : Date.now()
            };
          }
        }
      } catch (e) {
        lastError = e;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  } finally {
    try {
      await client.Stop();
    } catch {
      // ignore
    }
  }

  // No fix
  const _ = lastError;
  return null;
}

async function getWithQtLocation(timeoutMs: number): Promise<PositionFix | null> {
  // 1) Resolve QML path (resources → dist-electron → source)
  const qmlCandidates: string[] = [];
  try {
    const res = process.resourcesPath || '';
    if (res) qmlCandidates.push(path.join(res, 'ut', 'location_once.qml'));
  } catch {}
  qmlCandidates.push(path.resolve(__dirname, '../ut/location_once.qml'));
  qmlCandidates.push(path.resolve(__dirname, '../../electron/ut/location_once.qml'));

  let qmlPath = '';
  for (const p of qmlCandidates) {
    try {
      fs.statSync(p);
      qmlPath = p;
      break;
    } catch {}
  }
  if (!qmlPath) {
    geoLog('QtLocation: QML not found in resources/dev paths');
    return null;
  }

  // 2) Build Qt env for offscreen usage
  //    Try common Qt5 locations for UT (arm64/armhf) and generic /usr/lib/qt5
  const qtRoots = [
    '/usr/lib/aarch64-linux-gnu/qt5',
    '/usr/lib/arm-linux-gnueabihf/qt5',
    '/usr/lib/qt5'
  ];
  const pluginPaths: string[] = [];
  const qmlImportPaths: string[] = [];
  for (const root of qtRoots) {
    const pPlugins = path.join(root, 'plugins');
    const pQml = path.join(root, 'qml');
    try {
      if (fs.existsSync(pPlugins)) pluginPaths.push(pPlugins);
    } catch {}
    try {
      if (fs.existsSync(pQml)) qmlImportPaths.push(pQml);
    } catch {}
  }

  const childEnv = {
    ...process.env,
    // Force offscreen so qmlscene won't touch Mir/Lomiri at all
    QT_QPA_PLATFORM: 'offscreen',
    // Make sure plugins and QML modules are discoverable
    ...(pluginPaths.length ? { QT_PLUGIN_PATH: pluginPaths.join(':') } : {}),
    ...(qmlImportPaths.length ? { QML2_IMPORT_PATH: qmlImportPaths.join(':') } : {})
  };

  // 3) Spawn qmlscene
  const cmd = 'qmlscene';
  const args = ['-platform', 'offscreen', '-quit', qmlPath, `--timeout=${Math.max(1000, timeoutMs)}`];

  geoLog(`QtLocation: spawning qmlscene: ${cmd} ${args.join(' ')}`);
  if (childEnv.QT_PLUGIN_PATH) geoLog(`QtLocation: QT_PLUGIN_PATH=${childEnv.QT_PLUGIN_PATH}`);
  if (childEnv.QML2_IMPORT_PATH) geoLog(`QtLocation: QML2_IMPORT_PATH=${childEnv.QML2_IMPORT_PATH}`);

  try {
    const child = spawn(cmd, args, {
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let outBuf = '';
    let errBuf = '';

    const result = await new Promise<PositionFix | null>((resolve) => {
      const killTimer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch {}
        geoLog('QtLocation: timeout waiting for fix');
        resolve(null);
      }, Math.max(1200, timeoutMs + 600));

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      child.stdout.on('data', (chunk: string) => {
        outBuf += chunk;
        // Parse lines for our marker
        const lines = outBuf.split('\n');
        // Keep last partial line in buffer
        outBuf = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('__MZR_FIX__')) {
            try {
              const payload = line.slice('__MZR_FIX__'.length);
              const parsed = payload === 'null' ? null : JSON.parse(payload);
              clearTimeout(killTimer);
              try { child.kill('SIGKILL'); } catch {}
              if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
                const fix: PositionFix = {
                  latitude: parsed.latitude,
                  longitude: parsed.longitude,
                  accuracy: typeof parsed.accuracy === 'number' ? parsed.accuracy : 0,
                  timestamp: typeof parsed.timestamp === 'number' ? parsed.timestamp : Date.now()
                };
                geoLog(`QtLocation: got fix lat=${fix.latitude} lon=${fix.longitude} acc=${fix.accuracy}`);
                resolve(fix);
              } else {
                geoLog('QtLocation: got null/invalid fix');
                resolve(null);
              }
              return;
            } catch (e) {
              geoLog(`QtLocation: parse error: ${String(e)}`);
              resolve(null);
            }
          }
        }
      });

      child.stderr.on('data', (chunk: string) => {
        errBuf += chunk;
      });

      child.on('exit', (code, sig) => {
        clearTimeout(killTimer);
        if (errBuf.trim()) geoLog(`QtLocation: qmlscene stderr: ${errBuf.trim()}`);
        geoLog(`QtLocation: qmlscene exit code=${code ?? -1} sig=${sig ?? 'none'}`);
        resolve(null);
      });

      child.on('error', (err) => {
        clearTimeout(killTimer);
        geoLog(`QtLocation: spawn error: ${String(err)}`);
        resolve(null);
      });
    });

    return result;
  } catch (e) {
    geoLog(`QtLocation: exception spawning qmlscene: ${String(e)}`);
    return null;
  }
}


/**
 * Best-effort Ubuntu legacy backend (placeholder).
 * Many UT images expose GeoClue2; if not, we'll extend to ubuntu-location-service here.
 */
async function getWithUbuntuLegacy(_timeoutMs: number): Promise<PositionFix | null> {
  return null;
}

export async function getSystemPosition(timeoutMs = 8000): Promise<PositionFix | null> {
  geoLog(`getSystemPosition(timeoutMs=${timeoutMs})`);
  try {
    const qmlFix = await getWithQtLocation(timeoutMs);
    if (qmlFix) return qmlFix;
  } catch {
    // ignore and try geoclue2
  }
  try {
    const fix = await getWithGeoClue2(timeoutMs);
    if (fix) return fix;
  } catch {
    // ignore and try legacy
  }
  try {
    const fix = await getWithUbuntuLegacy(timeoutMs);
    if (fix) return fix;
  } catch {
    // ignore
  }
  return null;
}
