// Shared intelligence types for advanced analytics

import type { CrisisEvent, CrisisLayer } from '../_lib/types';

/**
 * Geographic bin for spatial clustering (1° lat/lon grid)
 */
export type GeoBin = {
  latBin: number;
  lonBin: number;
  key: string; // "lat,lon"
};

/**
 * Correlation cluster: multiple event types in close proximity
 */
export type CorrelationCluster = {
  location: { lat: number; lon: number };
  eventTypes: CrisisLayer[];
  severityScore: number;
  events: CrisisEvent[];
  timeWindow: { start: string; end: string };
  clusterSize: number;
};

/**
 * Hotspot: region with elevated risk
 */
export type Hotspot = {
  region: string;
  location: { lat: number; lon: number };
  riskScore: number;
  eventCount: number;
  averageSeverity: number;
  recentActivity: number; // events in last 24h
  populationExposure: number; // 0-100
  dominantLayers: CrisisLayer[];
};

/**
 * Trending keyword with spike detection
 */
export type TrendingKeyword = {
  keyword: string;
  currentFrequency: number;
  baselineFrequency: number;
  spike: number; // ratio: current / baseline
  eventCount: number;
  confidence: 'low' | 'medium' | 'high';
};

/**
 * Global intelligence brief
 */
export type GlobalBrief = {
  headline: string;
  summary: string;
  risks: string[];
  watchRegions: string[];
  keyMetrics: {
    totalEvents: number;
    criticalEvents: number;
    activeRegions: number;
  };
  generatedAt: string;
  model?: string;
};

/**
 * Timeline event for a region
 */
export type TimelineEntry = {
  timestamp: string;
  eventType: CrisisLayer;
  title: string;
  severity: number;
  escalation?: boolean;
};

/**
 * Regional timeline analysis
 */
export type RegionalTimeline = {
  region: string;
  location: { lat: number; lon: number };
  timeline: TimelineEntry[];
  eventCount: number;
  severityTrend: 'increasing' | 'stable' | 'decreasing';
  activityAcceleration: number; // events per hour rate change
  escalationDetected: boolean;
  escalationPattern?: string;
};

/**
 * Global risk assessment
 */
export type GlobalRisk = {
  globalRiskScore: number; // 0-100
  level: 'low' | 'elevated' | 'high' | 'critical';
  components: {
    activeCrises: number;
    averageSeverity: number;
    correlationClusters: number;
    trendingSignals: number;
  };
  comparedToBaseline: {
    change: number; // percentage
    direction: 'up' | 'down' | 'stable';
  };
  generatedAt: string;
};

/**
 * Predictive signal: early warning
 */
export type PredictiveSignal = {
  region: string;
  location: { lat: number; lon: number };
  signalType: 'escalation' | 'swarm' | 'cascade' | 'convergence';
  description: string;
  confidence: number; // 0-100
  triggerEvents: CrisisEvent[];
  timeWindow: { start: string; end: string };
  recommendedAction: string;
};

/**
 * Intelligence API response wrapper
 */
export type IntelligenceResponse<T> = {
  data: T;
  generatedAt: string;
  computeTimeMs: number;
  eventCount: number;
};
