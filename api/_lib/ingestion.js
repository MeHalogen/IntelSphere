import { scoreEvent } from './scoring.js';

function labelFromScore(score) {
  if (score >= 90) return 'critical';
  if (score >= 75) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

function normalize(e) {
  const score = Math.max(0, Math.min(100, e.severityScore ?? scoreEvent(e)));
  return {
    ...e,
    severityScore: score,
    severityLabel: e.severityLabel ?? labelFromScore(score)
  };
}

export async function ingest(layers) {
  const tasks = [];
  if (layers.includes('earthquakes')) tasks.push(ingestUsgsEarthquakes());
  if (layers.includes('wildfires')) tasks.push(Promise.resolve([]));
  if (layers.includes('floods')) tasks.push(ingestGdacsFloods());
  if (layers.includes('storms')) tasks.push(Promise.resolve([]));
  if (layers.includes('airspace')) tasks.push(ingestAirspaceDisruptions());
  if (layers.includes('volcanoes')) tasks.push(Promise.resolve([]));
  if (layers.includes('conflicts')) tasks.push(Promise.resolve([]));

  const results = await Promise.all(tasks);
  return results.flat().map(normalize);
}

export async function ingestUsgsEarthquakes() {
  // fallback to all_day when significant_day is empty
  const urls = [
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_day.geojson',
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson'
  ];

  for (const url of urls) {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) continue;
    const json = await res.json();
    const feats = json?.features ?? [];
    const mapped = feats
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
          layer: 'earthquakes',
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
        };
      })
      .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lon));

    if (mapped.length > 0) return mapped;
  }

  return [];
}

export async function ingestGdacsFloods() {
  const url = 'https://www.gdacs.org/xml/rss.xml';
  const res = await fetch(url, { headers: { accept: 'application/xml,text/xml,*/*' } });
  if (!res.ok) return [];
  const text = await res.text();

  const items = text.split('<item>').slice(1).map((chunk) => chunk.split('</item>')[0] ?? '');
  const out = [];

  for (const item of items.slice(0, 80)) {
    const title = matchTag(item, 'title');
    const link = matchTag(item, 'link');
    const pubDate = matchTag(item, 'pubDate');
    const desc = matchTag(item, 'description');

    const isFlood = /flood/i.test(title + ' ' + desc);
    const isStorm = /(cyclone|storm|hurricane|typhoon)/i.test(title + ' ' + desc);
    if (!isFlood && !isStorm) continue;

    const point = matchTag(item, 'georss:point');
    const [latStr, lonStr] = point ? point.split(/\s+/) : [];
    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001) continue;

    out.push({
      id: `gdacs:${hash(title + link)}`,
      source: 'GDACS',
      layer: isFlood ? 'floods' : 'storms',
      title: title || 'GDACS Alert',
      description: stripHtml(desc) || undefined,
      time: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      lat,
      lon,
      links: { url: link, news: link }
    });
  }

  return out;
}

export async function ingestAirspaceDisruptions() {
  const url = 'https://opensky-network.org/api/states/all';
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) return [];
  const json = await res.json();

  const states = Array.isArray(json?.states) ? json.states : [];
  const cells = new Map();

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

  const events = [];
  for (const c of cells.values()) {
    if (c.count < 18) continue;
    const slowRatio = c.slow / c.count;
    const score = Math.max(0, Math.min(100, slowRatio * 70 + Math.log10(c.count) * 18));
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
      links: {
        url: 'https://opensky-network.org/',
        news: 'https://opensky-network.org/'
      }
    });
  }

  return events;
}

function matchTag(xmlSnippet, tagName) {
  const re = new RegExp(`<${escapeReg(tagName)}>([\s\S]*?)</${escapeReg(tagName)}>`);
  const m = xmlSnippet.match(re);
  if (!m) return '';
  return decodeHtml(m[1].trim());
}

function stripHtml(s) {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
