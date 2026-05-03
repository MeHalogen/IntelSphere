/**
 * PREDICTIVE SIGNALS
 * 
 * Detects early warning signals for potential escalation:
 * - Earthquake swarms (many events in short time)
 * - Cascading disasters (compound events)
 * - Rapid escalation (accelerating activity)
 * - Event convergence (multiple types converging)
 */

import type { CrisisEvent } from '../_lib/types';
import type { PredictiveSignal } from './types';

const GRID_SIZE = 2.0; // 2° grid (~220km)
const SHORT_WINDOW_MS = 2 * 3600 * 1000; // 2 hours
const SWARM_THRESHOLD = 5; // 5+ events
const ACCELERATION_THRESHOLD = 2.0; // 2x increase

function getGeoBin(lat: number, lon: number): string {
  const latBin = Math.floor(lat / GRID_SIZE);
  const lonBin = Math.floor(lon / GRID_SIZE);
  return `${latBin},${lonBin}`;
}

function getCentroid(events: CrisisEvent[]): { lat: number; lon: number } {
  if (events.length === 0) return { lat: 0, lon: 0 };
  const lat = events.reduce((sum, e) => sum + e.lat, 0) / events.length;
  const lon = events.reduce((sum, e) => sum + e.lon, 0) / events.length;
  return { lat, lon };
}

function getRegionName(lat: number, lon: number): string {
  return `${lat >= 0 ? 'N' : 'S'}${Math.abs(lat).toFixed(1)} ${lon >= 0 ? 'E' : 'W'}${Math.abs(lon).toFixed(1)}`;
}

/**
 * Detect earthquake swarms (rapid succession of seismic events)
 */
function detectSwarms(
  events: CrisisEvent[],
  nowMs: number
): PredictiveSignal[] {
  const signals: PredictiveSignal[] = [];
  const earthquakes = events.filter(e => e.layer === 'earthquakes');
  
  // Group by region
  const regions = new Map<string, CrisisEvent[]>();
  for (const eq of earthquakes) {
    const bin = getGeoBin(eq.lat, eq.lon);
    const regionEvents = regions.get(bin) ?? [];
    regionEvents.push(eq);
    regions.set(bin, regionEvents);
  }
  
  // Check each region for swarm activity
  for (const [bin, regionEvents] of regions.entries()) {
    const recentEvents = regionEvents.filter(e => {
      const eventTime = new Date(e.time).getTime();
      return (nowMs - eventTime) <= SHORT_WINDOW_MS;
    });
    
    if (recentEvents.length >= SWARM_THRESHOLD) {
      const centroid = getCentroid(recentEvents);
      const times = recentEvents.map(e => new Date(e.time).getTime());
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      const avgMag = recentEvents.reduce((sum, e) => {
        const mag = Number(e.metrics?.magnitude ?? 0);
        return sum + mag;
      }, 0) / recentEvents.length;
      
      signals.push({
        region: getRegionName(centroid.lat, centroid.lon),
        location: centroid,
        signalType: 'swarm',
        description: `Earthquake swarm detected: ${recentEvents.length} events in ${Math.round((maxTime - minTime) / 60000)} minutes (avg magnitude ${avgMag.toFixed(1)})`,
        confidence: Math.min(95, 60 + recentEvents.length * 5),
        triggerEvents: recentEvents.slice(0, 10),
        timeWindow: {
          start: new Date(minTime).toISOString(),
          end: new Date(maxTime).toISOString()
        },
        recommendedAction: 'Monitor for potential larger earthquake or volcanic activity. Prepare for aftershocks.'
      });
    }
  }
  
  return signals;
}

/**
 * Detect escalation (rapid increase in severity)
 */
function detectEscalation(
  events: CrisisEvent[],
  nowMs: number
): PredictiveSignal[] {
  const signals: PredictiveSignal[] = [];
  
  // Group by region
  const regions = new Map<string, CrisisEvent[]>();
  for (const event of events) {
    const bin = getGeoBin(event.lat, event.lon);
    const regionEvents = regions.get(bin) ?? [];
    regionEvents.push(event);
    regions.set(bin, regionEvents);
  }
  
  for (const [bin, regionEvents] of regions.entries()) {
    if (regionEvents.length < 4) continue;
    
    // Sort by time
    const sorted = [...regionEvents].sort((a, b) => 
      new Date(a.time).getTime() - new Date(b.time).getTime()
    );
    
    // Compare first half vs second half
    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint);
    const secondHalf = sorted.slice(midpoint);
    
    const firstAvgSeverity = firstHalf.reduce((sum, e) => sum + e.severityScore, 0) / firstHalf.length;
    const secondAvgSeverity = secondHalf.reduce((sum, e) => sum + e.severityScore, 0) / secondHalf.length;
    
    if (secondAvgSeverity > firstAvgSeverity * ACCELERATION_THRESHOLD) {
      const centroid = getCentroid(regionEvents);
      const recentEvents = sorted.slice(-5);
      
      signals.push({
        region: getRegionName(centroid.lat, centroid.lon),
        location: centroid,
        signalType: 'escalation',
        description: `Rapid escalation detected: severity increased ${((secondAvgSeverity / firstAvgSeverity) * 100 - 100).toFixed(0)}% in recent events`,
        confidence: Math.min(90, 50 + (secondAvgSeverity / firstAvgSeverity) * 20),
        triggerEvents: recentEvents,
        timeWindow: {
          start: sorted[0].time,
          end: sorted[sorted.length - 1].time
        },
        recommendedAction: 'Increase monitoring frequency. Review preparedness and response capabilities.'
      });
    }
  }
  
  return signals;
}

/**
 * Detect cascading events (multiple types in sequence)
 */
function detectCascades(
  events: CrisisEvent[],
  nowMs: number
): PredictiveSignal[] {
  const signals: PredictiveSignal[] = [];
  const recentWindow = 12 * 3600 * 1000; // 12 hours
  
  // Group by region
  const regions = new Map<string, CrisisEvent[]>();
  for (const event of events) {
    const eventTime = new Date(event.time).getTime();
    if (nowMs - eventTime > recentWindow) continue;
    
    const bin = getGeoBin(event.lat, event.lon);
    const regionEvents = regions.get(bin) ?? [];
    regionEvents.push(event);
    regions.set(bin, regionEvents);
  }
  
  for (const [bin, regionEvents] of regions.entries()) {
    const uniqueLayers = new Set(regionEvents.map(e => e.layer));
    
    // Cascade: 3+ different event types in 12h window
    if (uniqueLayers.size >= 3) {
      const centroid = getCentroid(regionEvents);
      const sorted = [...regionEvents].sort((a, b) => 
        new Date(a.time).getTime() - new Date(b.time).getTime()
      );
      
      const layerSequence = sorted.map(e => e.layer).join(' → ');
      
      signals.push({
        region: getRegionName(centroid.lat, centroid.lon),
        location: centroid,
        signalType: 'cascade',
        description: `Compound disaster cascade: ${uniqueLayers.size} event types occurring (${layerSequence})`,
        confidence: Math.min(85, 40 + uniqueLayers.size * 15),
        triggerEvents: regionEvents,
        timeWindow: {
          start: sorted[0].time,
          end: sorted[sorted.length - 1].time
        },
        recommendedAction: 'Compound disaster risk. Coordinate multi-agency response. Monitor for secondary effects.'
      });
    }
  }
  
  return signals;
}

/**
 * Detect convergence (multiple events moving toward a location)
 */
function detectConvergence(
  events: CrisisEvent[],
  nowMs: number
): PredictiveSignal[] {
  const signals: PredictiveSignal[] = [];
  const recentWindow = 24 * 3600 * 1000; // 24 hours
  
  // Look for regions where events are clustering
  const regions = new Map<string, CrisisEvent[]>();
  for (const event of events) {
    const eventTime = new Date(event.time).getTime();
    if (nowMs - eventTime > recentWindow) continue;
    
    const bin = getGeoBin(event.lat, event.lon);
    const regionEvents = regions.get(bin) ?? [];
    regionEvents.push(event);
    regions.set(bin, regionEvents);
  }
  
  for (const [bin, regionEvents] of regions.entries()) {
    if (regionEvents.length < 6) continue;
    
    const centroid = getCentroid(regionEvents);
    const sorted = [...regionEvents].sort((a, b) => 
      new Date(a.time).getTime() - new Date(b.time).getTime()
    );
    
    // Check if density is increasing over time
    const firstQuarter = sorted.slice(0, Math.floor(sorted.length / 4));
    const lastQuarter = sorted.slice(-Math.floor(sorted.length / 4));
    
    if (lastQuarter.length > firstQuarter.length * 1.5) {
      signals.push({
        region: getRegionName(centroid.lat, centroid.lon),
        location: centroid,
        signalType: 'convergence',
        description: `Event convergence detected: ${regionEvents.length} events clustering in region over ${Math.round(recentWindow / 3600000)}h`,
        confidence: Math.min(80, 40 + regionEvents.length * 3),
        triggerEvents: lastQuarter,
        timeWindow: {
          start: sorted[0].time,
          end: sorted[sorted.length - 1].time
        },
        recommendedAction: 'Multiple threats converging. Assess cumulative impact. Prepare for complex emergency.'
      });
    }
  }
  
  return signals;
}

/**
 * Detect all predictive signals
 */
export function detectPredictiveSignals(
  events: CrisisEvent[],
  opts?: { nowMs?: number; limit?: number }
): PredictiveSignal[] {
  const nowMs = opts?.nowMs ?? Date.now();
  const limit = opts?.limit ?? 15;
  
  const signals: PredictiveSignal[] = [
    ...detectSwarms(events, nowMs),
    ...detectEscalation(events, nowMs),
    ...detectCascades(events, nowMs),
    ...detectConvergence(events, nowMs)
  ];
  
  // Sort by confidence (highest first)
  signals.sort((a, b) => b.confidence - a.confidence);
  
  return signals.slice(0, limit);
}

/**
 * Get high-confidence signals only
 */
export function getHighConfidenceSignals(
  events: CrisisEvent[],
  minConfidence: number = 70
): PredictiveSignal[] {
  const signals = detectPredictiveSignals(events);
  return signals.filter(s => s.confidence >= minConfidence);
}

/**
 * Check if a region has active warning signals
 */
export function hasActiveWarnings(
  lat: number,
  lon: number,
  events: CrisisEvent[]
): boolean {
  const signals = detectPredictiveSignals(events);
  const bin = getGeoBin(lat, lon);
  
  return signals.some(s => {
    const sBin = getGeoBin(s.location.lat, s.location.lon);
    return sBin === bin;
  });
}
