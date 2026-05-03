import { fetchText } from './fetchUtils';
import type { CrisisEvent, CrisisLayer } from './types';
import { getSeverity } from '../_lib/scoring';
import { calculateConfidenceScore, inferDataQualityIndicators } from '../_lib/confidence';

function matchTag(xmlSnippet: string, tagName: string): string {
  const re = new RegExp(`<${escapeReg(tagName)}>([\\s\\S]*?)</${escapeReg(tagName)}>`);
  const m = xmlSnippet.match(re);
  if (!m) return '';
  return decodeHtml(m[1].trim());
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

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').trim();
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function layerFromText(text: string): CrisisLayer {
  if (/flood/i.test(text)) return 'floods';
  if (/(cyclone|storm|hurricane|typhoon)/i.test(text)) return 'storms';
  if (/volcano/i.test(text)) return 'volcanoes';
  if (/earthquake/i.test(text)) return 'earthquakes';
  if (/wildfire|fire/i.test(text)) return 'wildfires';
  return 'storms';
}

export async function fetchGDACS(): Promise<CrisisEvent[]> {
  const url = 'https://www.gdacs.org/xml/rss.xml';
  const xml = await fetchText(url, undefined, { timeoutMs: 9000, retries: 2 });

  const items = xml.split('<item>').slice(1).map((chunk) => chunk.split('</item>')[0] ?? '');
  const out: CrisisEvent[] = [];

  for (const item of items.slice(0, 120)) {
    const title = matchTag(item, 'title');
    const link = matchTag(item, 'link');
    const pubDate = matchTag(item, 'pubDate');
    const desc = matchTag(item, 'description');
    const point = matchTag(item, 'georss:point');

    const [latStr, lonStr] = point ? point.split(/\\s+/) : [];
    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const text = `${title} ${desc}`;
    const layer = layerFromText(text);
    const time = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
    const description = stripHtml(desc) || undefined;

    const base = {
      id: `gdacs:${hash(title + link)}`,
      source: 'gdacs',
      layer,
      title: title || 'GDACS Alert',
      description,
      time,
      lat,
      lon,
      place: undefined,
      metrics: undefined,
      links: {
        url: link || undefined,
        news: link || undefined
      }
    } satisfies Omit<CrisisEvent, 'severityScore' | 'severityLabel' | 'confidenceScore'>;

    const sev = getSeverity(base);
    const indicators = inferDataQualityIndicators(base);
    const confidence = calculateConfidenceScore(base, indicators);

    out.push({
      ...base,
      severityScore: sev.severityScore,
      severityLabel: sev.severityLabel,
      confidenceScore: confidence
    });
  }

  return out;
}
