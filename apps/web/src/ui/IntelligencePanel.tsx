import useSWR from 'swr';
import type { AiBrief, CrisisEvent } from '../core/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function IntelligencePanel(props: { selectedEvent: CrisisEvent | null }) {
  const id = props.selectedEvent?.id;
  const { data, isLoading } = useSWR<AiBrief>(id ? `/api/ai/brief?eventId=${encodeURIComponent(id)}` : null, fetcher);

  if (!props.selectedEvent) {
    return (
      <div className="cm-empty-state small">
        <p>Select an event to get an AI analysis.</p>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="cm-ai-loading">
        <div className="cm-ai-spinner" />
        <span>Analyzing event…</span>
      </div>
    );
  }

  if (!data) {
    return <div className="cm-empty-state small"><p>Analysis unavailable.</p></div>;
  }

  return (
    <div className="cm-ai-brief">
      <div className="cm-ai-block">
        <p>{data.shortBrief}</p>
      </div>

      {data.keyRisks.length > 0 && (
        <div className="cm-ai-block">
          <h4>⚡ Key Risks</h4>
          <ul>
            {data.keyRisks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {data.expectedImpact.length > 0 && (
        <div className="cm-ai-block">
          <h4>📊 Expected Impact</h4>
          <ul>
            {data.expectedImpact.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {data.recommendedMonitoringActions.length > 0 && (
        <div className="cm-ai-block">
          <h4>✅ What to Watch</h4>
          <ul>
            {data.recommendedMonitoringActions.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
