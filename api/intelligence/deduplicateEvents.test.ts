import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  calculateTimeDifference,
  areDuplicates,
  mergeEvents,
  deduplicateEvents,
  getDeduplicationStats,
  findDuplicateClusters,
} from './deduplicateEvents';
import type { CrisisEvent } from '../_lib/types';

/**
 * Tests for Event Deduplication Module
 * 
 * Validates:
 * - Distance calculation (Haversine formula)
 * - Time difference calculation
 * - Duplicate detection criteria
 * - Event merging strategy
 * - Deduplication algorithm
 * - Statistics reporting
 * - Duplicate cluster detection
 */

describe('Event Deduplication', () => {
  // Helper to create test events
  const createEvent = (
    id: string,
    lat: number,
    lon: number,
    time: string,
    layer: string,
    severity: number,
    source: string = 'test',
    confidence: number = 0.8
  ): CrisisEvent => ({
    id,
    source,
    layer: layer as any,
    title: `Test ${layer} Event`,
    description: `Test event from ${source}`,
    time,
    lat,
    lon,
    severityScore: severity,
    severityLabel: severity > 0.7 ? 'high' : 'medium',
    confidenceScore: confidence,
    metrics: { magnitude: 6.0 },
    links: {
      url: `https://${source}.example.com/${id}`,
      news: `https://${source}.example.com/news/${id}`,
    },
  });

  describe('Distance Calculation', () => {
    it('should calculate zero distance for same location', () => {
      const distance = calculateDistance(40.7128, -74.0060, 40.7128, -74.0060);
      expect(distance).toBeCloseTo(0, 1);
    });

    it('should calculate correct distance for NYC to LA (~3936 km)', () => {
      const nyc = { lat: 40.7128, lon: -74.0060 };
      const la = { lat: 34.0522, lon: -118.2437 };
      const distance = calculateDistance(nyc.lat, nyc.lon, la.lat, la.lon);
      
      // Should be approximately 3936 km
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });

    it('should calculate small distances accurately', () => {
      // Two points 50km apart (approximately)
      const lat1 = 40.0;
      const lon1 = -74.0;
      const lat2 = 40.45; // ~50km north
      const lon2 = -74.0;
      
      const distance = calculateDistance(lat1, lon1, lat2, lon2);
      expect(distance).toBeGreaterThan(45);
      expect(distance).toBeLessThan(55);
    });

    it('should handle antipodal points (opposite sides of Earth)', () => {
      const distance = calculateDistance(0, 0, 0, 180);
      
      // Half the Earth's circumference (~20,000 km)
      expect(distance).toBeGreaterThan(19000);
      expect(distance).toBeLessThan(21000);
    });
  });

  describe('Time Difference Calculation', () => {
    it('should calculate zero difference for same time', () => {
      const time = '2026-03-07T10:00:00.000Z';
      const diff = calculateTimeDifference(time, time);
      expect(diff).toBe(0);
    });

    it('should calculate 1 hour difference', () => {
      const time1 = '2026-03-07T10:00:00.000Z';
      const time2 = '2026-03-07T11:00:00.000Z';
      const diff = calculateTimeDifference(time1, time2);
      expect(diff).toBeCloseTo(1, 2);
    });

    it('should calculate 6 hour difference', () => {
      const time1 = '2026-03-07T10:00:00.000Z';
      const time2 = '2026-03-07T16:00:00.000Z';
      const diff = calculateTimeDifference(time1, time2);
      expect(diff).toBeCloseTo(6, 2);
    });

    it('should handle absolute difference (order-independent)', () => {
      const time1 = '2026-03-07T10:00:00.000Z';
      const time2 = '2026-03-07T08:00:00.000Z';
      const diff = calculateTimeDifference(time1, time2);
      expect(diff).toBeCloseTo(2, 2);
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicates within distance and time thresholds', () => {
      const event1 = createEvent(
        'usgs-1',
        40.0,
        -74.0,
        '2026-03-07T10:00:00.000Z',
        'earthquakes',
        0.8,
        'usgs'
      );
      const event2 = createEvent(
        'nasa-1',
        40.04, // ~4.5 km away
        -74.0,
        '2026-03-07T10:30:00.000Z', // 30 min later
        'earthquakes',
        0.75,
        'nasa'
      );

      expect(areDuplicates(event1, event2)).toBe(true);
    });

    it('should reject duplicates with different layer types', () => {
      const event1 = createEvent(
        'usgs-1',
        40.0,
        -74.0,
        '2026-03-07T10:00:00.000Z',
        'earthquakes',
        0.8
      );
      const event2 = createEvent(
        'nasa-1',
        40.0,
        -74.0,
        '2026-03-07T10:00:00.000Z',
        'floods',
        0.8
      );

      expect(areDuplicates(event1, event2)).toBe(false);
    });

    it('should reject duplicates beyond distance threshold', () => {
      const event1 = createEvent(
        'usgs-1',
        40.0,
        -74.0,
        '2026-03-07T10:00:00.000Z',
        'earthquakes',
        0.8
      );
      const event2 = createEvent(
        'nasa-1',
        40.95, // ~106 km away
        -74.0,
        '2026-03-07T10:00:00.000Z',
        'earthquakes',
        0.8
      );

      expect(areDuplicates(event1, event2, 100, 6)).toBe(false);
    });

    it('should reject duplicates beyond time threshold', () => {
      const event1 = createEvent(
        'usgs-1',
        40.0,
        -74.0,
        '2026-03-07T10:00:00.000Z',
        'earthquakes',
        0.8
      );
      const event2 = createEvent(
        'nasa-1',
        40.0,
        -74.0,
        '2026-03-07T17:00:00.000Z', // 7 hours later
        'earthquakes',
        0.8
      );

      expect(areDuplicates(event1, event2, 100, 6)).toBe(false);
    });

    it('should accept duplicates exactly at thresholds', () => {
      const event1 = createEvent(
        'usgs-1',
        40.0,
        -74.0,
        '2026-03-07T10:00:00.000Z',
        'earthquakes',
        0.8
      );
      const event2 = createEvent(
        'nasa-1',
        40.89, // ~99 km away
        -74.0,
        '2026-03-07T15:59:00.000Z', // 5h 59m later
        'earthquakes',
        0.8
      );

      expect(areDuplicates(event1, event2, 100, 6)).toBe(true);
    });
  });

  describe('Event Merging', () => {
    it('should keep event with higher severity as primary', () => {
      const event1 = createEvent(
        'usgs-1',
        40.0,
        -74.0,
        '2026-03-07T10:00:00.000Z',
        'earthquakes',
        0.8,
        'usgs'
      );
      const event2 = createEvent(
        'nasa-1',
        40.04,
        -74.0,
        '2026-03-07T10:30:00.000Z',
        'earthquakes',
        0.75,
        'nasa'
      );

      const merged = mergeEvents(event1, event2);

      expect(merged.severityScore).toBe(0.8);
      expect(merged.title).toBe('Test earthquakes Event');
      expect(merged.description).toContain('usgs');
      expect(merged.description).toContain('nasa');
    });

    it('should combine sources for traceability', () => {
      const event1 = createEvent(
        'usgs-1',
        40.0,
        -74.0,
        '2026-03-07T10:00:00.000Z',
        'earthquakes',
        0.8,
        'usgs'
      );
      const event2 = createEvent(
        'nasa-1',
        40.04,
        -74.0,
        '2026-03-07T10:30:00.000Z',
        'earthquakes',
        0.75,
        'nasa'
      );

      const merged = mergeEvents(event1, event2);

      expect(merged.description).toContain('[Sources: usgs, nasa]');
    });

    it('should create combined ID for traceability', () => {
      const event1 = createEvent(
        'usgs-1',
        40.0,
        -74.0,
        '2026-03-07T10:00:00.000Z',
        'earthquakes',
        0.8,
        'usgs'
      );
      const event2 = createEvent(
        'nasa-1',
        40.04,
        -74.0,
        '2026-03-07T10:30:00.000Z',
        'earthquakes',
        0.75,
        'nasa'
      );

      const merged = mergeEvents(event1, event2);

      expect(merged.id).toContain('usgs-1');
      expect(merged.id).toContain('nasa-1');
      expect(merged.id).toContain('+');
    });

    it('should merge metrics, keeping higher values', () => {
      const event1 = createEvent(
        'usgs-1',
        40.0,
        -74.0,
        '2026-03-07T10:00:00.000Z',
        'earthquakes',
        0.8,
        'usgs'
      );
      event1.metrics = { magnitude: 6.5, depth: 10 };

      const event2 = createEvent(
        'nasa-1',
        40.04,
        -74.0,
        '2026-03-07T10:30:00.000Z',
        'earthquakes',
        0.75,
        'nasa'
      );
      event2.metrics = { magnitude: 6.3, population: 1000000 };

      const merged = mergeEvents(event1, event2);

      expect(merged.metrics?.magnitude).toBe(6.5); // Higher value
      expect(merged.metrics?.depth).toBe(10); // From event1
      expect(merged.metrics?.population).toBe(1000000); // From event2
    });

    it('should use more recent timestamp if severity is close', () => {
      const event1 = createEvent(
        'usgs-1',
        40.0,
        -74.0,
        '2026-03-07T10:00:00.000Z',
        'earthquakes',
        0.80,
        'usgs',
        0.95
      );
      const event2 = createEvent(
        'nasa-1',
        40.04,
        -74.0,
        '2026-03-07T10:30:00.000Z',
        'earthquakes',
        0.79, // Very close severity
        'nasa',
        0.90
      );

      const merged = mergeEvents(event1, event2);

      // Should use more recent time since severity difference < 0.05
      expect(merged.time).toBe('2026-03-07T10:30:00.000Z');
    });

    it('should boost confidence when merging multiple sources', () => {
      const event1 = createEvent(
        'usgs-1',
        40.0,
        -74.0,
        '2026-03-07T10:00:00.000Z',
        'earthquakes',
        0.80,
        'usgs',
        0.95
      );
      const event2 = createEvent(
        'nasa-1',
        40.04,
        -74.0,
        '2026-03-07T10:30:00.000Z',
        'earthquakes',
        0.75,
        'nasa',
        0.90
      );

      const merged = mergeEvents(event1, event2);

      // Base confidence 0.95 + 5% boost for 2nd source = 1.0 (capped)
      expect(merged.confidenceScore).toBeCloseTo(1.0, 2);
    });
  });

  describe('Deduplication Algorithm', () => {
    it('should return empty array for empty input', () => {
      const result = deduplicateEvents([]);
      expect(result).toEqual([]);
    });

    it('should return same array if no duplicates', () => {
      const events = [
        createEvent('1', 40.0, -74.0, '2026-03-07T10:00:00.000Z', 'earthquakes', 0.8),
        createEvent('2', 35.0, -118.0, '2026-03-07T10:00:00.000Z', 'earthquakes', 0.7),
        createEvent('3', 51.5, -0.1, '2026-03-07T10:00:00.000Z', 'floods', 0.6),
      ];

      const result = deduplicateEvents(events);
      expect(result).toHaveLength(3);
    });

    it('should remove exact duplicates', () => {
      const events = [
        createEvent('usgs-1', 40.0, -74.0, '2026-03-07T10:00:00.000Z', 'earthquakes', 0.8, 'usgs'),
        createEvent('nasa-1', 40.01, -74.0, '2026-03-07T10:01:00.000Z', 'earthquakes', 0.75, 'nasa'),
      ];

      const result = deduplicateEvents(events);
      expect(result).toHaveLength(1);
      expect(result[0].severityScore).toBe(0.8); // Kept higher severity
    });

    it('should handle multiple duplicate pairs', () => {
      const events = [
        createEvent('usgs-1', 40.0, -74.0, '2026-03-07T10:00:00.000Z', 'earthquakes', 0.8, 'usgs'),
        createEvent('nasa-1', 40.01, -74.0, '2026-03-07T10:01:00.000Z', 'earthquakes', 0.75, 'nasa'),
        createEvent('usgs-2', 35.0, -118.0, '2026-03-07T11:00:00.000Z', 'earthquakes', 0.7, 'usgs'),
        createEvent('gdacs-2', 35.02, -118.0, '2026-03-07T11:05:00.000Z', 'earthquakes', 0.72, 'gdacs'),
      ];

      const result = deduplicateEvents(events);
      expect(result).toHaveLength(2); // Two unique earthquakes
    });

    it('should handle triple duplicates (3 sources reporting same event)', () => {
      const events = [
        createEvent('usgs-1', 40.0, -74.0, '2026-03-07T10:00:00.000Z', 'earthquakes', 0.8, 'usgs'),
        createEvent('nasa-1', 40.01, -74.0, '2026-03-07T10:01:00.000Z', 'earthquakes', 0.75, 'nasa'),
        createEvent('gdacs-1', 40.02, -74.0, '2026-03-07T10:02:00.000Z', 'earthquakes', 0.78, 'gdacs'),
      ];

      const result = deduplicateEvents(events);
      expect(result).toHaveLength(1);
      expect(result[0].severityScore).toBe(0.8); // Highest severity
      expect(result[0].description).toContain('usgs');
      expect(result[0].description).toContain('nasa');
      expect(result[0].description).toContain('gdacs');
    });

    it('should preserve non-duplicates alongside duplicates', () => {
      const events = [
        createEvent('usgs-1', 40.0, -74.0, '2026-03-07T10:00:00.000Z', 'earthquakes', 0.8, 'usgs'),
        createEvent('nasa-1', 40.01, -74.0, '2026-03-07T10:01:00.000Z', 'earthquakes', 0.75, 'nasa'),
        createEvent('unique-1', 35.0, -118.0, '2026-03-07T11:00:00.000Z', 'floods', 0.7),
      ];

      const result = deduplicateEvents(events);
      expect(result).toHaveLength(2); // 1 earthquake + 1 flood
    });

    it('should handle custom thresholds', () => {
      const events = [
        createEvent('1', 40.0, -74.0, '2026-03-07T10:00:00.000Z', 'earthquakes', 0.8),
        createEvent('2', 40.2, -74.0, '2026-03-07T12:00:00.000Z', 'earthquakes', 0.75), // ~22km, 2h
      ];

      // Tight thresholds: 10km, 1h
      const resultTight = deduplicateEvents(events, 10, 1);
      expect(resultTight).toHaveLength(2); // Not duplicates (distance>10km, time>1h)

      // Loose thresholds: 200km, 24h
      const resultLoose = deduplicateEvents(events, 200, 24);
      expect(resultLoose).toHaveLength(1); // Duplicates (within both thresholds)
    });
  });

  describe('Deduplication Statistics', () => {
    it('should calculate correct statistics', () => {
      const original = [
        createEvent('1', 40.0, -74.0, '2026-03-07T10:00:00.000Z', 'earthquakes', 0.8),
        createEvent('2', 40.01, -74.0, '2026-03-07T10:01:00.000Z', 'earthquakes', 0.75),
        createEvent('3', 35.0, -118.0, '2026-03-07T11:00:00.000Z', 'floods', 0.7),
      ];

      const deduplicated = deduplicateEvents(original);
      const stats = getDeduplicationStats(original, deduplicated);

      expect(stats.originalCount).toBe(3);
      expect(stats.deduplicatedCount).toBe(2);
      expect(stats.duplicatesRemoved).toBe(1);
      expect(stats.deduplicationRate).toBeCloseTo(1 / 3, 2);
    });

    it('should calculate per-layer statistics', () => {
      const original = [
        createEvent('1', 40.0, -74.0, '2026-03-07T10:00:00.000Z', 'earthquakes', 0.8),
        createEvent('2', 40.01, -74.0, '2026-03-07T10:01:00.000Z', 'earthquakes', 0.75),
        createEvent('3', 35.0, -118.0, '2026-03-07T11:00:00.000Z', 'earthquakes', 0.7),
        createEvent('4', 51.5, -0.1, '2026-03-07T12:00:00.000Z', 'floods', 0.6),
      ];

      const deduplicated = deduplicateEvents(original);
      const stats = getDeduplicationStats(original, deduplicated);

      expect(stats.byLayer.earthquakes.original).toBe(3);
      expect(stats.byLayer.earthquakes.deduplicated).toBe(2);
      expect(stats.byLayer.earthquakes.removed).toBe(1);

      expect(stats.byLayer.floods.original).toBe(1);
      expect(stats.byLayer.floods.deduplicated).toBe(1);
      expect(stats.byLayer.floods.removed).toBe(0);
    });
  });

  describe('Duplicate Cluster Detection', () => {
    it('should find clusters with 3+ sources', () => {
      const events = [
        createEvent('usgs-1', 40.0, -74.0, '2026-03-07T10:00:00.000Z', 'earthquakes', 0.8, 'usgs'),
        createEvent('nasa-1', 40.01, -74.0, '2026-03-07T10:01:00.000Z', 'earthquakes', 0.75, 'nasa'),
        createEvent('gdacs-1', 40.02, -74.0, '2026-03-07T10:02:00.000Z', 'earthquakes', 0.78, 'gdacs'),
      ];

      const clusters = findDuplicateClusters(events, 100, 6, 3);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].sources).toContain('usgs');
      expect(clusters[0].sources).toContain('nasa');
      expect(clusters[0].sources).toContain('gdacs');
      expect(clusters[0].duplicates).toHaveLength(2);
    });

    it('should not create clusters below minimum size', () => {
      const events = [
        createEvent('usgs-1', 40.0, -74.0, '2026-03-07T10:00:00.000Z', 'earthquakes', 0.8, 'usgs'),
        createEvent('nasa-1', 40.01, -74.0, '2026-03-07T10:01:00.000Z', 'earthquakes', 0.75, 'nasa'),
      ];

      const clusters = findDuplicateClusters(events, 100, 6, 3);
      expect(clusters).toHaveLength(0);
    });

    it('should calculate confidence based on source count', () => {
      const events = [
        createEvent('usgs-1', 40.0, -74.0, '2026-03-07T10:00:00.000Z', 'earthquakes', 0.8, 'usgs'),
        createEvent('nasa-1', 40.01, -74.0, '2026-03-07T10:01:00.000Z', 'earthquakes', 0.75, 'nasa'),
        createEvent('gdacs-1', 40.02, -74.0, '2026-03-07T10:02:00.000Z', 'earthquakes', 0.78, 'gdacs'),
      ];

      const clusters = findDuplicateClusters(events, 100, 6, 3);
      expect(clusters[0].confidence).toBeCloseTo(3 / 5, 1); // 3 sources / 5 = 0.6
    });

    it('should use highest severity event as representative', () => {
      const events = [
        createEvent('usgs-1', 40.0, -74.0, '2026-03-07T10:00:00.000Z', 'earthquakes', 0.8, 'usgs'),
        createEvent('nasa-1', 40.01, -74.0, '2026-03-07T10:01:00.000Z', 'earthquakes', 0.85, 'nasa'),
        createEvent('gdacs-1', 40.02, -74.0, '2026-03-07T10:02:00.000Z', 'earthquakes', 0.78, 'gdacs'),
      ];

      const clusters = findDuplicateClusters(events, 100, 6, 3);
      expect(clusters[0].representative.source).toBe('nasa');
      expect(clusters[0].representative.severityScore).toBe(0.85);
    });
  });

  describe('Performance', () => {
    it('should handle 1000 events in <500ms', () => {
      const events: CrisisEvent[] = [];
      for (let i = 0; i < 1000; i++) {
        events.push(
          createEvent(
            `event-${i}`,
            40 + Math.random() * 10,
            -74 + Math.random() * 10,
            '2026-03-07T10:00:00.000Z',
            'earthquakes',
            Math.random()
          )
        );
      }

      const start = Date.now();
      const result = deduplicateEvents(events);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(500);
      expect(result.length).toBeLessThan(events.length); // Should find some duplicates
    });
  });
});
