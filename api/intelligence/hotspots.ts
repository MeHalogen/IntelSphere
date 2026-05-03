/**
 * HOTSPOT DETECTION
 * 
 * Identifies global risk hotspots by combining multiple risk factors:
 * - Event severity scores
 * - Event density (spatial clustering)
 * - Recent activity (temporal clustering)
 * - Population exposure (affected people)
 * 
 * Returns ranked list of regions sorted by risk score.
 */

import type { CrisisEvent, CrisisLayer } from '../_lib/types';
import type { Hotspot } from './types';

const GRID_SIZE = 5.0; // 5° grid for regional analysis (~550km)
const RECENT_WINDOW_MS = 24 * 3600 * 1000; // 24 hours
const MIN_EVENTS_FOR_HOTSPOT = 2;

// Regional population density estimates (simplified)
// In production: integrate with real population rasters
const POPULATION_REGIONS: Record<string, number> = {
  // Format: "latBand,lonBand": exposure score (0-100)
  // High density regions
  '35,140': 95, // Tokyo region
  '35,130': 90, // Osaka region
  '30,120': 85, // Shanghai region
  '20,75': 85,  // Mumbai region
  '30,-120': 80, // California
  '40,-75': 75, // NYC region
  '-35,150': 70, // Sydney region
  '0,100': 75, // Indonesia
  '15,120': 80, // Manila region
  // Default: moderate
};

function getRegionName(latBin: number, lonBin: number): string {
  // Convert bin to region name (simplified)
  const regions: Record<string, string> = {
    '35,140': 'Japan (Tokyo)',
    '35,130': 'Japan (Osaka)',
    '30,120': 'China (East)',
    '40,120': 'China (North)',
    '20,75': 'India (West)',
    '25,85': 'India (East)',
    '0,100': 'Indonesia',
    '15,120': 'Philippines',
    '30,-120': 'California',
    '40,-75': 'US Northeast',
    '45,-125': 'Pacific Northwest',
    '30,-100': 'US South',
    '50,0': 'UK/Northern Europe',
    '40,15': 'Mediterranean',
    '-35,150': 'Australia (East)',
    '35,50': 'Middle East',
    '0,20': 'Central Africa',
    '-10,-50': 'Brazil',
    '20,-100': 'Mexico',
    '60,25': 'Scandinavia',
    '-35,20': 'South Africa',
  };
  
  const key = `${latBin},${lonBin}`;
  return regions[key] || `${latBin >= 0 ? 'N' : 'S'}${Math.abs(latBin * GRID_SIZE)} ${lonBin >= 0 ? 'E' : 'W'}${Math.abs(lonBin * GRID_SIZE)}`;
}

function getPopulationExposure(latBin: number, lonBin: number): number {
  const key = `${latBin},${lonBin}`;
  return POPULATION_REGIONS[key] ?? 50; // default: moderate exposure
}

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

/**
 * Calculate hotspot risk score
 * 
 * Formula: weighted combination of:
 * - 40% severity (average event severity)
 * - 25% density (number of events)
 * - 20% recency (recent activity)
 * - 15% population (exposure)
 */
function calculateRiskScore(
  avgSeverity: number,
  eventCount: number,
  recentCount: number,
  populationExposure: number
): number {
  // Normalize density (log scale to handle wide range)
  const densityScore = Math.min(100, Math.log10(eventCount + 1) * 50);
  
  // Normalize recency
  const recencyScore = Math.min(100, (recentCount / Math.max(1, eventCount)) * 100);
  
  // Weighted combination
  const risk = (
    avgSeverity * 0.40 +
    densityScore * 0.25 +
    recencyScore * 0.20 +
    populationExposure * 0.15
  );
  
  return Math.min(100, Math.round(risk * 10) / 10);
}

/**
 * Detect global hotspots from events
 */
export function detectHotspots(
  events: CrisisEvent[],
  opts?: { nowMs?: number; minEvents?: number; limit?: number }
): Hotspot[] {
  const nowMs = opts?.nowMs ?? Date.now();
  const minEvents = opts?.minEvents ?? MIN_EVENTS_FOR_HOTSPOT;
  const limit = opts?.limit ?? 20;
  
  // Group events by region (5° grid)
  const regions = new Map<string, CrisisEvent[]>();
  
  for (const event of events) {
    const bin = getGeoBin(event.lat, event.lon);
    const regionEvents = regions.get(bin.key) ?? [];
    regionEvents.push(event);
    regions.set(bin.key, regionEvents);
  }
  
  // Calculate risk score for each region
  const hotspots: Hotspot[] = [];
  
  for (const [binKey, regionEvents] of regions.entries()) {
    if (regionEvents.length < minEvents) continue;
    
    const [latStr, lonStr] = binKey.split(',');
    const latBin = parseInt(latStr, 10);
    const lonBin = parseInt(lonStr, 10);
    
    // Calculate metrics
    const avgSeverity = regionEvents.reduce((sum, e) => sum + e.severityScore, 0) / regionEvents.length;
    
    const recentEvents = regionEvents.filter(e => {
      const eventTime = new Date(e.time).getTime();
      return (nowMs - eventTime) <= RECENT_WINDOW_MS;
    });
    
    const populationExposure = getPopulationExposure(latBin, lonBin);
    
    const riskScore = calculateRiskScore(
      avgSeverity,
      regionEvents.length,
      recentEvents.length,
      populationExposure
    );
    
    // Get dominant event types
    const layerCounts = new Map<CrisisLayer, number>();
    for (const event of regionEvents) {
      layerCounts.set(event.layer, (layerCounts.get(event.layer) ?? 0) + 1);
    }
    const dominantLayers = Array.from(layerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([layer]) => layer);
    
    hotspots.push({
      region: getRegionName(latBin, lonBin),
      location: getCentroid(regionEvents),
      riskScore,
      eventCount: regionEvents.length,
      averageSeverity: Math.round(avgSeverity * 10) / 10,
      recentActivity: recentEvents.length,
      populationExposure,
      dominantLayers
    });
  }
  
  // Sort by risk score (descending)
  hotspots.sort((a, b) => b.riskScore - a.riskScore);
  
  return hotspots.slice(0, limit);
}

/**
 * Get top N hotspots
 */
export function getTopHotspots(
  events: CrisisEvent[],
  limit: number = 10
): Hotspot[] {
  return detectHotspots(events, { limit });
}

/**
 * Check if a location is in a hotspot zone
 */
export function isHotspot(
  lat: number,
  lon: number,
  events: CrisisEvent[],
  minRiskScore: number = 60
): boolean {
  const hotspots = detectHotspots(events);
  const bin = getGeoBin(lat, lon);
  
  return hotspots.some(h => {
    const hBin = getGeoBin(h.location.lat, h.location.lon);
    return hBin.key === bin.key && h.riskScore >= minRiskScore;
  });
}
