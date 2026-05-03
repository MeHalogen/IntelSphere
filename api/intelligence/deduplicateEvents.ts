import type { CrisisEvent } from '../_lib/types';

/**
 * Event Deduplication Module
 * 
 * Problem: Multiple sources (USGS, NASA EONET, GDACS) may report the same event
 * Solution: Identify and merge duplicates, keeping the highest-quality data
 * 
 * Duplicate Criteria:
 * - Distance < 100km (spatial proximity)
 * - Time difference < 6 hours (temporal proximity)
 * - Same layer type (event category)
 * 
 * Resolution Strategy:
 * - Keep event with highest severity score
 * - Merge metadata (combine sources, links)
 * - Preserve data quality and traceability
 */

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Calculate great-circle distance between two points (Haversine formula)
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return distance;
}

/**
 * Calculate time difference in hours between two ISO timestamps
 */
export function calculateTimeDifference(time1: string, time2: string): number {
  const date1 = new Date(time1).getTime();
  const date2 = new Date(time2).getTime();
  const diffMs = Math.abs(date2 - date1);
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours;
}

/**
 * Check if two events are duplicates based on proximity criteria
 */
export function areDuplicates(
  event1: CrisisEvent,
  event2: CrisisEvent,
  distanceThresholdKm: number = 100,
  timeThresholdHours: number = 6
): boolean {
  // Must be same layer type
  if (event1.layer !== event2.layer) {
    return false;
  }

  // Check spatial proximity
  const distance = calculateDistance(
    event1.lat,
    event1.lon,
    event2.lat,
    event2.lon
  );

  if (distance >= distanceThresholdKm) {
    return false;
  }

  // Check temporal proximity
  const timeDiff = calculateTimeDifference(event1.time, event2.time);

  if (timeDiff >= timeThresholdHours) {
    return false;
  }

  return true;
}

/**
 * Merge two duplicate events, keeping the best data from each
 * Returns the merged event with combined metadata
 */
export function mergeEvents(event1: CrisisEvent, event2: CrisisEvent): CrisisEvent {
  // Keep event with higher severity score as primary
  const [primary, secondary] =
    event1.severityScore >= event2.severityScore
      ? [event1, event2]
      : [event2, event1];

  // Combine sources for traceability
  const sources = new Set([primary.source]);
  if (secondary.source !== primary.source) {
    sources.add(secondary.source);
  }

  // Boost confidence score when multiple sources confirm same event
  const sourceCount = sources.size;
  const baseConfidence = Math.max(primary.confidenceScore, secondary.confidenceScore);
  const confidenceBoost = Math.min(0.20, (sourceCount - 1) * 0.05); // +5% per source, max +20%
  const mergedConfidence = Math.min(1.0, baseConfidence + confidenceBoost);

  // Merge links (keep all unique URLs)
  const mergedLinks = {
    url: primary.links?.url || secondary.links?.url,
    news: primary.links?.news || secondary.links?.news,
  };

  // Use more recent timestamp if severity is close
  const useSecondaryTime =
    Math.abs(primary.severityScore - secondary.severityScore) < 0.05 &&
    new Date(secondary.time) > new Date(primary.time);

  // Merge metrics (prefer higher values for most metrics)
  const mergedMetrics = {
    ...primary.metrics,
  };

  if (secondary.metrics) {
    for (const [key, value] of Object.entries(secondary.metrics)) {
      if (mergedMetrics[key] === undefined) {
        mergedMetrics[key] = value;
      } else if (typeof value === 'number' && typeof mergedMetrics[key] === 'number') {
        // For numeric metrics, keep the higher value (usually more severe)
        mergedMetrics[key] = Math.max(mergedMetrics[key] as number, value);
      }
    }
  }

  // Create merged event
  const merged: CrisisEvent = {
    ...primary,
    time: useSecondaryTime ? secondary.time : primary.time,
    id: `${primary.id}+${secondary.id}`, // Combined ID for traceability
    description: `${primary.description} [Sources: ${Array.from(sources).join(', ')}]`,
    links: mergedLinks,
    metrics: mergedMetrics,
    confidenceScore: mergedConfidence, // Boosted confidence from multiple sources
  };

  return merged;
}

/**
 * Deduplicate an array of crisis events
 * 
 * Algorithm:
 * 1. Sort events by severity (descending) to prioritize high-quality events
 * 2. For each event, check if it's a duplicate of any kept event
 * 3. If duplicate, merge with existing event
 * 4. If not, add to result set
 * 
 * Returns deduplicated array with merged events
 */
export function deduplicateEvents(
  events: CrisisEvent[],
  distanceThresholdKm: number = 100,
  timeThresholdHours: number = 6
): CrisisEvent[] {
  if (events.length === 0) {
    return [];
  }

  // Sort by severity (descending) to prioritize high-quality events
  const sorted = [...events].sort((a, b) => b.severityScore - a.severityScore);

  const deduplicated: CrisisEvent[] = [];
  const processed = new Set<string>();

  for (const event of sorted) {
    if (processed.has(event.id)) {
      continue;
    }

    // Check if this event duplicates any already-kept event
    let foundDuplicate = false;
    let duplicateIndex = -1;

    for (let i = 0; i < deduplicated.length; i++) {
      const kept = deduplicated[i];
      
      if (areDuplicates(event, kept, distanceThresholdKm, timeThresholdHours)) {
        foundDuplicate = true;
        duplicateIndex = i;
        break;
      }
    }

    if (foundDuplicate && duplicateIndex >= 0) {
      // Merge with existing event
      const merged = mergeEvents(deduplicated[duplicateIndex], event);
      deduplicated[duplicateIndex] = merged;
      processed.add(event.id);
    } else {
      // Keep as unique event
      deduplicated.push(event);
      processed.add(event.id);
    }
  }

  return deduplicated;
}

/**
 * Get deduplication statistics for reporting
 */
export function getDeduplicationStats(
  originalEvents: CrisisEvent[],
  deduplicatedEvents: CrisisEvent[]
): {
  originalCount: number;
  deduplicatedCount: number;
  duplicatesRemoved: number;
  deduplicationRate: number;
  byLayer: Record<string, { original: number; deduplicated: number; removed: number }>;
} {
  const duplicatesRemoved = originalEvents.length - deduplicatedEvents.length;
  const deduplicationRate = originalEvents.length > 0
    ? duplicatesRemoved / originalEvents.length
    : 0;

  // Calculate per-layer statistics
  const byLayer: Record<string, { original: number; deduplicated: number; removed: number }> = {};

  for (const event of originalEvents) {
    if (!byLayer[event.layer]) {
      byLayer[event.layer] = { original: 0, deduplicated: 0, removed: 0 };
    }
    byLayer[event.layer].original += 1;
  }

  for (const event of deduplicatedEvents) {
    if (byLayer[event.layer]) {
      byLayer[event.layer].deduplicated += 1;
    }
  }

  for (const layer in byLayer) {
    byLayer[layer].removed = byLayer[layer].original - byLayer[layer].deduplicated;
  }

  return {
    originalCount: originalEvents.length,
    deduplicatedCount: deduplicatedEvents.length,
    duplicatesRemoved,
    deduplicationRate,
    byLayer,
  };
}

/**
 * Advanced: Find duplicate clusters (3+ events reporting same incident)
 * Useful for identifying high-confidence events confirmed by multiple sources
 */
export function findDuplicateClusters(
  events: CrisisEvent[],
  distanceThresholdKm: number = 100,
  timeThresholdHours: number = 6,
  minClusterSize: number = 3
): Array<{
  representative: CrisisEvent;
  duplicates: CrisisEvent[];
  sources: string[];
  confidence: number;
}> {
  const clusters: Array<{
    representative: CrisisEvent;
    duplicates: CrisisEvent[];
    sources: string[];
    confidence: number;
  }> = [];

  const processed = new Set<string>();

  for (const event of events) {
    if (processed.has(event.id)) {
      continue;
    }

    // Find all duplicates of this event
    const duplicates: CrisisEvent[] = [];
    const sources = new Set<string>([event.source]);

    for (const other of events) {
      if (other.id === event.id || processed.has(other.id)) {
        continue;
      }

      if (areDuplicates(event, other, distanceThresholdKm, timeThresholdHours)) {
        duplicates.push(other);
        sources.add(other.source);
        processed.add(other.id);
      }
    }

    // Only create cluster if we have enough duplicates
    if (duplicates.length + 1 >= minClusterSize) {
      const allEvents = [event, ...duplicates];
      const representative = allEvents.reduce((best, curr) =>
        curr.severityScore > best.severityScore ? curr : best
      );

      // Confidence based on number of independent sources
      const confidence = Math.min(1.0, sources.size / 5); // 5+ sources = 100% confidence

      clusters.push({
        representative,
        duplicates,
        sources: Array.from(sources),
        confidence,
      });
    }

    processed.add(event.id);
  }

  return clusters;
}
