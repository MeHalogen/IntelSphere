import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Hotspot = {
  region: string;
  riskScore: number;
  eventCount: number;
  averageSeverity: number;
  recentActivity: number;
  dominantLayers: string[];
};

export function TopRiskRegionsPanel() {
  const { data } = useSWR<{ data: Hotspot[] }>('/api/intelligence/hotspots-api', fetcher, {
    refreshInterval: 45_000
  });

  if (!data?.data) {
    return (
      <div className="intelligence-panel loading">
        <div className="panel-header">
          <h3>🔥 Top Risk Regions</h3>
        </div>
        <div className="panel-body">
          <div className="loading-spinner">Loading...</div>
        </div>
      </div>
    );
  }

  const hotspots = data.data.slice(0, 10);

  return (
    <div className="intelligence-panel top-risks-panel">
      <div className="panel-header">
        <h3>🔥 Top Risk Regions</h3>
        <span className="panel-count">{hotspots.length} regions</span>
      </div>
      <div className="panel-body">
        <div className="hotspots-list">
          {hotspots.map((hotspot, idx) => {
            const riskColor = 
              hotspot.riskScore >= 80 ? '#ef4444' :
              hotspot.riskScore >= 65 ? '#fb923c' :
              hotspot.riskScore >= 50 ? '#fbbf24' : '#4ade80';

            return (
              <div key={idx} className="hotspot-item">
                <div className="hotspot-rank">#{idx + 1}</div>
                <div className="hotspot-info">
                  <div className="hotspot-region">{hotspot.region}</div>
                  <div className="hotspot-meta">
                    {hotspot.eventCount} events • {hotspot.dominantLayers.slice(0, 2).join(', ')}
                  </div>
                </div>
                <div className="hotspot-score" style={{ color: riskColor }}>
                  {hotspot.riskScore.toFixed(0)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
