import { describe, expect, it } from 'vitest';
import { trendingKeywords } from './trendingKeywords';
import type { CrisisEvent } from '../_lib/types';

describe('trendingKeywords', () => {
  it('detects spikes vs 24h baseline', () => {
    const nowMs = Date.UTC(2026, 2, 7, 0, 0, 0);

    const mk = (title: string, hoursAgo: number): CrisisEvent => ({
      id: `${title}:${hoursAgo}`,
      source: 't',
      layer: 'earthquakes',
      title,
      time: new Date(nowMs - hoursAgo * 3600_000).toISOString(),
      lat: 0,
      lon: 0,
      severityScore: 50,
      severityLabel: 'medium'
    });

    const events: CrisisEvent[] = [
      // baseline: earthquake appears a few times over 24h
      mk('Earthquake reported', 20),
      mk('Earthquake reported', 10),
      mk('Earthquake reported', 6),
      // recent spike: wildfire suddenly appears often
      mk('Wildfire expands rapidly', 1),
      mk('Wildfire expands rapidly', 0.75),
      mk('Wildfire expands rapidly', 0.5),
      mk('Wildfire expands rapidly', 0.25)
    ];

    const out = trendingKeywords(events, {
      nowMs,
      recentWindowMs: 2 * 3600_000,
      baselineWindowMs: 24 * 3600_000,
      limit: 5,
      minBaselineCount: 2
    });

    expect(out.length).toBeGreaterThan(0);
  const wf = out.find((x) => x.keyword === 'wildfire');
  expect(wf).toBeTruthy();
  expect((wf as any).spike).toBeGreaterThan(1.2);
  });
});
