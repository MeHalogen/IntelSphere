import { fetchJson } from './fetchUtils';
import type { CrisisEvent } from './types';
import { getSeverity } from '../_lib/scoring';

type OpenSkyStates = {
  time?: number;
  states?: any[];
};

export async function fetchOpenSky(): Promise<CrisisEvent[]> {
  const url = 'https://opensky-network.org/api/states/all';
  const json = await fetchJson<OpenSkyStates>(url, undefined, { timeoutMs: 8000, retries: 1 });

  const states: any[] = Array.isArray(json.states) ? json.states : [];

  // Aggregate into 0.5° grid cells.
  const cells = new Map<string, { lat: number; lon: number; count: number; slow: number }>();

  for (const s of states) {
    const lon = Number(s[5]);
    const lat = Number(s[6]);
    const onGround = Boolean(s[8]);
    const vel = Number(s[9]);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (onGround) continue;

    const isSlow = Number.isFinite(vel) && vel > 0 && vel < 60;
    const key = `${Math.round(lat * 2) / 2}:${Math.round(lon * 2) / 2}`;
    const cur = cells.get(key) ?? { lat: Math.round(lat * 2) / 2, lon: Math.round(lon * 2) / 2, count: 0, slow: 0 };
    cur.count += 1;
    if (isSlow) cur.slow += 1;
    cells.set(key, cur);
  }

  const now = new Date().toISOString();
  const out: CrisisEvent[] = [];

  for (const c of cells.values()) {
    if (c.count < 18) continue;
    const base = {
      id: `opensky:${c.lat.toFixed(2)}:${c.lon.toFixed(2)}`,
      source: 'opensky',
      layer: 'airspace' as const,
      title: 'Air Traffic Disruption Hotspot',
      description: `High airborne density detected (${c.count} aircraft).`,
      time: now,
      lat: c.lat,
      lon: c.lon,
      metrics: {
        aircraftCount: c.count
      },
      links: {
        url: 'https://opensky-network.org/',
        news: 'https://opensky-network.org/'
      }
    } satisfies Omit<CrisisEvent, 'severityScore' | 'severityLabel'>;

    const sev = getSeverity(base);

    out.push({
      ...base,
      severityScore: sev.severityScore,
      severityLabel: sev.severityLabel
    });
  }

  return out;
}
