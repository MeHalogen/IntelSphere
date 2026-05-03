import { useState, useEffect } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type GlobalRisk = {
  globalRiskScore: number;
  level: 'low' | 'elevated' | 'high' | 'critical';
  components: {
    activeCrises: number;
    averageSeverity: number;
    correlationClusters: number;
    trendingSignals: number;
  };
  comparedToBaseline: {
    change: number;
    direction: 'up' | 'down' | 'stable';
  };
};

export function GlobalRiskPanel() {
  const { data } = useSWR<{ data: GlobalRisk }>('/api/intelligence/global-risk', fetcher, {
    refreshInterval: 60_000
  });

  if (!data?.data) {
    return (
      <div className="intelligence-panel loading">
        <div className="panel-header">
          <h3>🌐 Global Risk Score</h3>
        </div>
        <div className="panel-body">
          <div className="loading-spinner">Loading...</div>
        </div>
      </div>
    );
  }

  const risk = data.data;
  const levelColor = {
    low: '#4ade80',
    elevated: '#fbbf24',
    high: '#fb923c',
    critical: '#ef4444'
  }[risk.level];

  const trendIcon = {
    up: '📈',
    down: '📉',
    stable: '➡️'
  }[risk.comparedToBaseline.direction];

  return (
    <div className="intelligence-panel global-risk-panel">
      <div className="panel-header">
        <h3>🌐 Global Risk Score</h3>
      </div>
      <div className="panel-body">
        <div className="risk-score-display">
          <div 
            className="risk-score-number" 
            style={{ color: levelColor }}
          >
            {risk.globalRiskScore}
          </div>
          <div className="risk-level" style={{ color: levelColor }}>
            {risk.level.toUpperCase()}
          </div>
          {risk.comparedToBaseline.change !== 0 && (
            <div className="risk-trend">
              {trendIcon} {Math.abs(risk.comparedToBaseline.change).toFixed(1)}% vs baseline
            </div>
          )}
        </div>

        <div className="risk-components">
          <div className="component-item">
            <span className="component-label">Active Crises</span>
            <span className="component-value">{risk.components.activeCrises}</span>
          </div>
          <div className="component-item">
            <span className="component-label">Avg Severity</span>
            <span className="component-value">{risk.components.averageSeverity.toFixed(1)}</span>
          </div>
          <div className="component-item">
            <span className="component-label">Correlation Zones</span>
            <span className="component-value">{risk.components.correlationClusters}</span>
          </div>
          <div className="component-item">
            <span className="component-label">Trending Signals</span>
            <span className="component-value">{risk.components.trendingSignals}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
