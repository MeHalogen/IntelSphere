import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type TrendingKeyword = {
  keyword: string;
  currentFrequency: number;
  baselineFrequency: number;
  spike: number;
  eventCount: number;
  confidence: 'low' | 'medium' | 'high';
};

export function TrendingSignalsPanel() {
  const { data } = useSWR<{ data: TrendingKeyword[] }>('/api/intelligence/trends-api', fetcher, {
    refreshInterval: 60_000
  });

  if (!data?.data) {
    return (
      <div className="intelligence-panel loading">
        <div className="panel-header">
          <h3>📊 Trending Signals</h3>
        </div>
        <div className="panel-body">
          <div className="loading-spinner">Loading...</div>
        </div>
      </div>
    );
  }

  const trends = data.data.slice(0, 12);

  return (
    <div className="intelligence-panel trending-panel">
      <div className="panel-header">
        <h3>📊 Trending Signals</h3>
        <span className="panel-count">{trends.length} keywords</span>
      </div>
      <div className="panel-body">
        <div className="trends-list">
          {trends.map((trend, idx) => {
            const spikeColor = 
              trend.spike >= 3.0 ? '#ef4444' :
              trend.spike >= 2.0 ? '#fb923c' :
              trend.spike >= 1.5 ? '#fbbf24' : '#4ade80';

            const confidenceBadge = {
              high: '🔴',
              medium: '🟡',
              low: '⚪'
            }[trend.confidence];

            return (
              <div key={idx} className="trend-item">
                <div className="trend-keyword">
                  {confidenceBadge} {trend.keyword}
                </div>
                <div className="trend-meta">
                  {trend.eventCount} events
                </div>
                <div className="trend-spike" style={{ color: spikeColor }}>
                  {trend.spike.toFixed(1)}x ↑
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
