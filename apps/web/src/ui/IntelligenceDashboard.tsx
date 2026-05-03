/**
 * Intelligence Dashboard
 * 
 * Consolidated view of all intelligence analysis panels
 */

import { GlobalRiskPanel } from './GlobalRiskPanel';
import { TopRiskRegionsPanel } from './TopRiskRegionsPanel';
import { TrendingSignalsPanel } from './TrendingSignalsPanel';
import { AIGlobalBriefPanel } from './AIGlobalBriefPanel';
import { CorrelationZonesPanel } from './CorrelationZonesPanel';
import { CrisisTimelinePanel } from './CrisisTimelinePanel';
import { PredictiveSignalsPanel } from './PredictiveSignalsPanel';
import { LiveFlightsPanel } from './LiveFlightsPanel';

export function IntelligenceDashboard() {
  return (
    <div className="intelligence-dashboard">
      <div className="dashboard-header">
        <h2 className="dashboard-title">🧠 Intelligence Analysis</h2>
        <p className="dashboard-subtitle">
          Advanced pattern detection, correlation analysis, and predictive insights
        </p>
      </div>

      <div className="dashboard-grid">
        {/* Top Row: Key Metrics */}
        <div className="grid-item span-2">
          <GlobalRiskPanel />
        </div>
        <div className="grid-item span-2">
          <AIGlobalBriefPanel />
        </div>

        {/* Second Row: Regional Analysis */}
        <div className="grid-item">
          <TopRiskRegionsPanel />
        </div>
        <div className="grid-item">
          <TrendingSignalsPanel />
        </div>

        {/* Third Row: Advanced Analytics */}
        <div className="grid-item">
          <CorrelationZonesPanel />
        </div>
        <div className="grid-item">
          <PredictiveSignalsPanel />
        </div>

        {/* Fourth Row: Live Flight Tracking */}
        <div className="grid-item span-2">
          <LiveFlightsPanel />
        </div>

        {/* Fifth Row: Timeline Analysis */}
        <div className="grid-item span-2">
          <CrisisTimelinePanel />
        </div>
      </div>
    </div>
  );
}
