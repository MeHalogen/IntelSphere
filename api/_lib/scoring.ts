import type { CrisisEvent } from './types';

function clamp01(x: number) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

type SeverityLabel = 'low' | 'medium' | 'high' | 'critical';

export type Severity = {
  severityScore: number; // 0..100
  severityLabel: SeverityLabel;
};

// Weighted scoring budget (must sum to 100)
const WEIGHTS = {
  event: 50,
  recency: 20,
  news: 15,
  population: 10,
  infrastructure: 5
} as const;

const RECENCY_WINDOW_MS = 48 * 3600 * 1000;

function labelFromScore(score: number): SeverityLabel {
  if (score > 80) return 'critical';
  if (score > 60) return 'high';
  if (score > 35) return 'medium';
  return 'low';
}

function stableTextNewsSignal(e: Omit<CrisisEvent, 'severityScore' | 'severityLabel'>): number {
  // Output: 0..1, deterministic (pure function of event text + links)
  const text = `${e.title} ${e.description ?? ''}`.toLowerCase();

  // Link presence: 0, 0.5, 1.0
  const linkStrength = (e.links?.news ? 0.6 : 0) + (e.links?.url ? 0.4 : 0);

  // Strong cues: capped; don't let keyword stuffing dominate.
  let cue = 0;
  if (/evac|evacu/.test(text)) cue += 0.25;
  if (/tsunami/.test(text)) cue += 0.35;
  if (/ash|eruption|pyroclastic/.test(text)) cue += 0.25;
  if (/flash\s*flood|inundat/.test(text)) cue += 0.25;
  if (/state\s*of\s*emergency|disaster\s*declaration/.test(text)) cue += 0.35;
  cue = clamp01(cue);

  // Combine and cap in [0..1]
  return clamp01(linkStrength * 0.7 + cue * 0.3);
}

function eventSeveritySignal(e: Omit<CrisisEvent, 'severityScore' | 'severityLabel'>): number {
  // Output: 0..1, deterministic proxy by layer.
  // NOTE: placeholders are intentionally conservative; tune per-source as real metrics land.

  const metrics = (e.metrics ?? {}) as Record<string, unknown>;

  if (e.layer === 'earthquakes') {
    const mag = Number(metrics.magnitude ?? 0);
    const magSignal = clamp01((mag - 3.5) / 4.5); // 3.5->0, 8.0->1
    const tsunamiBoost = Boolean(metrics.tsunami) ? 0.15 : 0;
    return clamp01(magSignal + tsunamiBoost);
  }

  if (e.layer === 'airspace') {
    const count = Number(metrics.aircraftCount ?? 0);
    // log scale: 10->~0.5, 100->~1
    const sig = clamp01(Math.log10(Math.max(1, count)) / 2);
    return sig;
  }

  if (e.layer === 'volcanoes') return 0.75;
  if (e.layer === 'conflicts') return 0.8;
  if (e.layer === 'floods') return 0.7;
  if (e.layer === 'storms') return 0.65;
  if (e.layer === 'wildfires') return 0.6;

  return 0.5;
}

function recencySignal(isoTime: string, nowMs: number): number {
  // Output: 0..1 (newer is higher), deterministic given nowMs.
  const t = Date.parse(isoTime);
  if (!Number.isFinite(t)) return 0;
  const ageMs = nowMs - t;
  return clamp01(1 - ageMs / RECENCY_WINDOW_MS);
}

function populationExposureSignal(_e: Omit<CrisisEvent, 'severityScore' | 'severityLabel'>): number {
  // Placeholder: deterministic constant until we integrate real population rasters.
  return 0.6;
}

function infrastructureRiskSignal(_e: Omit<CrisisEvent, 'severityScore' | 'severityLabel'>): number {
  // Placeholder: deterministic constant until we integrate roads/ports/power datasets.
  return 0.5;
}

export function getSeverity(
  e: Omit<CrisisEvent, 'severityScore' | 'severityLabel'>,
  opts?: { nowMs?: number }
): Severity {
  // Contract: deterministic scoring.
  // - Pure w.r.t event + opts.nowMs
  // - Returns score 0..100 and label buckets
  const nowMs = opts?.nowMs ?? Date.now();

  const event = eventSeveritySignal(e) * WEIGHTS.event;
  const recency = recencySignal(e.time, nowMs) * WEIGHTS.recency;
  const news = stableTextNewsSignal(e) * WEIGHTS.news;
  const population = populationExposureSignal(e) * WEIGHTS.population;
  const infrastructure = infrastructureRiskSignal(e) * WEIGHTS.infrastructure;

  const score = clamp(event + recency + news + population + infrastructure, 0, 100);
  return {
    severityScore: score,
    severityLabel: labelFromScore(score)
  };
}

// Back-compat: existing callers may still use scoreEvent().
export function scoreEvent(e: Omit<CrisisEvent, 'severityScore' | 'severityLabel'>): number {
  return getSeverity(e).severityScore;
}
