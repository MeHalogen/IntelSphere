import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type PredictiveSignal = {
  region: string;
  signalType: 'escalation' | 'swarm' | 'cascade' | 'convergence';
  description: string;
  confidence: number;
  recommendedAction: string;
  triggerEvents: Array<{ title: string; layer: string }>;
};

export function PredictiveSignalsPanel() {
  const { data } = useSWR<{ data: PredictiveSignal[] }>('/api/intelligence/signals', fetcher, {
    refreshInterval: 45_000
  });

  if (!data?.data) {
    return (
      <div className="intelligence-panel loading">
        <div className="panel-header">
          <h3>🎯 Predictive Signals</h3>
        </div>
        <div className="panel-body">
          <div className="loading-spinner">Loading...</div>
        </div>
      </div>
    );
  }

  const signals = data.data.slice(0, 8);

  if (signals.length === 0) {
    return (
      <div className="intelligence-panel signals-panel">
        <div className="panel-header">
          <h3>🎯 Predictive Signals</h3>
        </div>
        <div className="panel-body">
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <p>No early warning signals detected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="intelligence-panel signals-panel">
      <div className="panel-header">
        <h3>🎯 Predictive Signals</h3>
        <span className="panel-count">{signals.length} warnings</span>
      </div>
      <div className="panel-body">
        <div className="signals-list">
          {signals.map((signal, idx) => {
            const typeIcons = {
              escalation: '📈',
              swarm: '⚡',
              cascade: '🌊',
              convergence: '🎯'
            };

            const confidenceColor = 
              signal.confidence >= 80 ? '#ef4444' :
              signal.confidence >= 60 ? '#fb923c' : '#fbbf24';

            return (
              <div key={idx} className="signal-item">
                <div className="signal-header">
                  <span className="signal-icon">{typeIcons[signal.signalType]}</span>
                  <span className="signal-type">{signal.signalType.toUpperCase()}</span>
                  <span 
                    className="signal-confidence" 
                    style={{ color: confidenceColor }}
                  >
                    {signal.confidence}%
                  </span>
                </div>
                <div className="signal-region">{signal.region}</div>
                <div className="signal-description">{signal.description}</div>
                <div className="signal-action">
                  <strong>Action:</strong> {signal.recommendedAction}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
