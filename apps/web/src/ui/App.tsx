import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import { MapView } from './MapView';
import { EventsPanel } from './EventsPanel';
import { IntelligencePanel } from './IntelligencePanel';
import { useUiStore } from './store';
import type { CrisisEvent, FeedResponse } from '../core/types';
import { onEventsUpdated, startPolling, stopPolling } from '../data/pollEvents';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function App() {
  const { activeLayers, selectedEventId, selectEvent, events: polledEvents, eventsUpdatedAt, setEvents } = useUiStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tab, setTab] = useState<'events' | 'details'>('events');

  const { data: feed } = useSWR<FeedResponse>(
    `/api/feed?layers=${encodeURIComponent(activeLayers.join(','))}&limit=5000`,
    fetcher,
    { refreshInterval: 20_000 }
  );

  useEffect(() => {
    const unsub = onEventsUpdated((payload) => {
      setEvents(payload.events, payload.timestamp);
    });
    startPolling();
    return () => { unsub(); stopPolling(); };
  }, [setEvents]);

  const events = polledEvents.length ? polledEvents : (feed?.events ?? []);

  const selected = useMemo<CrisisEvent | null>(() => {
    if (!selectedEventId) return null;
    return events.find((e: CrisisEvent) => e.id === selectedEventId) ?? null;
  }, [events, selectedEventId]);

  // Auto-switch to details tab when an event is selected
  useEffect(() => {
    if (selected) setTab('details');
  }, [selected]);

  const handlePick = (id: string) => {
    selectEvent(id);
    setTab('details');
    if (!sidebarOpen) setSidebarOpen(true);
  };

  const handleCloseDetails = () => {
    selectEvent(null);
    setTab('events');
  };

  return (
    <div className={`cm-app${sidebarOpen ? '' : ' sidebar-collapsed'}`}>
      {/* ── TOP BAR ── */}
      <header className="cm-topbar">
        <div className="cm-brand">
          <div className="cm-brand-logo" />
          <span className="cm-brand-name">Crisis Monitor</span>
        </div>

        <div className="cm-topbar-right">
          <div className="cm-live-badge">
            <span className="cm-live-dot" />
            Live
          </div>
          <div className="cm-event-count">
            {events.length} events tracked
          </div>
          <button
            className="cm-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* ── MAP (always visible, takes remaining space) ── */}
      <main className="cm-map-container">
        <MapView
          events={events}
          selectedEvent={selected}
          onPick={handlePick}
          onCloseCard={handleCloseDetails}
        />
      </main>

      {/* ── SIDEBAR ── */}
      {sidebarOpen && (
        <aside className="cm-sidebar">
          <div className="cm-tabs">
            <button
              className={`cm-tab${tab === 'events' ? ' active' : ''}`}
              onClick={() => setTab('events')}
            >
              🌍 Events
            </button>
            <button
              className={`cm-tab${tab === 'details' ? ' active' : ''}`}
              onClick={() => setTab('details')}
              disabled={!selected}
            >
              📋 Details
            </button>
          </div>

          <div className="cm-sidebar-body">
            {tab === 'events' && (
              <EventsPanel
                events={events}
                onPick={handlePick}
                selectedEventId={selectedEventId}
              />
            )}
            {tab === 'details' && selected && (
              <div className="cm-details-view">
                <div className="cm-details-header">
                  <div className="cm-details-icon">{layerIcon(selected.layer)}</div>
                  <div className="cm-details-info">
                    <h2 className="cm-details-title">{selected.title}</h2>
                    <p className="cm-details-location">
                      📍 {selected.place ?? `${selected.lat.toFixed(2)}°, ${selected.lon.toFixed(2)}°`}
                    </p>
                    <p className="cm-details-time">
                      🕐 {timeAgo(selected.time)}
                    </p>
                  </div>
                </div>

                {selected.description && (
                  <div className="cm-details-section">
                    <p className="cm-details-desc">{selected.description}</p>
                  </div>
                )}

                <div className="cm-details-section">
                  <div className={`cm-severity-pill ${selected.severityLabel}`}>
                    {selected.severityLabel === 'critical' ? '🔴' :
                     selected.severityLabel === 'high' ? '🟠' :
                     selected.severityLabel === 'medium' ? '🟡' : '🟢'}{' '}
                    {selected.severityLabel.charAt(0).toUpperCase() + selected.severityLabel.slice(1)} severity
                  </div>
                </div>

                {(selected.links?.url || selected.links?.news) && (
                  <div className="cm-details-section">
                    <h3 className="cm-section-title">Learn More</h3>
                    <div className="cm-links-list">
                      {selected.links.url && (
                        <a href={selected.links.url} target="_blank" rel="noreferrer" className="cm-link-pill">
                          🔗 Source
                        </a>
                      )}
                      {selected.links.news && (
                        <a href={selected.links.news} target="_blank" rel="noreferrer" className="cm-link-pill">
                          📰 News
                        </a>
                      )}
                      {selected.links.satellite && (
                        <a href={selected.links.satellite} target="_blank" rel="noreferrer" className="cm-link-pill">
                          🛰 Satellite
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div className="cm-details-section">
                  <h3 className="cm-section-title">AI Analysis</h3>
                  <IntelligencePanel selectedEvent={selected} />
                </div>

                <button className="cm-back-btn" onClick={handleCloseDetails}>
                  ← Back to events
                </button>
              </div>
            )}
            {tab === 'details' && !selected && (
              <div className="cm-empty-state">
                <div className="cm-empty-icon">🗺️</div>
                <p>Click an event on the map or list to see details</p>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

/* ── Helpers ── */
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
