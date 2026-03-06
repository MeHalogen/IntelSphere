import { ingest } from './_lib/ingestion';
import type { CrisisLayer, FeedResponse } from './_lib/types';

const DEFAULT_LAYERS: CrisisLayer[] = ['earthquakes', 'wildfires', 'floods', 'storms', 'conflicts', 'airspace', 'volcanoes'];

function parseLayers(q: string | string[] | undefined): CrisisLayer[] {
  const s = Array.isArray(q) ? q.join(',') : q;
  if (!s) return DEFAULT_LAYERS;
  const raw = s.split(',').map((x) => x.trim()).filter(Boolean);
  const allowed = new Set(DEFAULT_LAYERS);
  return raw.filter((x): x is CrisisLayer => allowed.has(x as CrisisLayer));
}

export const config = {
  runtime: 'edge'
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const layers = parseLayers(url.searchParams.get('layers') ?? undefined);

  const limit = Math.max(50, Math.min(10_000, Number(url.searchParams.get('limit') ?? 2000) || 2000));

  const events = await ingest(layers);
  const limited = events
    .sort((a, b) => b.severityScore - a.severityScore)
    .slice(0, limit);

  const aggregates = buildAggregates(limited);

  const payload: FeedResponse = {
    generatedAt: new Date().toISOString(),
  events: limited,
    aggregates
  };

  // Edge caching - tune to match source SLAs.
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, s-maxage=15, stale-while-revalidate=120'
    }
  });
}

function buildAggregates(events: FeedResponse['events']): NonNullable<FeedResponse['aggregates']> {
  // Region bucketing heuristic: 10° grid with name like "N30 E120".
  const region = new Map<string, { severitySum: number; count: number }>();
  const air = new Map<string, { severitySum: number; count: number }>();

  const kw = new Map<string, number>();
  const stop = new Set(['the', 'and', 'for', 'with', 'near', 'from', 'into', 'over', 'alert', 'update', 'major', 'minor']);

  for (const e of events) {
    const latBand = Math.round(e.lat / 10) * 10;
    const lonBand = Math.round(e.lon / 10) * 10;
    const name = `${latBand >= 0 ? 'N' : 'S'}${Math.abs(latBand)} ${lonBand >= 0 ? 'E' : 'W'}${Math.abs(lonBand)}`;

    const r = region.get(name) ?? { severitySum: 0, count: 0 };
    r.severitySum += e.severityScore;
    r.count += 1;
    region.set(name, r);

    if (e.layer === 'airspace') {
      const a = air.get(name) ?? { severitySum: 0, count: 0 };
      a.severitySum += e.severityScore;
      a.count += 1;
      air.set(name, a);
    }

    const text = `${e.title} ${e.description ?? ''}`.toLowerCase();
    for (const raw of text.split(/[^a-z0-9]+/g)) {
      const w = raw.trim();
      if (!w || w.length < 4) continue;
      if (stop.has(w)) continue;
      kw.set(w, (kw.get(w) ?? 0) + Math.min(3, 0.5 + e.severityScore / 60));
    }
  }

  const topRiskRegions = [...region.entries()]
    .map(([name, v]) => ({ name, severity: v.severitySum / Math.max(1, v.count), count: v.count }))
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 12);

  const airTrafficDisruptions = [...air.entries()]
    .map(([name, v]) => ({ name, severity: v.severitySum / Math.max(1, v.count), count: v.count }))
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 12);

  const trendingKeywords = [...kw.entries()]
    .map(([keyword, weight]) => ({ keyword, weight: Number(weight.toFixed(2)) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 16);

  return { topRiskRegions, airTrafficDisruptions, trendingKeywords };
}
