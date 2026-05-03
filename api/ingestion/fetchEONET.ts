import { fetchJson } from './fetchUtils';
import type { CrisisEvent, CrisisLayer } from './types';
import { getSeverity } from '../_lib/scoring';
import { calculateConfidenceScore, inferDataQualityIndicators } from '../_lib/confidence';

type Eonet = {
  events?: Array<{
    id: string;
    title?: string;
    description?: string;
    link?: string;
    categories?: Array<{ id: string; title?: string }>;
    sources?: Array<{ url?: string }>; // sometimes present
    geometry?: Array<{ date?: string; type?: string; coordinates?: any }>;
  }>;
};

function layerFromCategories(cats: Array<{ id: string; title?: string }> | undefined): CrisisLayer {
  const t = (cats ?? []).map((c) => `${c.id}:${c.title ?? ''}`.toLowerCase()).join(' ');
  if (/wildfire|fire/.test(t)) return 'wildfires';
  if (/severe\s*storms|storm|hurricane|cyclone|typhoon/.test(t)) return 'storms';
  if (/flood/.test(t)) return 'floods';
  if (/volcano/.test(t)) return 'volcanoes';
  // EONET also includes earthquakes sometimes
  if (/earthquake/.test(t)) return 'earthquakes';
  return 'storms';
}

function lastPoint(geom: any[] | undefined): { lat: number; lon: number; time: string } | null {
  const g = Array.isArray(geom) ? geom : [];
  const last = g[g.length - 1];
  if (!last) return null;
  const time = typeof last.date === 'string' ? new Date(last.date).toISOString() : new Date().toISOString();

  // Point: [lon, lat]. Polygon: [[lon,lat],...]
  const coords = last.coordinates;
  if (Array.isArray(coords) && typeof coords[0] === 'number') {
    const lon = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, time };
  }

  if (Array.isArray(coords) && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
    const ring = coords[0];
    const p = ring[Math.floor(ring.length / 2)];
    const lon = Number(p?.[0]);
    const lat = Number(p?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, time };
  }

  return null;
}

export async function fetchEONET(): Promise<CrisisEvent[]> {
  const url = 'https://eonet.gsfc.nasa.gov/api/v3/events';
  const json = await fetchJson<Eonet>(url, undefined, { timeoutMs: 8000, retries: 2 });

  const events: CrisisEvent[] = [];
  for (const e of json.events ?? []) {
    const p = lastPoint(e.geometry);
    if (!p) continue;
    const layer = layerFromCategories(e.categories);
    const sourceUrl = e.sources?.[0]?.url;

    const base = {
      id: `eonet:${e.id}`,
      source: 'eonet',
      layer,
      title: e.title ?? 'NASA EONET Event',
      description: e.description ?? undefined,
      time: p.time,
      lat: p.lat,
      lon: p.lon,
      metrics: undefined,
      links: {
        url: typeof e.link === 'string' ? e.link : sourceUrl,
        news: sourceUrl
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
