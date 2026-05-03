import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type RegionalTimeline = {
  region: string;
  eventCount: number;
  severityTrend: 'increasing' | 'stable' | 'decreasing';
  activityAcceleration: number;
  escalationDetected: boolean;
  escalationPattern?: string;
  timeline: Array<{
    timestamp: string;
    eventType: string;
    title: string;
    severity: number;
    escalation?: boolean;
  }>;
};

export function CrisisTimelinePanel() {
  const { data } = useSWR<{ data: RegionalTimeline[] }>('/api/intelligence/timeline-api', fetcher, {
    refreshInterval: 60_000
  });

  if (!data?.data) {
    return (
      <div className="intelligence-panel loading">
        <div className="panel-header">
          <h3>⏱️ Crisis Timelines</h3>
        </div>
        <div className="panel-body">
          <div className="loading-spinner">Loading...</div>
        </div>
      </div>
    );
  }

  const timelines = data.data.slice(0, 6);

  if (timelines.length === 0) {
    return (
      <div className="intelligence-panel timeline-panel">
        <div className="panel-header">
          <h3>⏱️ Crisis Timelines</h3>
        </div>
        <div className="panel-body">
          <div className="empty-state">
            <div className="empty-icon">✓</div>
            <p>No regional escalation patterns detected</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="intelligence-panel timeline-panel">
      <div className="panel-header">
        <h3>⏱️ Crisis Timelines</h3>
        <span className="panel-count">{timelines.length} regions</span>
      </div>
      <div className="panel-body">
        <div className="timelines-list">
          {timelines.map((tl, idx) => {
            const trendIcon = {
              increasing: '📈',
              stable: '➡️',
              decreasing: '📉'
            }[tl.severityTrend];

            const trendColor = {
              increasing: '#ef4444',
              stable: '#fbbf24',
              decreasing: '#4ade80'
            }[tl.severityTrend];

            return (
              <div key={idx} className="timeline-item">
                <div className="timeline-header">
                  <div className="timeline-region">{tl.region}</div>
                  {tl.escalationDetected && (
                    <span className="escalation-badge">⚠️ ESCALATION</span>
                  )}
                </div>
                <div className="timeline-stats">
                  <span className="timeline-stat">
                    {tl.eventCount} events
                  </span>
                  <span className="timeline-stat" style={{ color: trendColor }}>
                    {trendIcon} {tl.severityTrend}
                  </span>
                  {tl.activityAcceleration > 0.5 && (
                    <span className="timeline-stat acceleration">
                      ⚡ +{tl.activityAcceleration.toFixed(1)} ev/h
                    </span>
                  )}
                </div>
                {tl.escalationPattern && (
                  <div className="timeline-pattern">
                    Pattern: {tl.escalationPattern.replace(/-/g, ' ')}
                  </div>
                )}
                <div className="timeline-events">
                  {tl.timeline.slice(-3).map((event, eventIdx) => (
                    <div key={eventIdx} className="timeline-event">
                      <span className="event-type-icon">
                        {getLayerIcon(event.eventType)}
                      </span>
                      <span className="event-title">{event.title}</span>
                      {event.escalation && <span className="escalation-marker">⚠️</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getLayerIcon(layer: string): string {
  const icons: Record<string, string> = {
    earthquakes: '🌋',
    wildfires: '🔥',
    floods: '🌊',
    storms: '⛈️',
    conflicts: '⚠️',
    airspace: '✈️',
    volcanoes: '🌋',
  };
  return icons[layer] ?? '📍';
}
