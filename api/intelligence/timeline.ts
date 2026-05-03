/**
 * CRISIS TIMELINE
 * 
 * Tracks event progression in regions over time.
 * Detects escalation patterns and activity acceleration.
 * 
 * Identifies patterns like:
 * - earthquake → aftershocks → tsunami → evacuations
 * - fire → spread → evacuation orders
 * - storm → flooding → infrastructure damage
 */

import type { CrisisEvent, CrisisLayer } from '../_lib/types';
import type { RegionalTimeline, TimelineEntry } from './types';

const GRID_SIZE = 3.0; // 3° grid (~330km)
const TIMELINE_WINDOW_MS = 7 * 24 * 3600 * 1000; // 7 days
const ESCALATION_THRESHOLD = 1.5; // 50% severity increase

// Known escalation patterns
const ESCALATION_PATTERNS: Record<string, string[]> = {
  'seismic-cascade': ['earthquakes', 'earthquakes', 'earthquakes'], // swarm
  'tsunami-sequence': ['earthquakes', 'earthquakes'], // potential tsunami trigger
  'compound-disaster': ['earthquakes', 'floods'], // earthquake + infrastructure damage → flooding
  'wildfire-spread': ['wildfires', 'wildfires', 'wildfires'], // fire spreading
  'storm-impact': ['storms', 'floods'], // storm → flooding
  'volcanic-cascade': ['volcanoes', 'earthquakes'], // volcanic activity + seismic
};

function getGeoBin(lat: number, lon: number): { latBin: number; lonBin: number; key: string } {
  const latBin = Math.floor(lat / GRID_SIZE);
  const lonBin = Math.floor(lon / GRID_SIZE);
  return { latBin, lonBin, key: `${latBin},${lonBin}` };
}

function getCentroid(events: CrisisEvent[]): { lat: number; lon: number } {
  if (events.length === 0) return { lat: 0, lon: 0 };
  const lat = events.reduce((sum, e) => sum + e.lat, 0) / events.length;
  const lon = events.reduce((sum, e) => sum + e.lon, 0) / events.length;
  return { lat, lon };
}

function getRegionName(latBin: number, lonBin: number): string {
  const lat = latBin * GRID_SIZE;
  const lon = lonBin * GRID_SIZE;
  return `${lat >= 0 ? 'N' : 'S'}${Math.abs(lat).toFixed(0)} ${lon >= 0 ? 'E' : 'W'}${Math.abs(lon).toFixed(0)}`;
}

/**
 * Detect escalation pattern in timeline
 */
function detectEscalationPattern(timeline: TimelineEntry[]): { detected: boolean; pattern?: string } {
  if (timeline.length < 2) return { detected: false };
  
  // Sort by timestamp
  const sorted = [...timeline].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // Check for severity escalation
  let severityIncreasing = false;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.severity > prev.severity * ESCALATION_THRESHOLD) {
      severityIncreasing = true;
      break;
    }
  }
  
  // Check for known patterns
  const recentLayers = sorted.slice(-5).map(e => e.eventType);
  
  for (const [patternName, patternLayers] of Object.entries(ESCALATION_PATTERNS)) {
    // Check if pattern matches recent events
    let matches = 0;
    for (let i = 0; i < recentLayers.length; i++) {
      for (let j = 0; j < patternLayers.length; j++) {
        if (i + j < recentLayers.length && recentLayers[i + j] === patternLayers[j]) {
          matches++;
        }
      }
    }
    
    if (matches >= patternLayers.length) {
      return { detected: true, pattern: patternName };
    }
  }
  
  if (severityIncreasing) {
    return { detected: true, pattern: 'severity-escalation' };
  }
  
  return { detected: false };
}

/**
 * Calculate activity acceleration (change in event rate)
 */
function calculateAcceleration(timeline: TimelineEntry[]): number {
  if (timeline.length < 4) return 0;
  
  const sorted = [...timeline].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);
  
  const firstTime = new Date(sorted[0].timestamp).getTime();
  const midTime = new Date(sorted[midpoint].timestamp).getTime();
  const lastTime = new Date(sorted[sorted.length - 1].timestamp).getTime();
  
  const firstRate = firstHalf.length / Math.max(1, (midTime - firstTime) / 3600000); // events per hour
  const secondRate = secondHalf.length / Math.max(1, (lastTime - midTime) / 3600000);
  
  return secondRate - firstRate; // positive = accelerating
}

/**
 * Determine severity trend
 */
function getSeverityTrend(timeline: TimelineEntry[]): 'increasing' | 'stable' | 'decreasing' {
  if (timeline.length < 3) return 'stable';
  
  const sorted = [...timeline].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const recentAvg = sorted.slice(-3).reduce((sum, e) => sum + e.severity, 0) / 3;
  const olderAvg = sorted.slice(0, -3).reduce((sum, e) => sum + e.severity, 0) / Math.max(1, sorted.length - 3);
  
  if (recentAvg > olderAvg * 1.2) return 'increasing';
  if (recentAvg < olderAvg * 0.8) return 'decreasing';
  return 'stable';
}

/**
 * Analyze regional timelines
 */
export function analyzeTimelines(
  events: CrisisEvent[],
  opts?: { nowMs?: number; windowMs?: number; minEvents?: number; limit?: number }
): RegionalTimeline[] {
  const nowMs = opts?.nowMs ?? Date.now();
  const windowMs = opts?.windowMs ?? TIMELINE_WINDOW_MS;
  const minEvents = opts?.minEvents ?? 3;
  const limit = opts?.limit ?? 20;
  
  // Filter to events in time window
  const recentEvents = events.filter(e => {
    const eventTime = new Date(e.time).getTime();
    return (nowMs - eventTime) <= windowMs;
  });
  
  // Group by region
  const regions = new Map<string, CrisisEvent[]>();
  
  for (const event of recentEvents) {
    const bin = getGeoBin(event.lat, event.lon);
    const regionEvents = regions.get(bin.key) ?? [];
    regionEvents.push(event);
    regions.set(bin.key, regionEvents);
  }
  
  // Build timelines
  const timelines: RegionalTimeline[] = [];
  
  for (const [binKey, regionEvents] of regions.entries()) {
    if (regionEvents.length < minEvents) continue;
    
    const [latStr, lonStr] = binKey.split(',');
    const latBin = parseInt(latStr, 10);
    const lonBin = parseInt(lonStr, 10);
    
    // Build timeline entries
    const timeline: TimelineEntry[] = regionEvents.map(e => ({
      timestamp: e.time,
      eventType: e.layer,
      title: e.title,
      severity: e.severityScore,
      escalation: false
    }));
    
    // Detect escalation
    const escalation = detectEscalationPattern(timeline);
    if (escalation.detected && timeline.length > 0) {
      timeline[timeline.length - 1].escalation = true;
    }
    
    const severityTrend = getSeverityTrend(timeline);
    const acceleration = calculateAcceleration(timeline);
    
    timelines.push({
      region: getRegionName(latBin, lonBin),
      location: getCentroid(regionEvents),
      timeline: timeline.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
      eventCount: timeline.length,
      severityTrend,
      activityAcceleration: Math.round(acceleration * 100) / 100,
      escalationDetected: escalation.detected,
      escalationPattern: escalation.pattern
    });
  }
  
  // Sort by event count and severity
  timelines.sort((a, b) => {
    if (a.escalationDetected && !b.escalationDetected) return -1;
    if (!a.escalationDetected && b.escalationDetected) return 1;
    return b.eventCount - a.eventCount;
  });
  
  return timelines.slice(0, limit);
}

/**
 * Get timeline for a specific region
 */
export function getRegionalTimeline(
  lat: number,
  lon: number,
  events: CrisisEvent[]
): RegionalTimeline | null {
  const timelines = analyzeTimelines(events, { minEvents: 1 });
  const bin = getGeoBin(lat, lon);
  
  return timelines.find(t => {
    const tBin = getGeoBin(t.location.lat, t.location.lon);
    return tBin.key === bin.key;
  }) ?? null;
}

/**
 * Get all regions with escalation detected
 */
export function getEscalatingRegions(events: CrisisEvent[]): RegionalTimeline[] {
  const timelines = analyzeTimelines(events);
  return timelines.filter(t => t.escalationDetected);
}
