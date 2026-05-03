import { fetchJson } from './fetchUtils';
import type { CrisisEvent } from './types';
import { getSeverity } from '../_lib/scoring';
import { calculateConfidenceScore, inferDataQualityIndicators } from '../_lib/confidence';

type UsgsGeoJson = {
  features?: Array<{
    id: string;
    properties?: {
      mag?: number;
      place?: string;
      time?: number;
      url?: string;
      type?: string;
    };
    geometry?: { coordinates?: [number, number, number?] };
  }>;
};

export async function fetchEarthquakes(): Promise<CrisisEvent[]> {
  const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=50';
  const json = await fetchJson<UsgsGeoJson>(url, undefined, { timeoutMs: 7000, retries: 2 });

  const feats = json.features ?? [];

  const events: CrisisEvent[] = [];
  for (const f of feats) {
    const p = f.properties ?? {};
    const coords = f.geometry?.coordinates ?? [NaN, NaN];
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const mag = Number(p.mag ?? 0);
    const place = typeof p.place === 'string' ? p.place : undefined;
    const time = new Date(Number(p.time ?? Date.now())).toISOString();

    const base = {
      id: `usgs:${f.id}`,
      source: 'usgs',
      title: `M ${mag.toFixed(1)} Earthquake`,
      description: place,
      time,
      lat,
      lon,
      place,
      layer: 'earthquakes' as const,
      metrics: {
        magnitude: Number.isFinite(mag) ? mag : null
      },
      links: {
        url: typeof p.url === 'string' ? p.url : undefined,
        news: typeof p.url === 'string' ? p.url : undefined
      }
    } satisfies Omit<CrisisEvent, 'severityScore' | 'severityLabel' | 'confidenceScore'>;

    const sev = getSeverity(base);
    const indicators = inferDataQualityIndicators(base);
    const confidence = calculateConfidenceScore(base, indicators);

    events.push({
      ...base,
      severityScore: sev.severityScore,
      severityLabel: sev.severityLabel,
      confidenceScore: confidence
    });
  }

  return events;
}
