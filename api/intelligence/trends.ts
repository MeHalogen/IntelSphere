/**
 * TREND DETECTION
 * 
 * Detects trending disaster keywords by comparing recent frequency to baseline.
 * Uses spike detection to identify emerging patterns and threats.
 * 
 * Algorithm:
 * 1. Extract keywords from event titles/descriptions
 * 2. Calculate frequency in recent window (last 2 hours)
 * 3. Compare to 7-day baseline
 * 4. Return keywords with significant spikes
 */

import type { CrisisEvent } from '../_lib/types';
import type { TrendingKeyword } from './types';

const RECENT_WINDOW_MS = 2 * 3600 * 1000; // 2 hours
const BASELINE_WINDOW_MS = 7 * 24 * 3600 * 1000; // 7 days
const MIN_SPIKE_RATIO = 1.5; // 50% increase
const MIN_RECENT_COUNT = 2; // need at least 2 occurrences

// Extended stopwords for crisis events
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'near', 'from', 'into', 'over', 'alert', 'update',
  'major', 'minor', 'about', 'this', 'that', 'have', 'been', 'area', 'region',
  'event', 'report', 'reported', 'occurs', 'occurred', 'warning', 'advisory'
]);

// Crisis-relevant terms that should be tracked
const RELEVANT_TERMS = new Set([
  'earthquake', 'tsunami', 'flood', 'wildfire', 'storm', 'hurricane', 'typhoon',
  'cyclone', 'tornado', 'volcanic', 'eruption', 'evacuation', 'landslide',
  'drought', 'heatwave', 'coldwave', 'blizzard', 'avalanche', 'conflict',
  'strike', 'protest', 'violence', 'casualties', 'damage', 'destroyed',
  'emergency', 'disaster', 'crisis', 'magnitude', 'richter', 'aftershock',
  'epicenter', 'seismic', 'tremor', 'swarm'
]);

/**
 * Extract and normalize keywords from text
 */
function extractKeywords(text: string): string[] {
  const normalized = text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ') // remove special chars except hyphens
    .replace(/\s+/g, ' ')
    .trim();
  
  const words = normalized.split(' ');
  const keywords: string[] = [];
  
  for (const word of words) {
    // Skip short words, stopwords
    if (word.length < 4) continue;
    if (STOPWORDS.has(word)) continue;
    
    // Include if relevant term OR appears to be a location/proper noun
    if (RELEVANT_TERMS.has(word) || /^[A-Z]/.test(word)) {
      keywords.push(word);
    }
  }
  
  return keywords;
}

/**
 * Calculate keyword frequencies in a time window
 */
function calculateFrequencies(
  events: CrisisEvent[],
  nowMs: number,
  windowMs: number
): Map<string, number> {
  const frequencies = new Map<string, number>();
  
  for (const event of events) {
    const eventTime = new Date(event.time).getTime();
    if (nowMs - eventTime > windowMs) continue;
    
    const text = `${event.title} ${event.description ?? ''}`;
    const keywords = extractKeywords(text);
    
    // Weight by severity
    const weight = Math.max(0.5, event.severityScore / 100);
    
    for (const keyword of keywords) {
      frequencies.set(keyword, (frequencies.get(keyword) ?? 0) + weight);
    }
  }
  
  return frequencies;
}

/**
 * Determine confidence level based on data quality
 */
function getConfidence(
  recentCount: number,
  baselineCount: number,
  spike: number
): 'low' | 'medium' | 'high' {
  // High confidence: strong spike + sufficient data
  if (spike >= 3.0 && recentCount >= 5) return 'high';
  if (spike >= 2.0 && recentCount >= 10) return 'high';
  
  // Medium confidence: moderate spike or decent data
  if (spike >= 2.0 && recentCount >= 3) return 'medium';
  if (spike >= 1.8 && baselineCount >= 5) return 'medium';
  
  // Low confidence: weak spike or limited data
  return 'low';
}

/**
 * Detect trending keywords with spike analysis
 */
export function detectTrends(
  events: CrisisEvent[],
  opts?: { 
    nowMs?: number;
    recentWindowMs?: number;
    baselineWindowMs?: number;
    minSpikeRatio?: number;
    limit?: number;
  }
): TrendingKeyword[] {
  const nowMs = opts?.nowMs ?? Date.now();
  const recentWindowMs = opts?.recentWindowMs ?? RECENT_WINDOW_MS;
  const baselineWindowMs = opts?.baselineWindowMs ?? BASELINE_WINDOW_MS;
  const minSpikeRatio = opts?.minSpikeRatio ?? MIN_SPIKE_RATIO;
  const limit = opts?.limit ?? 20;
  
  // Calculate recent frequencies (last 2 hours)
  const recentFreq = calculateFrequencies(events, nowMs, recentWindowMs);
  
  // Calculate baseline frequencies (last 7 days)
  const baselineFreq = calculateFrequencies(events, nowMs, baselineWindowMs);
  
  // Detect spikes
  const trends: TrendingKeyword[] = [];
  
  for (const [keyword, recentCount] of recentFreq.entries()) {
    if (recentCount < MIN_RECENT_COUNT) continue;
    
    const baselineCount = baselineFreq.get(keyword) ?? 0.1; // avoid division by zero
    
    // Normalize to per-hour rate for fair comparison
    const recentRate = recentCount / (recentWindowMs / 3600000); // events per hour
    const baselineRate = baselineCount / (baselineWindowMs / 3600000);
    
    const spike = recentRate / Math.max(0.01, baselineRate);
    
    if (spike >= minSpikeRatio) {
      // Count actual events (not weighted)
      const eventCount = events.filter(e => {
        const eventTime = new Date(e.time).getTime();
        if (nowMs - eventTime > recentWindowMs) return false;
        const text = `${e.title} ${e.description ?? ''}`.toLowerCase();
        return text.includes(keyword);
      }).length;
      
      trends.push({
        keyword,
        currentFrequency: Math.round(recentCount * 10) / 10,
        baselineFrequency: Math.round(baselineCount * 10) / 10,
        spike: Math.round(spike * 10) / 10,
        eventCount,
        confidence: getConfidence(recentCount, baselineCount, spike)
      });
    }
  }
  
  // Sort by spike ratio (descending)
  trends.sort((a, b) => b.spike - a.spike);
  
  return trends.slice(0, limit);
}

/**
 * Get top trending keywords
 */
export function getTopTrends(
  events: CrisisEvent[],
  limit: number = 10
): TrendingKeyword[] {
  return detectTrends(events, { limit });
}

/**
 * Check if a keyword is currently trending
 */
export function isTrending(
  keyword: string,
  events: CrisisEvent[],
  minSpikeRatio: number = 1.5
): boolean {
  const trends = detectTrends(events, { minSpikeRatio });
  return trends.some(t => t.keyword.toLowerCase() === keyword.toLowerCase());
}

/**
 * Get trend history for a specific keyword over time windows
 */
export function getKeywordHistory(
  keyword: string,
  events: CrisisEvent[],
  windowCount: number = 12,
  windowSizeMs: number = 3600000 // 1 hour
): Array<{ timestamp: string; frequency: number }> {
  const nowMs = Date.now();
  const history: Array<{ timestamp: string; frequency: number }> = [];
  
  for (let i = 0; i < windowCount; i++) {
    const windowEnd = nowMs - (i * windowSizeMs);
    const windowStart = windowEnd - windowSizeMs;
    
    let count = 0;
    for (const event of events) {
      const eventTime = new Date(event.time).getTime();
      if (eventTime >= windowStart && eventTime < windowEnd) {
        const text = `${event.title} ${event.description ?? ''}`.toLowerCase();
        if (text.includes(keyword.toLowerCase())) {
          count++;
        }
      }
    }
    
    history.unshift({
      timestamp: new Date(windowEnd).toISOString(),
      frequency: count
    });
  }
  
  return history;
}
