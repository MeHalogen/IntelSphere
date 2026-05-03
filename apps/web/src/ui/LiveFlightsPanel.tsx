/**
 * Live Flights Panel
 * 
 * Real-time aircraft tracking using OpenSky Network data.
 * Displays individual flight positions, altitudes, speeds, and headings.
 */

import { useState, useMemo } from 'react';
import useSWR from 'swr';

interface OpenSkyFlight {
  icao24: string;
  callsign: string;
  origin_country: string;
  lat: number;
  lon: number;
  altitude: number;
  velocity: number;
  heading: number;
  vertical_rate: number;
  on_ground: boolean;
  squawk?: string;
  time_position: number;
}

interface FlightsResponse {
  flights: OpenSkyFlight[];
  count: number;
  timestamp: string;
  bounds: 'global' | { lamin: number; lomin: number; lamax: number; lomax: number };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const REGIONS = {
  global: { label: '🌍 Global', bounds: '' },
  'us-east': { label: '🇺🇸 US East', bounds: 'lamin=35&lomin=-85&lamax=45&lomax=-65' },
  'us-west': { label: '🇺🇸 US West', bounds: 'lamin=32&lomin=-125&lamax=49&lomax=-100' },
  europe: { label: '🇪🇺 Europe', bounds: 'lamin=40&lomin=-10&lamax=60&lomax=30' },
  asia: { label: '🌏 Asia', bounds: 'lamin=20&lomin=100&lamax=45&lomax=145' },
  'middle-east': { label: '🏜️ Middle East', bounds: 'lamin=20&lomin=30&lamax=40&lomax=60' },
};

type RegionKey = keyof typeof REGIONS;

export function LiveFlightsPanel() {
  const [region, setRegion] = useState<RegionKey>('global');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'altitude' | 'speed' | 'callsign'>('altitude');

  const url = region === 'global' 
    ? '/api/flights'
    : `/api/flights?${REGIONS[region].bounds}`;

  const { data, error, isLoading } = useSWR<FlightsResponse>(
    url,
    fetcher,
    { 
      refreshInterval: 30000, // Update every 30 seconds (OpenSky rate limit)
      dedupingInterval: 25000, // Prevent duplicate requests
      revalidateOnFocus: false, // Don't refetch on window focus
      shouldRetryOnError: false // Don't retry on 429 errors
    }
  );

  // Filter and sort flights
  const filteredFlights = useMemo(() => {
    if (!data?.flights) return [];

    let filtered = data.flights.filter(f => !f.on_ground); // Only show airborne

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(f => 
        f.callsign.toLowerCase().includes(term) ||
        f.icao24.toLowerCase().includes(term) ||
        f.origin_country.toLowerCase().includes(term)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'altitude':
          return b.altitude - a.altitude;
        case 'speed':
          return b.velocity - a.velocity;
        case 'callsign':
          return a.callsign.localeCompare(b.callsign);
        default:
          return 0;
      }
    });

    return filtered.slice(0, 100); // Limit to 100 for performance
  }, [data?.flights, searchTerm, sortBy]);

  const airborneCount = data?.flights.filter(f => !f.on_ground).length || 0;

  return (
    <div className="intel-panel">
      <div className="panel-header">
        <div className="panel-icon">✈️</div>
        <div className="panel-title-group">
          <h3 className="panel-title">Live Flight Tracking</h3>
          <p className="panel-subtitle">
            Real-time aircraft positions from OpenSky Network
          </p>
        </div>
      </div>

      {error && (
        <div className="panel-error">
          <p>⚠️ Failed to load flight data</p>
          <p className="error-detail">
            {error?.status === 429 
              ? 'Rate limit reached. OpenSky Network allows 1 request per 10 seconds. Please wait 30 seconds...'
              : error.message || String(error)
            }
          </p>
        </div>
      )}

      {isLoading && !data && (
        <div className="panel-loading">
          <div className="loading-spinner" />
          <p>Loading flights...</p>
        </div>
      )}

      {data && (
        <>
          {/* Stats Bar */}
          <div className="flights-stats">
            <div className="stat-item">
              <span className="stat-label">Total Flights</span>
              <span className="stat-value">{data.count.toLocaleString()}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Airborne</span>
              <span className="stat-value">{airborneCount.toLocaleString()}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Region</span>
              <span className="stat-value">{REGIONS[region].label}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Updated</span>
              <span className="stat-value">{timeAgo(data.timestamp)}</span>
            </div>
          </div>

          {/* Region Selector */}
          <div className="flights-controls">
            <div className="region-buttons">
              {(Object.keys(REGIONS) as RegionKey[]).map((key) => (
                <button
                  key={key}
                  className={`region-btn${region === key ? ' active' : ''}`}
                  onClick={() => setRegion(key)}
                  title={REGIONS[key].label}
                >
                  {REGIONS[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Search and Sort */}
          <div className="flights-filters">
            <input
              type="text"
              className="flight-search"
              placeholder="🔍 Search callsign, ICAO, country..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="flight-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="altitude">Sort by Altitude</option>
              <option value="speed">Sort by Speed</option>
              <option value="callsign">Sort by Callsign</option>
            </select>
          </div>

          {/* Flights List */}
          <div className="flights-list">
            {filteredFlights.length === 0 && (
              <div className="empty-state">
                <p>No flights found</p>
                {searchTerm && <p className="empty-hint">Try adjusting your search</p>}
              </div>
            )}

            {filteredFlights.map((flight) => (
              <div key={flight.icao24} className="flight-card">
                <div className="flight-header">
                  <div className="flight-callsign">
                    {flight.callsign.trim() || flight.icao24}
                  </div>
                  <div className="flight-country">
                    {flight.origin_country}
                  </div>
                </div>

                <div className="flight-metrics">
                  <div className="flight-metric">
                    <span className="metric-icon">📏</span>
                    <span className="metric-label">Altitude</span>
                    <span className="metric-value">
                      {formatAltitude(flight.altitude)}
                    </span>
                  </div>

                  <div className="flight-metric">
                    <span className="metric-icon">⚡</span>
                    <span className="metric-label">Speed</span>
                    <span className="metric-value">
                      {formatSpeed(flight.velocity)}
                    </span>
                  </div>

                  <div className="flight-metric">
                    <span className="metric-icon">🧭</span>
                    <span className="metric-label">Heading</span>
                    <span className="metric-value">
                      {Math.round(flight.heading)}°
                    </span>
                  </div>
                </div>

                <div className="flight-status">
                  {flight.vertical_rate > 1 && (
                    <span className="status-badge climbing">
                      ⬆️ Climbing {formatVerticalRate(flight.vertical_rate)}
                    </span>
                  )}
                  {flight.vertical_rate < -1 && (
                    <span className="status-badge descending">
                      ⬇️ Descending {formatVerticalRate(Math.abs(flight.vertical_rate))}
                    </span>
                  )}
                  {Math.abs(flight.vertical_rate) <= 1 && (
                    <span className="status-badge level">
                      ➡️ Level flight
                    </span>
                  )}
                  {flight.squawk && (
                    <span className="status-badge squawk">
                      📡 {flight.squawk}
                    </span>
                  )}
                </div>

                <div className="flight-position">
                  📍 {flight.lat.toFixed(3)}°, {flight.lon.toFixed(3)}°
                </div>
              </div>
            ))}

            {filteredFlights.length === 100 && (
              <div className="flights-limit-notice">
                Showing first 100 flights. Use search or regional filter to narrow results.
              </div>
            )}
          </div>

          {/* Live Update Indicator */}
          <div className="live-update-bar">
            <span className="live-indicator">
              <span className="live-dot pulsing" />
              Live updating every 10s
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Helpers ── */

function formatAltitude(meters: number): string {
  const feet = Math.round(meters * 3.28084);
  return `${feet.toLocaleString()} ft`;
}

function formatSpeed(metersPerSecond: number): string {
  const knots = Math.round(metersPerSecond * 1.94384);
  return `${knots} kts`;
}

function formatVerticalRate(metersPerSecond: number): string {
  const feetPerMin = Math.round(metersPerSecond * 196.85);
  return `${feetPerMin} fpm`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}
