import type { CrisisEvent } from '../core/types';

export function SatelliteActivityPanel(props: { events: CrisisEvent[] }) {
  const sats = props.events.filter((e) => Boolean(e.links?.satellite)).slice(0, 20);

  if (sats.length === 0) {
    return <div className="cm-empty">No satellite imagery links in the current feed.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {sats.map((e) => (
        <a key={e.id} className="cm-table-row" href={e.links?.satellite} target="_blank" rel="noreferrer">
          <span className="row-label">{e.title}</span>
          <span className="row-sub">{e.place ?? `${e.lat.toFixed(1)}, ${e.lon.toFixed(1)}`}</span>
        </a>
      ))}
    </div>
  );
}
