/**
 * EVENT CORRELATION ENGINE
 * 
 * Detects when multiple crisis event types occur in close spatial and temporal proximity.
 * This identifies compound disaster zones where cascading effects may amplify risk.
 * 
 * Algorithm:
 * 1. Bin events into 1° lat/lon grid cells
 * 2. Filter to cells with 3+ distinct event types within 24h window
 * 3. Calculate cluster severity from constituent events
 * 4. Return high-risk correlation zones
 */

import type { CrisisEvent, CrisisLayer } from '../_lib/types';
import type { CorrelationCluster, GeoBin } from './types';

const GRID_SIZE = 1.0; // degrees (1° ≈ 111km at equator)
const TIME_WINDOW_MS = 24 * 3600 * 1000; // 24 hours
const MIN_EVENT_TYPES = 3; // require 3+ distinct layers

/**
 * Create a geographic bin key for an event
 */
function getGeoBin(lat: number, lon: number): GeoBin {
  const latBin = Math.floor(lat / GRID_SIZE);
  const lonBin = Math.floor(lon / GRID_SIZE);
  return {
    latBin,
    lonBin,
    key: `${latBin},${lonBin}`
  };
}

/**
 * Calculate centroid of events in a cluster
 */
function getCentroid(events: CrisisEvent[]): { lat: number; lon: number } {
  if (events.length === 0) return { lat: 0, lon: 0 };
  
  const lat = events.reduce((sum, e) => sum + e.lat, 0) / events.length;
  const lon = events.reduce((sum, e) => sum + e.lon, 0) / events.length;
  
  return { lat, lon };
}

/**
 * Get time window for a set of events
 */
function getTimeWindow(events: CrisisEvent[]): { start: string; end: string } {
  if (events.length === 0) {
    const now = new Date().toISOString();
    return { start: now, end: now };
  }
  
  const times = events.map(e => new Date(e.time).getTime()).sort((a, b) => a - b);
  return {
    start: new Date(times[0]).toISOString(),
    end: new Date(times[times.length - 1]).toISOString()
  };
}

/**
 * Calculate aggregate severity for a cluster
 */
function getClusterSeverity(events: CrisisEvent[]): number {
  if (events.length === 0) return 0;
  
  // Weighted average with bonus for diversity and density
  const avgSeverity = events.reduce((sum, e) => sum + e.severityScore, 0) / events.length;
  const uniqueLayers = new Set(events.map(e => e.layer)).size;
  const densityBonus = Math.min(20, events.length * 2); // up to +20 for high density
  const diversityBonus = Math.min(15, uniqueLayers * 5); // up to +15 for diverse types
  
  return Math.min(100, avgSeverity + densityBonus + diversityBonus);
}

/**
 * Detect correlation clusters in a set of events
 */
export function detectCorrelations(
  events: CrisisEvent[],
  opts?: { nowMs?: number; minEventTypes?: number }
): CorrelationCluster[] {
  const nowMs = opts?.nowMs ?? Date.now();
  const minTypes = opts?.minEventTypes ?? MIN_EVENT_TYPES;
  
  // Filter to recent events within time window
  const recentEvents = events.filter(e => {
    const eventTime = new Date(e.time).getTime();
    return (nowMs - eventTime) <= TIME_WINDOW_MS;
  });
  
  // Group events by geographic bin
  const bins = new Map<string, CrisisEvent[]>();
  
  for (const event of recentEvents) {
    const bin = getGeoBin(event.lat, event.lon);
    const binEvents = bins.get(bin.key) ?? [];
    binEvents.push(event);
    bins.set(bin.key, binEvents);
  }
  
  // Find bins with correlation (3+ distinct event types)
  const clusters: CorrelationCluster[] = [];
  
  for (const [binKey, binEvents] of bins.entries()) {
    const uniqueTypes = new Set(binEvents.map(e => e.layer));
    
    if (uniqueTypes.size >= minTypes) {
      const centroid = getCentroid(binEvents);
      const timeWindow = getTimeWindow(binEvents);
      
      clusters.push({
        location: centroid,
        eventTypes: Array.from(uniqueTypes),
        severityScore: getClusterSeverity(binEvents),
        events: binEvents,
        timeWindow,
        clusterSize: binEvents.length
      });
    }
  }
  
  // Sort by severity (highest risk first)
  clusters.sort((a, b) => b.severityScore - a.severityScore);
  
  return clusters;
}

/**
 * Get top N correlation clusters
 */
export function getTopCorrelations(
  events: CrisisEvent[],
  limit: number = 10
): CorrelationCluster[] {
  const clusters = detectCorrelations(events);
  return clusters.slice(0, limit);
}

/**
 * Check if a specific location is in a correlation zone
 */
export function isCorrelationZone(
  lat: number,
  lon: number,
  events: CrisisEvent[],
  radiusDegrees: number = 2.0
): boolean {
  const clusters = detectCorrelations(events);
  
  return clusters.some(cluster => {
    const latDiff = Math.abs(cluster.location.lat - lat);
    const lonDiff = Math.abs(cluster.location.lon - lon);
    const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
    return distance <= radiusDegrees;
  });
}
