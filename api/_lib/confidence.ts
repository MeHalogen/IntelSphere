/**
 * Signal Confidence Scoring Module
 * 
 * Assigns confidence scores to events based on data source reliability,
 * verification status, and data quality indicators.
 * 
 * Confidence Score: 0.0 (unreliable) to 1.0 (highly reliable)
 * 
 * Purpose:
 * - Prioritize high-confidence events in intelligence analysis
 * - Weight correlation/hotspot detection by confidence
 * - Filter low-confidence noise in critical situations
 * - Track data quality over time
 */

import type { CrisisEvent, CrisisLayer } from './types';

/**
 * Source confidence tiers based on reliability and verification
 */
export const SOURCE_CONFIDENCE: Record<string, number> = {
  // Tier 1: Government/Scientific agencies (highest reliability)
  usgs: 0.95, // US Geological Survey - seismic monitoring authority
  noaa: 0.95, // National Oceanic and Atmospheric Administration
  jma: 0.95, // Japan Meteorological Agency
  emsc: 0.93, // European-Mediterranean Seismological Centre
  bgs: 0.93, // British Geological Survey

  // Tier 2: International organizations & satellite data
  gdacs: 0.90, // Global Disaster Alert and Coordination System (UN)
  nasa: 0.90, // NASA Earth Observatory (EONET)
  esa: 0.90, // European Space Agency
  copernicus: 0.88, // EU Earth observation program
  firms: 0.85, // FIRMS/MODIS fire detection

  // Tier 3: Aviation & specialized monitoring
  opensky: 0.80, // OpenSky Network - crowdsourced but validated
  flightradar24: 0.78, // Commercial flight tracking
  icao: 0.92, // International Civil Aviation Organization

  // Tier 4: Humanitarian organizations
  acled: 0.75, // Armed Conflict Location & Event Data
  unocha: 0.80, // UN Office for Coordination of Humanitarian Affairs
  reliefweb: 0.75, // ReliefWeb aggregator

  // Tier 5: News & social media
  reuters: 0.70, // Major news agencies (verified)
  ap: 0.70, // Associated Press
  bbc: 0.68, // BBC News
  cnn: 0.65, // Cable news
  twitter: 0.40, // Social media (unverified)
  reddit: 0.35, // Social aggregation

  // Default for unknown sources
  unknown: 0.50,
};

/**
 * Layer-specific confidence adjustments
 * Some event types are inherently more verifiable than others
 */
const LAYER_CONFIDENCE_MULTIPLIERS: Record<CrisisLayer, number> = {
  earthquakes: 1.0, // Seismic data is highly precise
  volcanoes: 0.95, // Well-monitored but evolving
  floods: 0.85, // Often relies on satellite + ground reports
  storms: 0.90, // Good weather satellite coverage
  wildfires: 0.85, // Satellite detection can have false positives
  conflicts: 0.70, // Hard to verify in real-time
  airspace: 0.75, // Crowdsourced + validated data
};

/**
 * Data quality indicators that boost or reduce confidence
 */
interface DataQualityIndicators {
  hasGPS: boolean; // Precise coordinates available
  hasTimestamp: boolean; // Accurate time information
  hasMetrics: boolean; // Quantitative measurements (magnitude, etc.)
  hasSatelliteConfirmation: boolean; // Visual/sensor confirmation
  hasMultipleSources: boolean; // Confirmed by 2+ independent sources
  isRealtime: boolean; // Fresh data (<1 hour old)
  hasOfficialSource: boolean; // From government/scientific agency
}

/**
 * Calculate base confidence score from source
 */
export function getSourceConfidence(source: string): number {
  const normalized = source.toLowerCase().trim();
  return SOURCE_CONFIDENCE[normalized] ?? SOURCE_CONFIDENCE.unknown;
}

/**
 * Calculate comprehensive confidence score for an event
 */
export function calculateConfidenceScore(
  event: Partial<CrisisEvent>,
  indicators?: Partial<DataQualityIndicators>
): number {
  // Start with source confidence
  let confidence = getSourceConfidence(event.source ?? 'unknown');

  // Apply layer-specific multiplier
  if (event.layer) {
    const multiplier = LAYER_CONFIDENCE_MULTIPLIERS[event.layer] ?? 0.85;
    confidence *= multiplier;
  }

  // Quality indicators adjustments
  if (indicators) {
    // GPS coordinates boost confidence
    if (indicators.hasGPS && Number.isFinite(event.lat) && Number.isFinite(event.lon)) {
      confidence *= 1.05;
    }

    // Accurate timestamp
    if (indicators.hasTimestamp && event.time) {
      const age = Date.now() - new Date(event.time).getTime();
      const hoursSinceEvent = age / (1000 * 60 * 60);
      
      // Realtime data (< 1 hour) gets boost
      if (hoursSinceEvent < 1) {
        confidence *= 1.08;
      }
      // Recent data (< 6 hours) slight boost
      else if (hoursSinceEvent < 6) {
        confidence *= 1.03;
      }
      // Stale data (> 24 hours) penalty
      else if (hoursSinceEvent > 24) {
        confidence *= 0.95;
      }
    }

    // Quantitative metrics boost confidence
    if (indicators.hasMetrics && event.metrics && Object.keys(event.metrics).length > 0) {
      confidence *= 1.05;
    }

    // Satellite confirmation is strong signal
    if (indicators.hasSatelliteConfirmation) {
      confidence *= 1.10;
    }

    // Multiple independent sources = high confidence
    if (indicators.hasMultipleSources) {
      confidence *= 1.15;
    }

    // Official source flag
    if (indicators.hasOfficialSource) {
      confidence *= 1.05;
    }
  }

  // Clamp to [0.0, 1.0] range
  return Math.min(1.0, Math.max(0.0, confidence));
}

/**
 * Infer data quality indicators from event structure
 */
export function inferDataQualityIndicators(event: Partial<CrisisEvent>): DataQualityIndicators {
  const source = (event.source ?? '').toLowerCase();
  const officialSources = ['usgs', 'noaa', 'nasa', 'gdacs', 'emsc', 'jma', 'esa'];

  return {
    hasGPS: Number.isFinite(event.lat) && Number.isFinite(event.lon),
    hasTimestamp: Boolean(event.time),
    hasMetrics: Boolean(event.metrics && Object.keys(event.metrics).length > 0),
    hasSatelliteConfirmation: Boolean(
      event.links?.satellite ||
      source.includes('nasa') ||
      source.includes('esa') ||
      source.includes('copernicus') ||
      source.includes('firms')
    ),
    hasMultipleSources: Boolean(event.id?.includes('+')), // Combined ID from deduplication
    isRealtime: event.time ? (Date.now() - new Date(event.time).getTime()) < 3600000 : false,
    hasOfficialSource: officialSources.some((s) => source.includes(s)),
  };
}

/**
 * Get confidence label for display
 */
export function getConfidenceLabel(score: number): 'very-high' | 'high' | 'medium' | 'low' | 'very-low' {
  if (score >= 0.9) return 'very-high';
  if (score >= 0.75) return 'high';
  if (score >= 0.6) return 'medium';
  if (score >= 0.4) return 'low';
  return 'very-low';
}

/**
 * Filter events by minimum confidence threshold
 * Useful for critical intelligence where only high-confidence data matters
 */
export function filterByConfidence(
  events: CrisisEvent[],
  minConfidence: number = 0.7
): CrisisEvent[] {
  return events.filter((e) => e.confidenceScore >= minConfidence);
}

/**
 * Sort events by confidence (descending)
 */
export function sortByConfidence(events: CrisisEvent[]): CrisisEvent[] {
  return [...events].sort((a, b) => b.confidenceScore - a.confidenceScore);
}

/**
 * Calculate weighted average confidence for a set of events
 * Useful for regional/layer confidence assessment
 */
export function calculateAverageConfidence(events: CrisisEvent[]): number {
  if (events.length === 0) return 0;
  const sum = events.reduce((acc, e) => acc + e.confidenceScore, 0);
  return sum / events.length;
}

/**
 * Get confidence distribution statistics
 */
export function getConfidenceStats(events: CrisisEvent[]): {
  average: number;
  median: number;
  veryHigh: number; // >= 0.9
  high: number; // 0.75-0.89
  medium: number; // 0.6-0.74
  low: number; // 0.4-0.59
  veryLow: number; // < 0.4
  bySource: Record<string, { count: number; avgConfidence: number }>;
} {
  if (events.length === 0) {
    return {
      average: 0,
      median: 0,
      veryHigh: 0,
      high: 0,
      medium: 0,
      low: 0,
      veryLow: 0,
      bySource: {},
    };
  }

  const sorted = [...events].sort((a, b) => a.confidenceScore - b.confidenceScore);
  const median = sorted[Math.floor(sorted.length / 2)].confidenceScore;
  const average = events.reduce((sum, e) => sum + e.confidenceScore, 0) / events.length;

  const veryHigh = events.filter((e) => e.confidenceScore >= 0.9).length;
  const high = events.filter((e) => e.confidenceScore >= 0.75 && e.confidenceScore < 0.9).length;
  const medium = events.filter((e) => e.confidenceScore >= 0.6 && e.confidenceScore < 0.75).length;
  const low = events.filter((e) => e.confidenceScore >= 0.4 && e.confidenceScore < 0.6).length;
  const veryLow = events.filter((e) => e.confidenceScore < 0.4).length;

  const bySource: Record<string, { count: number; avgConfidence: number }> = {};
  for (const event of events) {
    if (!bySource[event.source]) {
      bySource[event.source] = { count: 0, avgConfidence: 0 };
    }
    bySource[event.source].count += 1;
    bySource[event.source].avgConfidence += event.confidenceScore;
  }

  for (const source in bySource) {
    bySource[source].avgConfidence /= bySource[source].count;
  }

  return { average, median, veryHigh, high, medium, low, veryLow, bySource };
}

/**
 * Boost confidence when multiple sources confirm same event (used in deduplication)
 */
export function boostConfidenceForMultiSource(baseConfidence: number, sourceCount: number): number {
  // Each additional source adds +5% confidence (up to +20% max)
  const boost = Math.min(0.20, (sourceCount - 1) * 0.05);
  return Math.min(1.0, baseConfidence + boost);
}
