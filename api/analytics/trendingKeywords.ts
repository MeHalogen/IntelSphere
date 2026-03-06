import type { CrisisEvent } from '../_lib/types';

export type TrendingKeyword = {
  keyword: string;
  /** recentRate / baselineRate. Values > 1 indicate a spike. */
  spike: number;
  /** raw counts for debugging/quality; safe to ignore */
  recentCount: number;
  baselineCount: number;
};

type Options = {
  /** defaults to Date.now() */
  nowMs?: number;
  /** recent window used for “current” frequency; default 2h */
  recentWindowMs?: number;
  /** baseline window; default 24h */
  baselineWindowMs?: number;
  /** maximum number of results; default 16 */
  limit?: number;
  /** minimum baseline count required to score; default 2 */
  minBaselineCount?: number;
  /** stopwords override/extend */
  stopwords?: Set<string>;
};

const DEFAULT_STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'near',
  'from',
  'into',
  'over',
  'alert',
  'update',
  'major',
  'minor',
  'reported',
  'report',
  'breaking',
  'news',
  'live',
  'warning',
  'advisory',
  'issued',
  'region',
  'area',
  'state',
  'province',
  'city',
  'county'
]);

function tokenizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function isKeyword(tok: string, stopwords: Set<string>) {
  if (tok.length < 4) return false;
  if (stopwords.has(tok)) return false;
  // drop mostly-numeric tokens
  const digits = tok.replace(/\D+/g, '').length;
  if (digits >= Math.max(3, Math.ceil(tok.length * 0.7))) return false;
  return true;
}

/**
 * Compute trending keywords by comparing a recent time window vs a 24h baseline.
 *
 * Deterministic given (events, nowMs).
 */
export function trendingKeywords(events: CrisisEvent[], opts?: Options): TrendingKeyword[] {
  const nowMs = opts?.nowMs ?? Date.now();
  const recentWindowMs = opts?.recentWindowMs ?? 2 * 60 * 60_000;
  const baselineWindowMs = opts?.baselineWindowMs ?? 24 * 60 * 60_000;
  const limit = opts?.limit ?? 16;
  const minBaselineCount = opts?.minBaselineCount ?? 2;
  const stopwords = opts?.stopwords ?? DEFAULT_STOPWORDS;

  const recentStart = nowMs - recentWindowMs;
  const baselineStart = nowMs - baselineWindowMs;

  const recentCounts = new Map<string, number>();
  const baselineCounts = new Map<string, number>();

  for (const e of events) {
    const t = Date.parse(e.time);
    if (!Number.isFinite(t)) continue;
    if (t < baselineStart || t > nowMs) continue;

    const toks = tokenizeTitle(e.title ?? '');
    for (const tok of toks) {
      if (!isKeyword(tok, stopwords)) continue;

      baselineCounts.set(tok, (baselineCounts.get(tok) ?? 0) + 1);
      if (t >= recentStart) {
        recentCounts.set(tok, (recentCounts.get(tok) ?? 0) + 1);
      }
    }
  }

  const recentHours = Math.max(1e-6, recentWindowMs / 3600_000);
  const baselineHours = Math.max(1e-6, baselineWindowMs / 3600_000);

  const scored: TrendingKeyword[] = [];
  for (const [keyword, baselineCount] of baselineCounts.entries()) {
    if (baselineCount < minBaselineCount) continue;
    const recentCount = recentCounts.get(keyword) ?? 0;

    const baselineRate = baselineCount / baselineHours;
    const recentRate = recentCount / recentHours;

    // Smoothing so keywords with baselineCount=2 don't explode too hard.
    const spike = (recentRate + 0.05) / (baselineRate + 0.05);

    if (spike <= 1.05) continue; // ignore flat terms

    scored.push({
      keyword,
      spike: Number(spike.toFixed(2)),
      recentCount,
      baselineCount
    });
  }

  // Deterministic ordering: spike desc, then recentCount desc, then keyword asc.
  scored.sort((a, b) => {
    if (b.spike !== a.spike) return b.spike - a.spike;
    if (b.recentCount !== a.recentCount) return b.recentCount - a.recentCount;
    return a.keyword.localeCompare(b.keyword);
  });

  return scored.slice(0, limit);
}
