import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type CorrelationCluster = {
  location: { lat: number; lon: number };
  eventTypes: string[];
  severityScore: number;
  clusterSize: number;
  timeWindow: { start: string; end: string };
};

export function CorrelationZonesPanel() {
  const { data } = useSWR<{ data: CorrelationCluster[] }>('/api/intelligence/correlations', fetcher, {
    refreshInterval: 45_000
  });

  if (!data?.data) {
    return (
      <div className="intelligence-panel loading">
        <div className="panel-header">
          <h3>🔗 Correlation Zones</h3>
        </div>
        <div className="panel-body">
          <div className="loading-spinner">Loading...</div>
        </div>
      </div>
    );
  }

  const clusters = data.data.slice(0, 8);

  if (clusters.length === 0) {
    return (
      <div className="intelligence-panel correlation-panel">
        <div className="panel-header">
          <h3>🔗 Correlation Zones</h3>
        </div>
        <div className="panel-body">
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <p>No multi-event correlation zones detected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="intelligence-panel correlation-panel">
      <div className="panel-header">
        <h3>🔗 Correlation Zones</h3>
        <span className="panel-count">{clusters.length} zones</span>
      </div>
      <div className="panel-body">
        <div className="correlations-list">
          {clusters.map((cluster, idx) => {
            const severityColor = 
              cluster.severityScore >= 80 ? '#ef4444' :
              cluster.severityScore >= 65 ? '#fb923c' : '#fbbf24';

            const location = `${cluster.location.lat.toFixed(1)}°, ${cluster.location.lon.toFixed(1)}°`;

            return (
              <div key={idx} className="correlation-item">
                <div className="correlation-severity" style={{ background: severityColor }}>
                  {cluster.severityScore.toFixed(0)}
                </div>
                <div className="correlation-info">
                  <div className="correlation-location">{location}</div>
                  <div className="correlation-types">
                    {cluster.eventTypes.join(' + ')}
                  </div>
                  <div className="correlation-meta">
                    {cluster.clusterSize} events in cluster
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
