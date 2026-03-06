import { useState } from 'react';
import type { CrisisEvent, CrisisLayer } from '../core/types';

function layerIcon(layer: string): string {
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function friendlyType(layer: string): string {
  const names: Record<string, string> = {
    earthquakes: 'Earthquake',
    wildfires: 'Wildfire',
    floods: 'Flood',
    storms: 'Storm',
    conflicts: 'Conflict',
    airspace: 'Air Traffic',
    volcanoes: 'Volcano',
  };
  return names[layer] ?? layer;
}

const FILTERS: Array<{ id: CrisisLayer | 'all'; label: string; icon: string }> = [
  { id: 'all', label: 'All', icon: '🌍' },
  { id: 'earthquakes', label: 'Quakes', icon: '🌋' },
  { id: 'wildfires', label: 'Fires', icon: '🔥' },
  { id: 'floods', label: 'Floods', icon: '🌊' },
  { id: 'storms', label: 'Storms', icon: '⛈️' },
  { id: 'airspace', label: 'Flights', icon: '✈️' },
];

export function EventsPanel(props: {
  events: CrisisEvent[];
  selectedEventId: string | null;
  onPick: (id: string) => void;
}) {
  const [filter, setFilter] = useState<CrisisLayer | 'all'>('all');

  const filtered = filter === 'all'
    ? props.events
    : props.events.filter(e => e.layer === filter);

  const rows = [...filtered]
    .sort((a, b) => b.severityScore - a.severityScore)
    .slice(0, 60);

  return (
    <div className="cm-events-panel">
      {/* Simple filter chips */}
      <div className="cm-filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`cm-filter-chip${filter === f.id ? ' active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      {/* Event count */}
      <div className="cm-events-count">
        {rows.length} event{rows.length !== 1 ? 's' : ''}
        {filter !== 'all' ? ` · ${friendlyType(filter)}` : ''}
      </div>

      {/* Event list */}
      {rows.length === 0 ? (
        <div className="cm-empty-state">
          <div className="cm-empty-icon">📡</div>
          <p>Scanning for events…</p>
        </div>
      ) : (
        <div className="cm-event-list">
          {rows.map((e) => (
            <button
              key={e.id}
              className={`cm-event-card${props.selectedEventId === e.id ? ' selected' : ''}`}
              onClick={() => props.onPick(e.id)}
            >
              <span className="cm-event-card-icon">{layerIcon(e.layer)}</span>
              <div className="cm-event-card-body">
                <div className="cm-event-card-title">{e.title}</div>
                <div className="cm-event-card-meta">
                  {e.place ?? `${e.lat.toFixed(1)}°, ${e.lon.toFixed(1)}°`}
                  <span className="cm-meta-dot">·</span>
                  {timeAgo(e.time)}
                </div>
              </div>
              <div className={`cm-sev-dot ${e.severityLabel}`} title={e.severityLabel} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
