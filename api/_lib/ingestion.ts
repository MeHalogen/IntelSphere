import type { CrisisEvent, CrisisLayer } from './types';
import { scoreEvent } from './scoring';

type ExternalEvent = Omit<CrisisEvent, 'severityScore' | 'severityLabel'> & {
  severityScore?: number;
  severityLabel?: CrisisEvent['severityLabel'];
};

function labelFromScore(score: number): CrisisEvent['severityLabel'] {
  if (score >= 90) return 'critical';
  if (score >= 75) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

function normalize(e: ExternalEvent): CrisisEvent {
  const score = Math.max(0, Math.min(100, e.severityScore ?? scoreEvent(e)));
  return {
    ...e,
    severityScore: score,
    severityLabel: e.severityLabel ?? labelFromScore(score)
  };
}

export async function ingest(layers: CrisisLayer[]): Promise<CrisisEvent[]> {
  const tasks: Array<Promise<ExternalEvent[]>> = [];

  if (layers.includes('earthquakes')) tasks.push(ingestUsgsEarthquakes());
  if (layers.includes('wildfires')) tasks.push(ingestNasaFirmsWildfires());
  if (layers.includes('floods')) tasks.push(ingestGdacsFloods());
  if (layers.includes('storms')) tasks.push(ingestNoaaStorms());
  if (layers.includes('airspace')) tasks.push(ingestAirspaceDisruptions());
  if (layers.includes('volcanoes')) tasks.push(ingestVolcanoes());
  if (layers.includes('conflicts')) tasks.push(ingestConflicts());

  const results = await Promise.all(tasks);
  return results.flat().map(normalize);
}

export async function ingestUsgsEarthquakes(): Promise<ExternalEvent[]> {
  // Past 1 day significant eq; fast + clean GeoJSON.
  const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson';
  const res = await fetch(url, { headers: { 'accept': 'application/json' } });
  if (!res.ok) return [];
  const json = (await res.json()) as any;

  const feats: any[] = json?.features ?? [];
  return feats
    .map((f) => {
      const id = String(f.id);
      const p = f.properties ?? {};
      const c = f.geometry?.coordinates ?? [];
      const lon = Number(c[0]);
      const lat = Number(c[1]);
      const mag = Number(p.mag ?? 0);
      const place = typeof p.place === 'string' ? p.place : undefined;
      const timeMs = Number(p.time ?? Date.now());

      return {
        id: `usgs:${id}`,
        source: 'USGS',
        layer: 'earthquakes' as const,
        title: `M ${mag.toFixed(1)} Earthquake`,
        description: place,
        time: new Date(timeMs).toISOString(),
        lat,
        lon,
        place,
        metrics: {
          magnitude: mag,
          tsunami: Boolean(p.tsunami),
          feltReports: Number(p.felt ?? 0)
        },
        links: {
          url: typeof p.url === 'string' ? p.url : undefined,
          news: typeof p.url === 'string' ? p.url : undefined
        }
      } satisfies ExternalEvent;
    })
    .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lon));
}

export async function ingestGdacsFloods(): Promise<ExternalEvent[]> {
  // GDACS provides multi-hazard alerts; we pull the latest feed and filter flood/storm.
  const url = 'https://www.gdacs.org/xml/rss.xml';
  const res = await fetch(url, { headers: { accept: 'application/xml,text/xml,*/*' } });
  if (!res.ok) return [];
  const text = await res.text();

  // Minimal RSS parsing to avoid heavy deps; best-effort.
  const items = text.split('<item>').slice(1).map((chunk) => chunk.split('</item>')[0] ?? '');
  const events: ExternalEvent[] = [];

  for (const item of items.slice(0, 80)) {
    const title = matchTag(item, 'title');
    const link = matchTag(item, 'link');
    const pubDate = matchTag(item, 'pubDate');
    const desc = matchTag(item, 'description');

    const isFlood = /flood/i.test(title + ' ' + desc);
    const isStorm = /(cyclone|storm|hurricane|typhoon)/i.test(title + ' ' + desc);
    if (!isFlood && !isStorm) continue;

    // GDACS sometimes includes lat/lon in <georss:point>
    const point = matchTag(item, 'georss:point');
    const [latStr, lonStr] = point ? point.split(/\\s+/) : [];
    const lat = Number(latStr);
    const lon = Number(lonStr);

    events.push({
      id: `gdacs:${hash(title + link)}`,
      source: 'GDACS',
      layer: (isFlood ? 'floods' : 'storms') as CrisisLayer,
      title: title || 'GDACS Alert',
      description: stripHtml(desc) || undefined,
      time: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      lat: Number.isFinite(lat) ? lat : 0,
      lon: Number.isFinite(lon) ? lon : 0,
      place: undefined,
      links: { url: link, news: link }
    });
  }

  // If no geo points, keep none (avoid incorrect clustering at 0,0)
  return events.filter((e) => Math.abs(e.lat) > 0.0001 && Math.abs(e.lon) > 0.0001);
}

// --- Placeholders / stubs (return empty arrays for now) ---

export async function ingestNasaFirmsWildfires(): Promise<ExternalEvent[]> {
  // FIRMS has CORS/key constraints depending on endpoint. Implement via proxy + API key.
  return [];
}

export async function ingestNoaaStorms(): Promise<ExternalEvent[]> {
  return [];
}

export async function ingestAirspaceDisruptions(): Promise<ExternalEvent[]> {
  // OpenSky: derive disruption hotspots by detecting unusually low groundspeed aircraft (holding patterns) and clustering by grid.
  // Note: anonymous endpoint may be rate-limited; keep request count low and cache feed at the edge.
  const url = 'https://opensky-network.org/api/states/all';
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) return [];
  const json = (await res.json()) as any;

  const states: any[] = Array.isArray(json?.states) ? json.states : [];
  type Cell = { lat: number; lon: number; count: number; slow: number };
  const cells = new Map<string, Cell>();

  for (const s of states) {
    // OpenSky state vector fields: [icao24, callsign, origin_country, time_position, last_contact, longitude, latitude, baro_altitude,
    // on_ground, velocity (m/s), true_track, vertical_rate, sensors, geo_altitude, squawk, spi, position_source]
    const lon = Number(s[5]);
    const lat = Number(s[6]);
    const onGround = Boolean(s[8]);
    const vel = Number(s[9]);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (onGround) continue;

    // 60 m/s ~ 116 knots. We treat very slow airborne traffic as potential holding.
    const isSlow = Number.isFinite(vel) && vel > 0 && vel < 60;

    const key = `${Math.round(lat * 2) / 2}:${Math.round(lon * 2) / 2}`; // 0.5° grid
    const cur = cells.get(key) ?? { lat: Math.round(lat * 2) / 2, lon: Math.round(lon * 2) / 2, count: 0, slow: 0 };
    cur.count += 1;
    if (isSlow) cur.slow += 1;
    cells.set(key, cur);
  }

  const events: ExternalEvent[] = [];
  for (const c of cells.values()) {
    if (c.count < 18) continue; // ignore sparse cells
    const slowRatio = c.slow / c.count;
    const score = Math.max(0, Math.min(100, (slowRatio * 70 + Math.log10(c.count) * 18)));
    if (score < 40) continue;
    events.push({
      id: `opensky:${c.lat.toFixed(2)}:${c.lon.toFixed(2)}`,
      source: 'OpenSky',
      layer: 'airspace',
      title: 'Air Traffic Disruption Hotspot',
      description: `Elevated airborne density detected (${c.count} aircraft in 0.5° cell). Slow-airborne ratio ${(slowRatio * 100).toFixed(
        0
      )}%.`,
      time: new Date().toISOString(),
      lat: c.lat,
      lon: c.lon,
      metrics: {
        aircraftCount: c.count,
        slowAircraft: c.slow,
        slowRatio: Number(slowRatio.toFixed(3))
      },
      severityScore: score,
      links: {
        url: 'https://opensky-network.org/',
        news: 'https://opensky-network.org/'
      }
    });
  }

  return events;
}

export async function ingestVolcanoes(): Promise<ExternalEvent[]> {
  return [];
}

export async function ingestConflicts(): Promise<ExternalEvent[]> {
  return [];
}

// --- helpers ---

function matchTag(xmlSnippet: string, tagName: string): string {
  const re = new RegExp(`<${escapeReg(tagName)}>([\\s\\S]*?)</${escapeReg(tagName)}>`);
  const m = xmlSnippet.match(re);
  if (!m) return '';
  return decodeHtml(m[1].trim());
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim();
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
