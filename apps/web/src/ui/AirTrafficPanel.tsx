import type { FeedResponse } from '../core/types';

export function AirTrafficPanel(props: { aggregates: FeedResponse['aggregates'] | undefined }) {
  const rows = props.aggregates?.airTrafficDisruptions ?? [];
  if (rows.length === 0) return <div className="cm-empty">No disruptions detected.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rows.map((r) => (
        <div key={r.name} className="cm-table-row">
          <span className="row-label">{r.name}</span>
          <span className="row-sub">{r.count} cells</span>
          <span className="row-value">{Math.round(r.severity)}</span>
        </div>
      ))}
    </div>
  );
}
