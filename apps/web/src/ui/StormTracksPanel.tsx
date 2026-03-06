import type { CrisisEvent } from '../core/types';

export function StormTracksPanel(props: { events: CrisisEvent[] }) {
  const storms = props.events.filter((e) => e.layer === 'storms').slice(0, 40);

  if (storms.length === 0) {
    return <div className="cm-empty">No storm track data available.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {storms.map((e) => (
        <div key={e.id} className="cm-table-row">
          <span className="row-label">{e.title}</span>
          <span className="row-sub">{e.place ?? `${e.lat.toFixed(1)}, ${e.lon.toFixed(1)}`}</span>
          <span className="row-value">{Math.round(e.severityScore)}</span>
        </div>
      ))}
    </div>
  );
}
