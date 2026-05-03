import { describe, it, expect } from 'vitest';
import {
  getSourceConfidence,
  calculateConfidenceScore,
  inferDataQualityIndicators,
  getConfidenceLabel,
  filterByConfidence,
  sortByConfidence,
  calculateAverageConfidence,
  getConfidenceStats,
  boostConfidenceForMultiSource,
  SOURCE_CONFIDENCE,
} from '../_lib/confidence';
import type { CrisisEvent } from '../_lib/types';

/**
 * Tests for Signal Confidence Scoring Module
 * 
 * Validates:
 * - Source confidence tiers
 * - Data quality indicator inference
 * - Confidence score calculation
 * - Confidence boosting for multi-source events
 * - Filtering and sorting by confidence
 * - Statistics reporting
 */

describe('Signal Confidence Scoring', () => {
  const createTestEvent = (overrides?: Partial<CrisisEvent>): CrisisEvent => ({
    id: 'test-1',
    source: 'usgs',
    layer: 'earthquakes',
    title: 'Test Event',
    description: 'Test description',
    time: new Date().toISOString(),
    lat: 40.0,
    lon: -74.0,
    severityScore: 0.8,
    severityLabel: 'high',
    confidenceScore: 0.95,
    metrics: { magnitude: 6.5 },
    links: { url: 'https://example.com' },
    ...overrides,
  });

  describe('Source Confidence Tiers', () => {
    it('should assign highest confidence to government/scientific agencies', () => {
      expect(getSourceConfidence('usgs')).toBe(0.95);
      expect(getSourceConfidence('noaa')).toBe(0.95);
      expect(getSourceConfidence('jma')).toBe(0.95);
    });

    it('should assign high confidence to international organizations', () => {
      expect(getSourceConfidence('gdacs')).toBe(0.90);
      expect(getSourceConfidence('nasa')).toBe(0.90);
      expect(getSourceConfidence('esa')).toBe(0.90);
    });

    it('should assign medium-high confidence to specialized monitoring', () => {
      expect(getSourceConfidence('opensky')).toBe(0.80);
      expect(getSourceConfidence('firms')).toBe(0.85);
    });

    it('should assign medium confidence to humanitarian organizations', () => {
      expect(getSourceConfidence('acled')).toBe(0.75);
      expect(getSourceConfidence('reliefweb')).toBe(0.75);
    });

    it('should assign lower confidence to news sources', () => {
      expect(getSourceConfidence('reuters')).toBe(0.70);
      expect(getSourceConfidence('bbc')).toBe(0.68);
      expect(getSourceConfidence('cnn')).toBe(0.65);
    });

    it('should assign lowest confidence to social media', () => {
      expect(getSourceConfidence('twitter')).toBe(0.40);
      expect(getSourceConfidence('reddit')).toBe(0.35);
    });

    it('should use default confidence for unknown sources', () => {
      expect(getSourceConfidence('unknown')).toBe(0.50);
      expect(getSourceConfidence('random-source')).toBe(0.50);
    });

    it('should be case-insensitive', () => {
      expect(getSourceConfidence('USGS')).toBe(0.95);
      expect(getSourceConfidence('Usgs')).toBe(0.95);
      expect(getSourceConfidence('  NASA  ')).toBe(0.90);
    });
  });

  describe('Data Quality Indicators Inference', () => {
    it('should detect GPS coordinates', () => {
      const event = createTestEvent({ lat: 40.0, lon: -74.0 });
      const indicators = inferDataQualityIndicators(event);
      expect(indicators.hasGPS).toBe(true);
    });

    it('should detect invalid GPS coordinates', () => {
      const event = createTestEvent({ lat: NaN, lon: -74.0 });
      const indicators = inferDataQualityIndicators(event);
      expect(indicators.hasGPS).toBe(false);
    });

    it('should detect timestamp presence', () => {
      const event = createTestEvent({ time: new Date().toISOString() });
      const indicators = inferDataQualityIndicators(event);
      expect(indicators.hasTimestamp).toBe(true);
    });

    it('should detect metrics presence', () => {
      const event = createTestEvent({ metrics: { magnitude: 6.5, depth: 10 } });
      const indicators = inferDataQualityIndicators(event);
      expect(indicators.hasMetrics).toBe(true);
    });

    it('should detect satellite confirmation from links', () => {
      const event = createTestEvent({ links: { satellite: 'https://satellite.example.com' } });
      const indicators = inferDataQualityIndicators(event);
      expect(indicators.hasSatelliteConfirmation).toBe(true);
    });

    it('should detect satellite confirmation from NASA source', () => {
      const event = createTestEvent({ source: 'nasa' });
      const indicators = inferDataQualityIndicators(event);
      expect(indicators.hasSatelliteConfirmation).toBe(true);
    });

    it('should detect multiple sources from combined ID', () => {
      const event = createTestEvent({ id: 'usgs-123+nasa-456+gdacs-789' });
      const indicators = inferDataQualityIndicators(event);
      expect(indicators.hasMultipleSources).toBe(true);
    });

    it('should detect realtime data (<1 hour old)', () => {
      const event = createTestEvent({ time: new Date().toISOString() });
      const indicators = inferDataQualityIndicators(event);
      expect(indicators.isRealtime).toBe(true);
    });

    it('should detect non-realtime data (>1 hour old)', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const event = createTestEvent({ time: twoHoursAgo });
      const indicators = inferDataQualityIndicators(event);
      expect(indicators.isRealtime).toBe(false);
    });

    it('should detect official sources', () => {
      const event = createTestEvent({ source: 'usgs' });
      const indicators = inferDataQualityIndicators(event);
      expect(indicators.hasOfficialSource).toBe(true);
    });
  });

  describe('Confidence Score Calculation', () => {
    it('should calculate base confidence from source', () => {
      const event = { source: 'usgs', layer: 'earthquakes' as const };
      const confidence = calculateConfidenceScore(event);
      
      // 0.95 (source) * 1.0 (layer multiplier) = 0.95
      expect(confidence).toBeCloseTo(0.95, 2);
    });

    it('should apply layer-specific multipliers', () => {
      const earthquakeEvent = { source: 'usgs', layer: 'earthquakes' as const };
      const conflictEvent = { source: 'usgs', layer: 'conflicts' as const };
      
      const eqConfidence = calculateConfidenceScore(earthquakeEvent);
      const conflictConfidence = calculateConfidenceScore(conflictEvent);
      
      // Earthquakes have 1.0 multiplier, conflicts have 0.7 multiplier
      expect(eqConfidence).toBeGreaterThan(conflictConfidence);
    });

    it('should boost confidence for GPS coordinates', () => {
      // Use lower base source to avoid hitting cap
      const event = createTestEvent({ source: 'reuters', lat: 40.0, lon: -74.0 });
      const indicators = { ...inferDataQualityIndicators(event), hasGPS: true };
      const confidence = calculateConfidenceScore(event, indicators);
      
      const baseConfidence = calculateConfidenceScore(event, { ...indicators, hasGPS: false });
      expect(confidence).toBeGreaterThan(baseConfidence);
    });

    it('should boost confidence for realtime data', () => {
      const now = new Date().toISOString();
      const event = createTestEvent({ time: now });
      const indicators = { ...inferDataQualityIndicators(event), isRealtime: true };
      const confidence = calculateConfidenceScore(event, indicators);
      
      // Realtime data gets 8% boost
      expect(confidence).toBeGreaterThan(0.95); // Base 0.95 + boost
    });

    it('should boost confidence for satellite confirmation', () => {
      // Use lower base source to avoid hitting cap
      const event = createTestEvent({ source: 'reuters', links: { satellite: 'https://satellite.example.com' } });
      const indicators = { ...inferDataQualityIndicators(event), hasSatelliteConfirmation: true };
      const confidence = calculateConfidenceScore(event, indicators);
      
      const baseConfidence = calculateConfidenceScore(event, { ...indicators, hasSatelliteConfirmation: false });
      expect(confidence).toBeGreaterThan(baseConfidence);
    });

    it('should boost confidence for multiple sources', () => {
      // Use lower base source to avoid hitting cap
      const event = createTestEvent({ source: 'reuters', id: 'reuters-123+bbc-456' });
      const indicators = { ...inferDataQualityIndicators(event), hasMultipleSources: true };
      const confidence = calculateConfidenceScore(event, indicators);
      
      const baseConfidence = calculateConfidenceScore(event, { ...indicators, hasMultipleSources: false });
      // Multiple sources gets 15% boost
      expect(confidence).toBeGreaterThan(baseConfidence);
    });

    it('should cap confidence at 1.0', () => {
      const event = createTestEvent({ source: 'usgs' });
      const indicators = {
        hasGPS: true,
        hasTimestamp: true,
        hasMetrics: true,
        hasSatelliteConfirmation: true,
        hasMultipleSources: true,
        isRealtime: true,
        hasOfficialSource: true,
      };
      const confidence = calculateConfidenceScore(event, indicators);
      
      expect(confidence).toBeLessThanOrEqual(1.0);
    });

    it('should not go below 0.0', () => {
      const event = createTestEvent({ source: 'unknown', layer: 'conflicts' as const });
      const confidence = calculateConfidenceScore(event);
      
      expect(confidence).toBeGreaterThanOrEqual(0.0);
    });
  });

  describe('Confidence Labels', () => {
    it('should label very high confidence (≥0.9)', () => {
      expect(getConfidenceLabel(0.95)).toBe('very-high');
      expect(getConfidenceLabel(0.90)).toBe('very-high');
    });

    it('should label high confidence (0.75-0.89)', () => {
      expect(getConfidenceLabel(0.85)).toBe('high');
      expect(getConfidenceLabel(0.75)).toBe('high');
    });

    it('should label medium confidence (0.6-0.74)', () => {
      expect(getConfidenceLabel(0.70)).toBe('medium');
      expect(getConfidenceLabel(0.60)).toBe('medium');
    });

    it('should label low confidence (0.4-0.59)', () => {
      expect(getConfidenceLabel(0.50)).toBe('low');
      expect(getConfidenceLabel(0.40)).toBe('low');
    });

    it('should label very low confidence (<0.4)', () => {
      expect(getConfidenceLabel(0.35)).toBe('very-low');
      expect(getConfidenceLabel(0.20)).toBe('very-low');
    });
  });

  describe('Filtering and Sorting', () => {
    it('should filter events by minimum confidence', () => {
      const events = [
        createTestEvent({ id: '1', confidenceScore: 0.95 }),
        createTestEvent({ id: '2', confidenceScore: 0.80 }),
        createTestEvent({ id: '3', confidenceScore: 0.60 }),
        createTestEvent({ id: '4', confidenceScore: 0.40 }),
      ];

      const filtered = filterByConfidence(events, 0.70);
      expect(filtered).toHaveLength(2);
      expect(filtered.map(e => e.id)).toEqual(['1', '2']);
    });

    it('should sort events by confidence descending', () => {
      const events = [
        createTestEvent({ id: '1', confidenceScore: 0.60 }),
        createTestEvent({ id: '2', confidenceScore: 0.95 }),
        createTestEvent({ id: '3', confidenceScore: 0.80 }),
      ];

      const sorted = sortByConfidence(events);
      expect(sorted.map(e => e.id)).toEqual(['2', '3', '1']);
    });
  });

  describe('Statistics', () => {
    it('should calculate average confidence', () => {
      const events = [
        createTestEvent({ confidenceScore: 0.90 }),
        createTestEvent({ confidenceScore: 0.80 }),
        createTestEvent({ confidenceScore: 0.70 }),
      ];

      const avg = calculateAverageConfidence(events);
      expect(avg).toBeCloseTo(0.80, 2);
    });

    it('should return 0 for empty array', () => {
      expect(calculateAverageConfidence([])).toBe(0);
    });

    it('should calculate confidence distribution', () => {
      const events = [
        createTestEvent({ id: '1', confidenceScore: 0.95 }), // very-high
        createTestEvent({ id: '2', confidenceScore: 0.92 }), // very-high
        createTestEvent({ id: '3', confidenceScore: 0.85 }), // high
        createTestEvent({ id: '4', confidenceScore: 0.70 }), // medium
        createTestEvent({ id: '5', confidenceScore: 0.50 }), // low
        createTestEvent({ id: '6', confidenceScore: 0.35 }), // very-low
      ];

      const stats = getConfidenceStats(events);
      
      expect(stats.veryHigh).toBe(2);
      expect(stats.high).toBe(1);
      expect(stats.medium).toBe(1);
      expect(stats.low).toBe(1);
      expect(stats.veryLow).toBe(1);
      expect(stats.average).toBeCloseTo(0.71, 1);
    });

    it('should calculate per-source statistics', () => {
      const events = [
        createTestEvent({ source: 'usgs', confidenceScore: 0.95 }),
        createTestEvent({ source: 'usgs', confidenceScore: 0.93 }),
        createTestEvent({ source: 'nasa', confidenceScore: 0.90 }),
      ];

      const stats = getConfidenceStats(events);
      
      expect(stats.bySource['usgs'].count).toBe(2);
      expect(stats.bySource['usgs'].avgConfidence).toBeCloseTo(0.94, 2);
      expect(stats.bySource['nasa'].count).toBe(1);
      expect(stats.bySource['nasa'].avgConfidence).toBe(0.90);
    });
  });

  describe('Multi-Source Confidence Boost', () => {
    it('should boost confidence by 5% per additional source', () => {
      const baseConfidence = 0.90;
      
      const twoSources = boostConfidenceForMultiSource(baseConfidence, 2);
      expect(twoSources).toBeCloseTo(0.95, 2); // +5%
      
      const threeSources = boostConfidenceForMultiSource(baseConfidence, 3);
      expect(threeSources).toBeCloseTo(1.0, 2); // +10% (capped at 1.0)
    });

    it('should cap boost at +20% maximum', () => {
      const baseConfidence = 0.75;
      const sixSources = boostConfidenceForMultiSource(baseConfidence, 6); // Would be +25%
      
      expect(sixSources).toBeCloseTo(0.95, 2); // Capped at +20% = 0.95
    });

    it('should cap total confidence at 1.0', () => {
      const baseConfidence = 0.95;
      const threeSources = boostConfidenceForMultiSource(baseConfidence, 3); // Would be 1.05
      
      expect(threeSources).toBe(1.0);
    });
  });

  describe('Integration with Event Lifecycle', () => {
    it('should maintain high confidence for USGS earthquake with metrics', () => {
      const event: Partial<CrisisEvent> = {
        source: 'usgs',
        layer: 'earthquakes',
        lat: 40.0,
        lon: -74.0,
        time: new Date().toISOString(),
        metrics: { magnitude: 6.5, depth: 10 },
      };

      const indicators = inferDataQualityIndicators(event);
      const confidence = calculateConfidenceScore(event, indicators);
      
      // USGS (0.95) * earthquakes (1.0) + realtime boost + GPS boost + metrics boost
      expect(confidence).toBeGreaterThan(0.95);
      expect(getConfidenceLabel(confidence)).toBe('very-high');
    });

    it('should assign lower confidence to social media reports', () => {
      const event: Partial<CrisisEvent> = {
        source: 'twitter',
        layer: 'conflicts',
        lat: 40.0,
        lon: -74.0,
        time: new Date().toISOString(),
      };

      const indicators = inferDataQualityIndicators(event);
      const confidence = calculateConfidenceScore(event, indicators);
      
      // twitter (0.40) * conflicts (0.70) = 0.28
      expect(confidence).toBeLessThan(0.50);
      expect(getConfidenceLabel(confidence)).toMatch(/low/);
    });
  });
});
