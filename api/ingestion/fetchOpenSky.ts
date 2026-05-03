import { fetchJson } from './fetchUtils';
import type { CrisisEvent } from './types';
import { getSeverity } from '../_lib/scoring';
import { calculateConfidenceScore, inferDataQualityIndicators } from '../_lib/confidence';

type OpenSkyStates = {
  time?: number;
  states?: any[];
};

/**
 * OpenSky state vector indices:
 * [0] icao24: string - Unique ICAO 24-bit address
 * [1] callsign: string - Aircraft callsign (flight number)
 * [2] origin_country: string - Country of registration
 * [3] time_position: number - Unix timestamp of position
 * [4] last_contact: number - Unix timestamp of last update
 * [5] longitude: number - WGS-84 longitude
 * [6] latitude: number - WGS-84 latitude
 * [7] baro_altitude: number - Barometric altitude in meters
 * [8] on_ground: boolean - Aircraft on ground
 * [9] velocity: number - Ground speed in m/s
 * [10] true_track: number - Heading in degrees
 * [11] vertical_rate: number - Climb rate in m/s
 * [12] sensors: number[] - Sensor IDs
 * [13] geo_altitude: number - Geometric altitude in meters
 * [14] squawk: string - Transponder code
 * [15] spi: boolean - Special purpose indicator
 * [16] position_source: number - 0=ADS-B, 1=ASTERIX, 2=MLAT
 */
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

interface AirTrafficCell {
  lat: number;
  lon: number;
  count: number;
  slow: number;
  altitudes: number[];
}

/**
 * Proper air traffic anomaly detection:
 * 1. Cluster aircraft into grid cells
 * 2. Calculate statistical baseline
 * 3. Detect anomalies (unusual density/patterns)
 * 4. Only report genuine disruptions
 */
export async function fetchOpenSky(): Promise<CrisisEvent[]> {
  const url = 'https://opensky-network.org/api/states/all';
  const json = await fetchJson<OpenSkyStates>(url, undefined, { timeoutMs: 8000, retries: 1 });

  const states: any[] = Array.isArray(json.states) ? json.states : [];

  // Step 1: Cluster aircraft into 0.5° grid cells
  const cells = new Map<string, AirTrafficCell>();

  for (const s of states) {
    const lon = Number(s[5]);
    const lat = Number(s[6]);
    const onGround = Boolean(s[8]);
    const vel = Number(s[9]);
    const alt = Number(s[7]); // barometric altitude in meters

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (onGround) continue; // Ignore grounded aircraft

    const isSlow = Number.isFinite(vel) && vel > 0 && vel < 60; // <216 km/h = holding pattern
    const key = `${Math.round(lat * 2) / 2}:${Math.round(lon * 2) / 2}`;
    const cur = cells.get(key) ?? {
      lat: Math.round(lat * 2) / 2,
      lon: Math.round(lon * 2) / 2,
      count: 0,
      slow: 0,
      altitudes: []
    };
    cur.count += 1;
    if (isSlow) cur.slow += 1;
    if (Number.isFinite(alt)) cur.altitudes.push(alt);
    cells.set(key, cur);
  }

  // Step 2: Calculate statistical baseline
  const densities = Array.from(cells.values()).map(c => c.count);
  if (densities.length === 0) return [];

  const mean = densities.reduce((sum, d) => sum + d, 0) / densities.length;
  const variance = densities.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / densities.length;
  const stdDev = Math.sqrt(variance);

  // Step 3: Detect anomalies (only report if 2+ standard deviations above mean)
  const anomalyThreshold = mean + 2 * stdDev;
  const now = new Date().toISOString();
  const out: CrisisEvent[] = [];

  for (const c of cells.values()) {
    // Anomaly detection criteria:
    const isHighDensity = c.count >= anomalyThreshold && c.count >= 30; // Statistical outlier + minimum threshold
    const hasHoldingPattern = c.slow >= 5 && c.slow / c.count > 0.3; // 30%+ in holding pattern
    const hasAltitudeStacking = c.altitudes.length >= 10 && detectAltitudeStacking(c.altitudes);

    // Only create event if genuine anomaly detected
    if (!isHighDensity && !hasHoldingPattern && !hasAltitudeStacking) continue;

    // Determine disruption type
    let title = 'Air Traffic Anomaly';
    let description = `Unusual airspace activity detected: ${c.count} aircraft.`;

    if (hasHoldingPattern) {
      title = 'Airport Holding Pattern';
      description = `${c.slow} aircraft in holding pattern (${Math.round(c.slow / c.count * 100)}% of traffic). Possible airport congestion or weather delays.`;
    } else if (hasAltitudeStacking) {
      title = 'Airspace Congestion';
      description = `Altitude stacking detected with ${c.count} aircraft. Possible ATC flow control.`;
    } else if (isHighDensity) {
      title = 'High-Density Airspace';
      description = `Abnormal aircraft density: ${c.count} aircraft (${Math.round((c.count - mean) / stdDev * 10) / 10}σ above normal).`;
    }

    const base = {
      id: `opensky:${c.lat.toFixed(2)}:${c.lon.toFixed(2)}`,
      source: 'opensky',
      layer: 'airspace' as const,
      title,
      description,
      time: now,
      lat: c.lat,
      lon: c.lon,
      metrics: {
        aircraftCount: c.count,
        holdingCount: c.slow,
        anomalyScore: Math.round((c.count - mean) / stdDev * 100) / 100
      },
      links: {
        url: 'https://opensky-network.org/',
        news: 'https://opensky-network.org/'
      }
    } satisfies Omit<CrisisEvent, 'severityScore' | 'severityLabel' | 'confidenceScore'>;

    const sev = getSeverity(base);
    const indicators = inferDataQualityIndicators(base);
    const confidence = calculateConfidenceScore(base, indicators);

    out.push({
      ...base,
      severityScore: sev.severityScore,
      severityLabel: sev.severityLabel,
      confidenceScore: confidence
    });
  }

  return out;
}

/**
 * Fetch individual flight positions (similar to OpenSky map display)
 * Returns all active flights with detailed position/velocity data
 * 
 * @param bounds - Optional geographic bounds to limit results
 * @returns Array of flight objects with callsign, position, altitude, speed
 */
export async function fetchOpenSkyFlights(bounds?: {
  lamin: number; // Min latitude
  lomin: number; // Min longitude
  lamax: number; // Max latitude
  lomax: number; // Max longitude
}): Promise<OpenSkyFlight[]> {
  // Build URL with optional bounding box
  let url = 'https://opensky-network.org/api/states/all';
  if (bounds) {
    url += `?lamin=${bounds.lamin}&lomin=${bounds.lomin}&lamax=${bounds.lamax}&lomax=${bounds.lomax}`;
  }

  const json = await fetchJson<OpenSkyStates>(url, undefined, { timeoutMs: 8000, retries: 1 });
  const states: any[] = Array.isArray(json.states) ? json.states : [];

  const flights: OpenSkyFlight[] = [];

  for (const s of states) {
    const lon = Number(s[5]);
    const lat = Number(s[6]);
    const alt = Number(s[7]);
    const vel = Number(s[9]);
    const heading = Number(s[10]);
    const verticalRate = Number(s[11]);
    const onGround = Boolean(s[8]);

    // Skip invalid positions or grounded aircraft
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    flights.push({
      icao24: String(s[0] || '').trim(),
      callsign: String(s[1] || '').trim(),
      origin_country: String(s[2] || ''),
      lat,
      lon,
      altitude: Number.isFinite(alt) ? alt : 0,
      velocity: Number.isFinite(vel) ? vel : 0,
      heading: Number.isFinite(heading) ? heading : 0,
      vertical_rate: Number.isFinite(verticalRate) ? verticalRate : 0,
      on_ground: onGround,
      squawk: s[14] ? String(s[14]) : undefined,
      time_position: Number(s[3] || 0)
    });
  }

  return flights;
}

/**
 * Detect altitude stacking (aircraft clustered at similar altitudes)
 * Indicates ATC flow control or congestion
 */
function detectAltitudeStacking(altitudes: number[]): boolean {
  if (altitudes.length < 10) return false;

  // Sort altitudes
  const sorted = [...altitudes].sort((a, b) => a - b);

  // Count aircraft within 1000ft (305m) altitude bands
  const bands = new Map<number, number>();
  for (const alt of sorted) {
    const band = Math.round(alt / 305) * 305; // 1000ft bands
    bands.set(band, (bands.get(band) ?? 0) + 1);
  }

  // If any band has 6+ aircraft, it's stacking
  return Array.from(bands.values()).some(count => count >= 6);
}
