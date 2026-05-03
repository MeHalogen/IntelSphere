import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type GlobalBrief = {
  headline: string;
  summary: string;
  risks: string[];
  watchRegions: string[];
  keyMetrics: {
    totalEvents: number;
    criticalEvents: number;
    activeRegions: number;
  };
  model?: string;
};

export function AIGlobalBriefPanel() {
  const { data } = useSWR<{ data: GlobalBrief }>('/api/ai/global-brief-api', fetcher, {
    refreshInterval: 120_000 // refresh every 2 minutes
  });

  if (!data?.data) {
    return (
      <div className="intelligence-panel loading">
        <div className="panel-header">
          <h3>🤖 AI Global Brief</h3>
        </div>
        <div className="panel-body">
          <div className="loading-spinner">Generating intelligence brief...</div>
        </div>
      </div>
    );
  }

  const brief = data.data;

  return (
    <div className="intelligence-panel ai-brief-panel">
      <div className="panel-header">
        <h3>🤖 AI Global Brief</h3>
        {brief.model && (
          <span className="panel-badge">
            {brief.model.includes('gpt') ? '🧠 GPT' : '⚡ Groq'}
          </span>
        )}
      </div>
      <div className="panel-body">
        <div className="brief-headline">
          <h4>{brief.headline}</h4>
        </div>

        <div className="brief-summary">
          <p>{brief.summary}</p>
        </div>

        <div className="brief-metrics">
          <div className="metric-card">
            <div className="metric-value">{brief.keyMetrics.totalEvents}</div>
            <div className="metric-label">Total Events</div>
          </div>
          <div className="metric-card">
            <div className="metric-value critical">{brief.keyMetrics.criticalEvents}</div>
            <div className="metric-label">Critical</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{brief.keyMetrics.activeRegions}</div>
            <div className="metric-label">Regions</div>
          </div>
        </div>

        {brief.risks.length > 0 && (
          <div className="brief-section">
            <h5 className="section-title">⚠️ Key Risks</h5>
            <ul className="risk-list">
              {brief.risks.map((risk, idx) => (
                <li key={idx}>{risk}</li>
              ))}
            </ul>
          </div>
        )}

        {brief.watchRegions.length > 0 && (
          <div className="brief-section">
            <h5 className="section-title">👁️ Watch Regions</h5>
            <div className="watch-regions">
              {brief.watchRegions.map((region, idx) => (
                <span key={idx} className="region-badge">{region}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
