/**
 * GLOBAL RISK SCORE
 * 
 * Computes a unified world risk score combining:
 * - Active crises count
 * - Average severity
 * - Correlation clusters
 * - Trending signals
 * 
 * Returns risk level: low, elevated, high, critical
 */

import type { CrisisEvent } from '../_lib/types';
import type { GlobalRisk } from './types';
import { detectCorrelations } from './eventCorrelation';
import { detectTrends } from './trends';

const BASELINE_ACTIVE_CRISES = 50; // typical baseline
const BASELINE_SEVERITY = 45; // typical average severity
const BASELINE_CORRELATIONS = 2; // typical clusters
const BASELINE_TRENDS = 3; // typical trending keywords

/**
 * Calculate global risk score (0-100)
 * 
 * Components weighted:
 * - 35% active crises (normalized count)
 * - 30% average severity
 * - 20% correlation clusters
 * - 15% trending signals
 */
function calculateGlobalRiskScore(
  activeCrises: number,
  avgSeverity: number,
  correlationCount: number,
  trendingCount: number
): number {
  // Normalize components to 0-100 scale
  const crisisScore = Math.min(100, (activeCrises / BASELINE_ACTIVE_CRISES) * 50);
  const severityScore = avgSeverity; // already 0-100
  const correlationScore = Math.min(100, (correlationCount / BASELINE_CORRELATIONS) * 50);
  const trendScore = Math.min(100, (trendingCount / BASELINE_TRENDS) * 50);
  
  // Weighted combination
  const risk = (
    crisisScore * 0.35 +
    severityScore * 0.30 +
    correlationScore * 0.20 +
    trendScore * 0.15
  );
  
  return Math.min(100, Math.round(risk * 10) / 10);
}

/**
 * Determine risk level from score
 */
function getRiskLevel(score: number): 'low' | 'elevated' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 45) return 'elevated';
  return 'low';
}

/**
 * Calculate baseline comparison
 */
function compareToBaseline(
  currentScore: number,
  historicalScores: number[]
): { change: number; direction: 'up' | 'down' | 'stable' } {
  if (historicalScores.length === 0) {
    return { change: 0, direction: 'stable' };
  }
  
  const baseline = historicalScores.reduce((sum, s) => sum + s, 0) / historicalScores.length;
  const change = ((currentScore - baseline) / Math.max(1, baseline)) * 100;
  
  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (change > 5) direction = 'up';
  else if (change < -5) direction = 'down';
  
  return {
    change: Math.round(change * 10) / 10,
    direction
  };
}

/**
 * Calculate global risk assessment
 */
export function calculateGlobalRisk(
  events: CrisisEvent[],
  opts?: {
    nowMs?: number;
    historicalScores?: number[];
  }
): GlobalRisk {
  const nowMs = opts?.nowMs ?? Date.now();
  const historicalScores = opts?.historicalScores ?? [];
  
  // Calculate components
  const activeCrises = events.length;
  const criticalEvents = events.filter(e => e.severityScore >= 80).length;
  const highEvents = events.filter(e => e.severityScore >= 60).length;
  
  const avgSeverity = events.length > 0
    ? events.reduce((sum, e) => sum + e.severityScore, 0) / events.length
    : 0;
  
  const correlations = detectCorrelations(events, { nowMs });
  const trends = detectTrends(events, { nowMs });
  const significantTrends = trends.filter(t => t.spike >= 2.0).length;
  
  // Calculate global risk score
  const globalRiskScore = calculateGlobalRiskScore(
    activeCrises,
    avgSeverity,
    correlations.length,
    significantTrends
  );
  
  const level = getRiskLevel(globalRiskScore);
  const comparison = compareToBaseline(globalRiskScore, historicalScores);
  
  return {
    globalRiskScore,
    level,
    components: {
      activeCrises,
      averageSeverity: Math.round(avgSeverity * 10) / 10,
      correlationClusters: correlations.length,
      trendingSignals: significantTrends
    },
    comparedToBaseline: comparison,
    generatedAt: new Date(nowMs).toISOString()
  };
}

/**
 * Get current global risk
 */
export function getGlobalRisk(events: CrisisEvent[]): GlobalRisk {
  return calculateGlobalRisk(events);
}

/**
 * Track risk score over time
 */
export function trackRiskHistory(
  events: CrisisEvent[],
  windowCount: number = 24,
  windowSizeMs: number = 3600000 // 1 hour
): Array<{ timestamp: string; riskScore: number; level: string }> {
  const nowMs = Date.now();
  const history: Array<{ timestamp: string; riskScore: number; level: string }> = [];
  
  for (let i = 0; i < windowCount; i++) {
    const windowEnd = nowMs - (i * windowSizeMs);
    const windowStart = windowEnd - (windowSizeMs * 7 * 24); // 7 days of data for each point
    
    // Filter events in this historical window
    const windowEvents = events.filter(e => {
      const eventTime = new Date(e.time).getTime();
      return eventTime >= windowStart && eventTime < windowEnd;
    });
    
    if (windowEvents.length > 0) {
      const risk = calculateGlobalRisk(windowEvents, { nowMs: windowEnd });
      history.unshift({
        timestamp: new Date(windowEnd).toISOString(),
        riskScore: risk.globalRiskScore,
        level: risk.level
      });
    }
  }
  
  return history;
}

/**
 * Get risk breakdown by region
 */
export function getRegionalRiskBreakdown(events: CrisisEvent[]): Array<{
  region: string;
  riskScore: number;
  eventCount: number;
}> {
  const GRID_SIZE = 10.0; // 10° grid
  const regions = new Map<string, CrisisEvent[]>();
  
  for (const event of events) {
    const latBin = Math.floor(event.lat / GRID_SIZE);
    const lonBin = Math.floor(event.lon / GRID_SIZE);
    const key = `${latBin},${lonBin}`;
    
    const regionEvents = regions.get(key) ?? [];
    regionEvents.push(event);
    regions.set(key, regionEvents);
  }
  
  const breakdown: Array<{ region: string; riskScore: number; eventCount: number }> = [];
  
  for (const [key, regionEvents] of regions.entries()) {
    const [latStr, lonStr] = key.split(',');
    const lat = parseInt(latStr, 10) * GRID_SIZE;
    const lon = parseInt(lonStr, 10) * GRID_SIZE;
    const region = `${lat >= 0 ? 'N' : 'S'}${Math.abs(lat)} ${lon >= 0 ? 'E' : 'W'}${Math.abs(lon)}`;
    
    const risk = calculateGlobalRisk(regionEvents);
    
    breakdown.push({
      region,
      riskScore: risk.globalRiskScore,
      eventCount: regionEvents.length
    });
  }
  
  breakdown.sort((a, b) => b.riskScore - a.riskScore);
  return breakdown;
}
