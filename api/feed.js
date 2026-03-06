import { ingest } from './_lib/ingestion.js';

const DEFAULT_LAYERS = ['earthquakes', 'wildfires', 'floods', 'storms', 'conflicts', 'airspace', 'volcanoes'];

function parseLayers(q) {
	const s = Array.isArray(q) ? q.join(',') : q;
	if (!s) return DEFAULT_LAYERS;
	const raw = s
		.split(',')
		.map((x) => x.trim())
		.filter(Boolean);
	const allowed = new Set(DEFAULT_LAYERS);
	return raw.filter((x) => allowed.has(x));
}

function buildAggregates(events) {
	const region = new Map();
	const air = new Map();

	const kw = new Map();
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

export const config = { runtime: 'edge' };

export default async function handler(req, res) {
	const layers = parseLayers(req.query?.layers);
	const limit = Math.max(50, Math.min(10_000, Number(req.query?.limit ?? 2000) || 2000));

	const events = await ingest(layers);
	const limited = events.sort((a, b) => b.severityScore - a.severityScore).slice(0, limit);

	const payload = {
		generatedAt: new Date().toISOString(),
		events: limited,
		aggregates: buildAggregates(limited)
	};

	res.setHeader('content-type', 'application/json; charset=utf-8');
	res.setHeader('cache-control', 'no-cache');
	res.status(200).send(JSON.stringify(payload));
}
