export type CrisisLayer =
  | 'earthquakes'
  | 'wildfires'
  | 'floods'
  | 'storms'
  | 'conflicts'
  | 'airspace'
  | 'volcanoes';

export type CrisisEvent = {
  id: string;
  source: string;
  layer: CrisisLayer;
  title: string;
  description?: string;
  time: string; // ISO
  lat: number;
  lon: number;
  place?: string;
  severityScore: number; // 0-100
  severityLabel: 'low' | 'medium' | 'high' | 'critical';
  metrics?: Record<string, number | string | boolean | null>;
  links?: {
    url?: string;
    news?: string;
    satellite?: string;
  };
};

export type AiBrief = {
  shortBrief: string;
  keyRisks: string[];
  expectedImpact: string[];
  recommendedMonitoringActions: string[];
  model?: string;
  generatedAt: string;
};

export type FeedResponse = {
  generatedAt: string;
  events: CrisisEvent[];
  aggregates?: {
    topRiskRegions: Array<{ name: string; severity: number; count: number }>;
    airTrafficDisruptions: Array<{ name: string; severity: number; count: number }>;
    trendingKeywords: Array<{ keyword: string; weight: number }>;
  };
};
