import { describe, expect, it } from 'vitest';
import type { CrisisEvent } from './types';

// Unit-only: verify schema shape constraints.

describe('ingestion schema', () => {
  it('CrisisEvent supports required fields', () => {
    const e: CrisisEvent = {
      id: 'x',
      title: 't',
      time: new Date().toISOString(),
      lat: 1,
      lon: 2,
      layer: 'earthquakes',
      source: 'unit-test',
      severityScore: 0,
      severityLabel: 'low'
    };

    expect(e.id).toBe('x');
    expect(e.layer).toBe('earthquakes');
  });
});
