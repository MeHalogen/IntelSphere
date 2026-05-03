/**
 * Intelligence Module Tests
 * 
 * Comprehensive test suite for all intelligence analysis modules
 */

import { describe, it, expect } from 'vitest';
import type { CrisisEvent } from '../_lib/types';
import { detectCorrelations } from './eventCorrelation';
import { detectHotspots } from './hotspots';
import { detectTrends } from './trends';
import { analyzeTimelines } from './timeline';
import { calculateGlobalRisk } from './globalRisk';
import { detectPredictiveSignals } from './predictiveSignals';

// Mock event data
function createMockEvent(overrides: Partial<CrisisEvent> = {}): CrisisEvent {
  return {
    id: Math.random().toString(36),
    source: 'test',
    layer: 'earthquakes',
    title: 'Test Event',
    time: new Date().toISOString(),
    lat: 35.0,
    lon: 139.0,
    severityScore: 50,
    severityLabel: 'medium',
    confidenceScore: 0.80, // Default medium-high confidence for tests
    ...overrides
  };
}

describe('Event Correlation Engine', () => {
  it('should detect correlation when 3+ event types occur together', () => {
    const events: CrisisEvent[] = [
      createMockEvent({ layer: 'earthquakes', lat: 35.0, lon: 139.0 }),
      createMockEvent({ layer: 'floods', lat: 35.1, lon: 139.1 }),
      createMockEvent({ layer: 'storms', lat: 35.2, lon: 139.2 }),
    ];

    const correlations = detectCorrelations(events);
    expect(correlations.length).toBeGreaterThan(0);
    expect(correlations[0].eventTypes.length).toBeGreaterThanOrEqual(3);
  });

  it('should not detect correlation with only 2 event types', () => {
    const events: CrisisEvent[] = [
      createMockEvent({ layer: 'earthquakes', lat: 35.0, lon: 139.0 }),
      createMockEvent({ layer: 'earthquakes', lat: 35.1, lon: 139.1 }),
      createMockEvent({ layer: 'floods', lat: 35.2, lon: 139.2 }),
    ];

    const correlations = detectCorrelations(events);
    expect(correlations.length).toBe(0);
  });

  it('should calculate cluster severity correctly', () => {
    const events: CrisisEvent[] = [
      createMockEvent({ layer: 'earthquakes', lat: 35.0, lon: 139.0, severityScore: 80 }),
      createMockEvent({ layer: 'floods', lat: 35.1, lon: 139.1, severityScore: 70 }),
      createMockEvent({ layer: 'storms', lat: 35.2, lon: 139.2, severityScore: 60 }),
    ];

    const correlations = detectCorrelations(events);
    expect(correlations[0].severityScore).toBeGreaterThan(0);
    expect(correlations[0].severityScore).toBeLessThanOrEqual(100);
  });
});

describe('Hotspot Detection', () => {
  it('should identify hotspots with sufficient events', () => {
    const events: CrisisEvent[] = [
      createMockEvent({ lat: 35.0, lon: 139.0, severityScore: 80 }),
      createMockEvent({ lat: 35.5, lon: 139.5, severityScore: 75 }),
      createMockEvent({ lat: 36.0, lon: 140.0, severityScore: 70 }),
    ];

    const hotspots = detectHotspots(events);
    expect(hotspots.length).toBeGreaterThan(0);
  });

  it('should calculate risk scores between 0-100', () => {
    const events: CrisisEvent[] = [
      createMockEvent({ lat: 35.0, lon: 139.0, severityScore: 90 }),
      createMockEvent({ lat: 35.5, lon: 139.5, severityScore: 85 }),
    ];

    const hotspots = detectHotspots(events);
    hotspots.forEach(h => {
      expect(h.riskScore).toBeGreaterThanOrEqual(0);
      expect(h.riskScore).toBeLessThanOrEqual(100);
    });
  });

  it('should track recent activity correctly', () => {
    const nowMs = Date.now();
    const recentTime = new Date(nowMs - 3600000).toISOString(); // 1h ago
    const oldTime = new Date(nowMs - 48 * 3600000).toISOString(); // 2d ago

    const events: CrisisEvent[] = [
      createMockEvent({ lat: 35.0, lon: 139.0, time: recentTime }),
      createMockEvent({ lat: 35.5, lon: 139.5, time: oldTime }),
    ];

    const hotspots = detectHotspots(events, { nowMs });
    expect(hotspots[0].recentActivity).toBe(1);
  });
});

describe('Trend Detection', () => {
  it('should detect trending keywords with spike', () => {
    const nowMs = Date.now();
    const recentTime = new Date(nowMs - 3600000).toISOString();

    const events: CrisisEvent[] = [
      createMockEvent({ title: 'Earthquake hits region', time: recentTime }),
      createMockEvent({ title: 'Earthquake aftershock detected', time: recentTime }),
      createMockEvent({ title: 'Earthquake magnitude 6.5', time: recentTime }),
    ];

    const trends = detectTrends(events, { nowMs });
    const earthquakeTrend = trends.find(t => t.keyword === 'earthquake');
    expect(earthquakeTrend).toBeDefined();
    if (earthquakeTrend) {
      expect(earthquakeTrend.spike).toBeGreaterThan(1.0);
    }
  });

  it('should filter stopwords correctly', () => {
    const events: CrisisEvent[] = [
      createMockEvent({ title: 'The major alert for the region' }),
    ];

    const trends = detectTrends(events);
    const stopwordTrends = trends.filter(t => 
      ['the', 'for', 'major', 'alert'].includes(t.keyword)
    );
    expect(stopwordTrends.length).toBe(0);
  });

  it('should assign confidence levels appropriately', () => {
    const trends = detectTrends([
      createMockEvent({ title: 'earthquake' }),
      createMockEvent({ title: 'earthquake' }),
      createMockEvent({ title: 'earthquake' }),
    ]);

    trends.forEach(t => {
      expect(['low', 'medium', 'high']).toContain(t.confidence);
    });
  });
});

describe('Timeline Analysis', () => {
  it('should detect escalation patterns', () => {
    const nowMs = Date.now();
    const times = [
      new Date(nowMs - 7200000).toISOString(), // 2h ago
      new Date(nowMs - 3600000).toISOString(), // 1h ago
      new Date(nowMs - 1800000).toISOString(), // 30m ago
    ];

    const events: CrisisEvent[] = [
      createMockEvent({ lat: 35.0, lon: 139.0, time: times[0], severityScore: 40 }),
      createMockEvent({ lat: 35.1, lon: 139.1, time: times[1], severityScore: 60 }),
      createMockEvent({ lat: 35.2, lon: 139.2, time: times[2], severityScore: 80 }),
    ];

    const timelines = analyzeTimelines(events, { nowMs });
    expect(timelines.length).toBeGreaterThan(0);
    expect(timelines[0].severityTrend).toBe('increasing');
  });

  it('should calculate activity acceleration', () => {
    const events: CrisisEvent[] = [
      createMockEvent({ lat: 35.0, lon: 139.0 }),
      createMockEvent({ lat: 35.1, lon: 139.1 }),
      createMockEvent({ lat: 35.2, lon: 139.2 }),
      createMockEvent({ lat: 35.3, lon: 139.3 }),
    ];

    const timelines = analyzeTimelines(events);
    expect(timelines[0].activityAcceleration).toBeDefined();
  });
});

describe('Global Risk Score', () => {
  it('should calculate risk score between 0-100', () => {
    const events: CrisisEvent[] = [
      createMockEvent({ severityScore: 80 }),
      createMockEvent({ severityScore: 70 }),
      createMockEvent({ severityScore: 60 }),
    ];

    const risk = calculateGlobalRisk(events);
    expect(risk.globalRiskScore).toBeGreaterThanOrEqual(0);
    expect(risk.globalRiskScore).toBeLessThanOrEqual(100);
  });

  it('should assign correct risk levels', () => {
    const lowRiskEvents: CrisisEvent[] = [
      createMockEvent({ severityScore: 20 }),
    ];
    const highRiskEvents: CrisisEvent[] = [
      ...Array(20).fill(null).map(() => createMockEvent({ severityScore: 90 })),
    ];

    const lowRisk = calculateGlobalRisk(lowRiskEvents);
    const highRisk = calculateGlobalRisk(highRiskEvents);

    expect(['low', 'elevated']).toContain(lowRisk.level);
    expect(['high', 'critical']).toContain(highRisk.level);
  });

  it('should include all component metrics', () => {
    const events: CrisisEvent[] = [
      createMockEvent({ severityScore: 80 }),
      createMockEvent({ severityScore: 70 }),
    ];

    const risk = calculateGlobalRisk(events);
    expect(risk.components.activeCrises).toBe(2);
    expect(risk.components.averageSeverity).toBeGreaterThan(0);
  });
});

describe('Predictive Signals', () => {
  it('should detect earthquake swarms', () => {
    const nowMs = Date.now();
    const recentTime = new Date(nowMs - 1800000).toISOString(); // 30m ago

    const events: CrisisEvent[] = Array(6).fill(null).map(() =>
      createMockEvent({ 
        layer: 'earthquakes',
        lat: 35.0, 
        lon: 139.0, 
        time: recentTime 
      })
    );

    const signals = detectPredictiveSignals(events, { nowMs });
    const swarmSignal = signals.find(s => s.signalType === 'swarm');
    expect(swarmSignal).toBeDefined();
  });

  it('should detect escalation signals', () => {
    const nowMs = Date.now();
    const times = Array(6).fill(null).map((_, i) => 
      new Date(nowMs - (6 - i) * 3600000).toISOString()
    );

    const events: CrisisEvent[] = times.map((time, i) =>
      createMockEvent({ 
        lat: 35.0, 
        lon: 139.0, 
        time, 
        severityScore: 30 + i * 10 
      })
    );

    const signals = detectPredictiveSignals(events, { nowMs });
    const escalationSignal = signals.find(s => s.signalType === 'escalation');
    expect(escalationSignal).toBeDefined();
  });

  it('should detect cascade patterns', () => {
    const nowMs = Date.now();
    const recentTime = new Date(nowMs - 3600000).toISOString();

    const events: CrisisEvent[] = [
      createMockEvent({ layer: 'earthquakes', lat: 35.0, lon: 139.0, time: recentTime }),
      createMockEvent({ layer: 'floods', lat: 35.1, lon: 139.1, time: recentTime }),
      createMockEvent({ layer: 'storms', lat: 35.2, lon: 139.2, time: recentTime }),
    ];

    const signals = detectPredictiveSignals(events, { nowMs });
    const cascadeSignal = signals.find(s => s.signalType === 'cascade');
    expect(cascadeSignal).toBeDefined();
  });

  it('should assign appropriate confidence scores', () => {
    const events: CrisisEvent[] = [
      createMockEvent({ severityScore: 80 }),
      createMockEvent({ severityScore: 70 }),
    ];

    const signals = detectPredictiveSignals(events);
    signals.forEach(s => {
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(100);
    });
  });
});

describe('Integration Tests', () => {
  it('should handle empty event array gracefully', () => {
    const emptyEvents: CrisisEvent[] = [];

    expect(() => detectCorrelations(emptyEvents)).not.toThrow();
    expect(() => detectHotspots(emptyEvents)).not.toThrow();
    expect(() => detectTrends(emptyEvents)).not.toThrow();
    expect(() => analyzeTimelines(emptyEvents)).not.toThrow();
    expect(() => calculateGlobalRisk(emptyEvents)).not.toThrow();
    expect(() => detectPredictiveSignals(emptyEvents)).not.toThrow();
  });

  it('should handle large event datasets efficiently', () => {
    const largeDataset: CrisisEvent[] = Array(1000).fill(null).map((_, i) =>
      createMockEvent({ 
        lat: 30 + (i % 20), 
        lon: 100 + (i % 20),
        severityScore: 40 + (i % 60)
      })
    );

    const start = performance.now();
    detectCorrelations(largeDataset);
    detectHotspots(largeDataset);
    detectTrends(largeDataset);
    const elapsed = performance.now() - start;

    // Should process 1000 events in < 1 second
    expect(elapsed).toBeLessThan(1000);
  });
});
