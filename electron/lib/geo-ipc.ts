// commenting it out temporary since this functionality is paused yet

// import { app, ipcMain } from 'electron';
// import fs from 'fs';
// import path from 'path';
// import { getSystemPosition } from './system-location';

// type GeoFix = {
//   latitude: number;
//   longitude: number;
//   accuracy?: number;
//   timestamp: number;
//   altitude?: number | null;
//   heading?: number | null;
//   speed?: number | null;
// };

// let _installed = false;
// let inflightGeo: Promise<GeoFix | null> | null = null;
// let lastFix: GeoFix | null = null;

// function geoLog(msg: string): void {
//   try {
//     const file = path.join(app.getPath('userData'), 'geo.log');
//     fs.appendFileSync(file, `[${new Date().toISOString()}] ${msg}\n`, 'utf8');
//   } catch {
//     // ignore
//   }
// }

// function handleOnce(channel: string, handler: (...args: any[]) => any): void {
//   try { ipcMain.removeHandler(channel); } catch {}
//   ipcMain.handle(channel, handler);
// }

export function installGeoHandlers(): void {
  return;
  // if (_installed) return;
  // _installed = true;

  // handleOnce('mzr:geo:log', async (_e, msg: string) => {
  //   geoLog(String(msg));
  //   return true;
  // });

  // handleOnce(
  //   'mzr:geo:getCurrentPosition',
  //   async (_e, payload: { timeoutMs?: number; maximumAge?: number }) => {
  //     const timeoutMs = Math.max(1000, Math.min(300000, Number(payload?.timeoutMs ?? 8000)));
  //     const maximumAge = Math.max(0, Number(payload?.maximumAge ?? 0));

  //     // Serve from cache if fresh enough
  //     if (lastFix && maximumAge > 0) {
  //       const age = Date.now() - lastFix.timestamp;
  //       if (age <= maximumAge) {
  //         geoLog(`geo:getCurrentPosition cache hit age=${age}ms`);
  //         return lastFix;
  //       }
  //     }

  //     if (inflightGeo) {
  //       geoLog('geo:getCurrentPosition coalesced with inflight');
  //       return inflightGeo;
  //     }

  //     inflightGeo = (async () => {
  //       geoLog(`geo:getCurrentPosition timeoutMs=${timeoutMs} maximumAge=${maximumAge}`);
  //       try {
  //         const fix = await getSystemPosition(timeoutMs);
  //         if (fix) {
  //           const out: GeoFix = {
  //             latitude: fix.latitude,
  //             longitude: fix.longitude,
  //             accuracy: fix.accuracy ?? 50000,
  //             timestamp: Date.now(),
  //             altitude: null,
  //             heading: null,
  //             speed: null
  //           };
  //           lastFix = out;
  //           geoLog(`geo:getCurrentPosition result=${out.latitude},${out.longitude}±${out.accuracy}`);
  //           return out;
  //         }
  //         geoLog('geo:getCurrentPosition result=null');
  //         return null;
  //       } catch (e) {
  //         geoLog(`geo:getCurrentPosition error=${String(e)}`);
  //         return null;
  //       } finally {
  //         inflightGeo = null;
  //       }
  //     })();

  //     return inflightGeo;
  //   }
  // );
}
