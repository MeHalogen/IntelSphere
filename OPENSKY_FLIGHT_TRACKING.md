# OpenSky Flight Tracking Integration

## Overview

IntelSphere integrates with the **OpenSky Network** to provide real-time air traffic monitoring with two distinct capabilities:

1. **Anomaly Detection** (`/api/events` with `airspace` layer) - Detects unusual patterns like holding patterns, congestion, altitude stacking
2. **Live Flight Tracking** (`/api/flights`) - Returns individual aircraft positions, speeds, altitudes, and callsigns (like the OpenSky map)

This document focuses on the **live flight tracking** feature.

---

## API Endpoint

### GET `/api/flights`

Returns real-time positions of all active aircraft detected by the OpenSky Network.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `lamin` | number | No | Minimum latitude (bounding box) |
| `lomin` | number | No | Minimum longitude (bounding box) |
| `lamax` | number | No | Maximum latitude (bounding box) |
| `lamax` | number | No | Maximum longitude (bounding box) |

**Note:** All bounding box parameters must be provided together, or none at all.

#### Response Schema

```typescript
{
  flights: OpenSkyFlight[];
  count: number;
  timestamp: string; // ISO 8601
  bounds: 'global' | { lamin: number; lomin: number; lamax: number; lomax: number };
}

interface OpenSkyFlight {
  icao24: string;           // Unique ICAO 24-bit aircraft address
  callsign: string;         // Flight number/callsign (e.g., "UAL123")
  origin_country: string;   // Country of registration
  lat: number;              // WGS-84 latitude
  lon: number;              // WGS-84 longitude
  altitude: number;         // Barometric altitude in meters
  velocity: number;         // Ground speed in m/s
  heading: number;          // True track heading in degrees
  vertical_rate: number;    // Climb rate in m/s (+ climb, - descent)
  on_ground: boolean;       // Whether aircraft is on ground
  squawk?: string;          // Transponder code (4 digits)
  time_position: number;    // Unix timestamp of position update
}
```

---

## Examples

### Global Flight Data

**Request:**
```bash
curl https://yourdomain.com/api/flights
```

**Response:**
```json
{
  "flights": [
    {
      "icao24": "a12345",
      "callsign": "UAL123",
      "origin_country": "United States",
      "lat": 40.7128,
      "lon": -74.0060,
      "altitude": 10668,
      "velocity": 257.2,
      "heading": 85.3,
      "vertical_rate": 0,
      "on_ground": false,
      "squawk": "1200",
      "time_position": 1710681045
    },
    // ... thousands more flights
  ],
  "count": 8623,
  "timestamp": "2026-03-07T16:30:45Z",
  "bounds": "global"
}
```

### Regional Flight Data (Northeast US)

**Request:**
```bash
curl "https://yourdomain.com/api/flights?lamin=40&lomin=-75&lamax=42&lomax=-73"
```

**Response:**
```json
{
  "flights": [
    {
      "icao24": "a12345",
      "callsign": "JBU221",
      "origin_country": "United States",
      "lat": 40.6413,
      "lon": -73.7781,
      "altitude": 305,
      "velocity": 77.2,
      "heading": 270,
      "vertical_rate": -2.5,
      "on_ground": false,
      "squawk": "0422",
      "time_position": 1710681045
    },
    // ... more flights in region
  ],
  "count": 183,
  "timestamp": "2026-03-07T16:30:45Z",
  "bounds": {
    "lamin": 40,
    "lomin": -75,
    "lamax": 42,
    "lomax": -73
  }
}
```

---

## Frontend Integration

### React Component Example

```tsx
import { useState, useEffect } from 'react';
import useSWR from 'swr';

interface OpenSkyFlight {
  icao24: string;
  callsign: string;
  lat: number;
  lon: number;
  altitude: number;
  velocity: number;
  heading: number;
  on_ground: boolean;
}

export function FlightTracker() {
  const { data, error } = useSWR(
    '/api/flights',
    (url) => fetch(url).then(r => r.json()),
    { refreshInterval: 10000 } // Update every 10 seconds
  );

  if (error) return <div>Failed to load flights</div>;
  if (!data) return <div>Loading...</div>;

  return (
    <div>
      <h2>Live Flights: {data.count}</h2>
      <div>
        {data.flights.map((flight: OpenSkyFlight) => (
          <div key={flight.icao24}>
            <strong>{flight.callsign || flight.icao24}</strong>
            {' '}at {Math.round(flight.altitude * 3.28084)}ft
            {' '}heading {Math.round(flight.heading)}°
            {' '}speed {Math.round(flight.velocity * 1.94384)} knots
          </div>
        ))}
      </div>
    </div>
  );
}
```

### MapLibre GL Integration

Display flights as moving icons on the map:

```typescript
import maplibregl from 'maplibre-gl';

async function displayFlights(map: maplibregl.Map) {
  const response = await fetch('/api/flights');
  const data = await response.json();

  // Convert to GeoJSON
  const geojson = {
    type: 'FeatureCollection',
    features: data.flights.map((flight: OpenSkyFlight) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [flight.lon, flight.lat]
      },
      properties: {
        callsign: flight.callsign,
        altitude: flight.altitude,
        velocity: flight.velocity,
        heading: flight.heading,
        icao24: flight.icao24
      }
    }))
  };

  // Add source
  map.addSource('flights', {
    type: 'geojson',
    data: geojson
  });

  // Add layer with airplane icons
  map.addLayer({
    id: 'flights',
    type: 'symbol',
    source: 'flights',
    layout: {
      'icon-image': 'airplane', // Use your airplane icon
      'icon-size': 0.5,
      'icon-rotate': ['get', 'heading'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true
    }
  });

  // Refresh every 10 seconds
  setInterval(async () => {
    const response = await fetch('/api/flights');
    const data = await response.json();
    const source = map.getSource('flights') as maplibregl.GeoJSONSource;
    source.setData(geojson);
  }, 10000);
}
```

---

## Data Format Details

### OpenSky State Vector

The OpenSky Network provides state vectors with 17 fields:

| Index | Field | Type | Description |
|-------|-------|------|-------------|
| 0 | `icao24` | string | Unique ICAO 24-bit address in hex (e.g., "a12345") |
| 1 | `callsign` | string | Flight number/callsign (e.g., "UAL123") |
| 2 | `origin_country` | string | Country of aircraft registration |
| 3 | `time_position` | number | Unix timestamp of position update |
| 4 | `last_contact` | number | Unix timestamp of last data update |
| 5 | `longitude` | number | WGS-84 longitude in degrees |
| 6 | `latitude` | number | WGS-84 latitude in degrees |
| 7 | `baro_altitude` | number | Barometric altitude in meters |
| 8 | `on_ground` | boolean | Aircraft on ground (true/false) |
| 9 | `velocity` | number | Ground speed in m/s |
| 10 | `true_track` | number | Track angle in degrees (0° = north) |
| 11 | `vertical_rate` | number | Vertical rate in m/s (+ = climb) |
| 12 | `sensors` | number[] | IDs of receiving sensors |
| 13 | `geo_altitude` | number | Geometric altitude in meters |
| 14 | `squawk` | string | Transponder code (4 digits) |
| 15 | `spi` | boolean | Special purpose indicator |
| 16 | `position_source` | number | 0=ADS-B, 1=ASTERIX, 2=MLAT |

---

## Use Cases

### 1. Live Flight Map

Display all flights as moving icons on an interactive map, similar to FlightRadar24 or the OpenSky Network map.

**Features:**
- Aircraft icons rotated by heading
- Click to show callsign, altitude, speed
- Color-coded by altitude or speed
- Real-time updates every 10 seconds

### 2. Airport Monitoring

Monitor flights near specific airports:

```bash
# JFK Airport area
curl "https://yourdomain.com/api/flights?lamin=40.5&lomin=-74.0&lamax=40.8&lomax=-73.6"
```

**Use Case:** Track arrivals/departures, detect congestion

### 3. Route Analysis

Track specific flights by callsign:

```typescript
const data = await fetch('/api/flights').then(r => r.json());
const myFlight = data.flights.find(f => f.callsign === 'UAL123');
console.log(`UAL123 is at ${myFlight.lat}, ${myFlight.lon}`);
```

### 4. Geofence Alerts

Alert when aircraft enter/leave specific areas:

```typescript
const nyc = { lamin: 40.5, lomin: -74.5, lamax: 41.0, lomax: -73.5 };

async function monitorNYC() {
  const data = await fetch(
    `/api/flights?lamin=${nyc.lamin}&lomin=${nyc.lomin}&lamax=${nyc.lamax}&lomax=${nyc.lomax}`
  ).then(r => r.json());

  if (data.count > 500) {
    alert(`High traffic alert: ${data.count} aircraft in NYC airspace`);
  }
}
```

### 5. Flight History Playback

Store flight positions over time and play back routes:

```typescript
const history: OpenSkyFlight[] = [];

setInterval(async () => {
  const data = await fetch('/api/flights').then(r => r.json());
  const target = data.flights.find(f => f.callsign === 'UAL123');
  if (target) history.push(target);
}, 10000);

// Later: draw polyline from history positions
```

---

## Performance Considerations

### Rate Limiting

The OpenSky Network has rate limits:
- **Anonymous**: 400 API credits per day (~4,000 requests)
- **Registered Users**: 4,000 credits per day (~40,000 requests)
- **Contributors**: Unlimited (if you operate an OpenSky receiver)

**Best Practices:**
- Cache responses for 5-10 seconds on server
- Use bounding boxes to reduce data volume
- Consider running your own OpenSky receiver for unlimited access

### Data Volume

- **Global query**: 8,000-15,000 flights (2-4 MB JSON)
- **Bounding box (US East Coast)**: 500-1,000 flights (200-400 KB JSON)
- **Small region (NYC)**: 50-200 flights (20-80 KB JSON)

**Recommendations:**
- Use bounding boxes for focused views
- Request global data only when needed
- Compress responses (gzip reduces size 70-80%)

### Update Frequency

- OpenSky data updates every **10-15 seconds**
- Faster polling won't provide new data
- Recommended polling interval: **10 seconds**

---

## Comparison: Flights API vs Events API

| Feature | `/api/flights` | `/api/events` (airspace layer) |
|---------|----------------|-------------------------------|
| **Purpose** | Raw flight positions | Anomaly detection |
| **Data** | Individual aircraft | Aggregated patterns |
| **Update** | 10-second polling | 30-second polling |
| **Volume** | 8,000+ flights | 5-20 anomalies |
| **Use Case** | Live tracking map | Intelligence alerts |
| **Confidence** | N/A (raw data) | 0.72-0.80 (analyzed) |

**When to use flights API:**
- Building live flight map
- Tracking specific aircraft
- Airport monitoring dashboard
- Route visualization

**When to use events API (airspace):**
- Detecting disruptions
- Intelligence briefings
- Anomaly alerts
- Pattern analysis

---

## Frontend Panel Example

Here's a complete React panel for displaying flights:

```tsx
import { useState } from 'react';
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
}

export function FlightPanel() {
  const [bounds, setBounds] = useState<string>('');
  
  const url = bounds 
    ? `/api/flights?${bounds}`
    : '/api/flights';

  const { data, error, isLoading } = useSWR(
    url,
    (url) => fetch(url).then(r => r.json()),
    { refreshInterval: 10000 }
  );

  const setRegion = (region: string) => {
    const regions: Record<string, string> = {
      'global': '',
      'us-east': 'lamin=35&lomin=-85&lamax=45&lomax=-65',
      'europe': 'lamin=40&lomin=-10&lamax=60&lomax=30',
      'asia': 'lamin=20&lomin=100&lamax=45&lomax=145'
    };
    setBounds(regions[region] || '');
  };

  if (error) return <div>Error loading flights</div>;
  if (isLoading) return <div>Loading flights...</div>;

  return (
    <div className="flight-panel">
      <h2>Live Flights: {data.count.toLocaleString()}</h2>
      
      <div className="region-selector">
        <button onClick={() => setRegion('global')}>Global</button>
        <button onClick={() => setRegion('us-east')}>US East</button>
        <button onClick={() => setRegion('europe')}>Europe</button>
        <button onClick={() => setRegion('asia')}>Asia</button>
      </div>

      <div className="flights-list">
        {data.flights.slice(0, 100).map((flight: OpenSkyFlight) => (
          <div key={flight.icao24} className="flight-card">
            <div className="callsign">
              {flight.callsign || flight.icao24}
            </div>
            <div className="details">
              {flight.origin_country} • 
              {Math.round(flight.altitude * 3.28084).toLocaleString()}ft • 
              {Math.round(flight.velocity * 1.94384)} kts • 
              {Math.round(flight.heading)}°
            </div>
            {flight.vertical_rate > 1 && <span>⬆️ Climbing</span>}
            {flight.vertical_rate < -1 && <span>⬇️ Descending</span>}
          </div>
        ))}
      </div>

      <div className="update-time">
        Updated: {new Date(data.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
```

---

## Testing

### Manual Test

```bash
# Test global flights
curl https://yourdomain.com/api/flights | jq '.count'

# Test bounding box
curl "https://yourdomain.com/api/flights?lamin=40&lomin=-75&lamax=42&lomax=-73" | jq '.flights[0]'
```

### Automated Test

```typescript
import { describe, it, expect } from 'vitest';

describe('OpenSky Flights API', () => {
  it('should return flight data', async () => {
    const response = await fetch('/api/flights');
    const data = await response.json();
    
    expect(data).toHaveProperty('flights');
    expect(data).toHaveProperty('count');
    expect(data).toHaveProperty('timestamp');
    expect(Array.isArray(data.flights)).toBe(true);
    expect(data.count).toBeGreaterThan(0);
  });

  it('should filter by bounding box', async () => {
    const response = await fetch('/api/flights?lamin=40&lomin=-75&lamax=42&lomax=-73');
    const data = await response.json();
    
    expect(data.bounds).toHaveProperty('lamin');
    data.flights.forEach((flight: any) => {
      expect(flight.lat).toBeGreaterThanOrEqual(40);
      expect(flight.lat).toBeLessThanOrEqual(42);
      expect(flight.lon).toBeGreaterThanOrEqual(-75);
      expect(flight.lon).toBeLessThanOrEqual(-73);
    });
  });
});
```

---

## Summary

✅ **Real-time flight tracking** via `/api/flights`  
✅ **8,000+ global flights** with positions, speeds, altitudes  
✅ **Bounding box filtering** for regional focus  
✅ **10-second updates** matching OpenSky refresh rate  
✅ **Complete flight data** including callsigns, headings, vertical rates  
✅ **Ready for map visualization** (MapLibre GL, Deck.gl)  

You now have the same data powering the OpenSky Network map, integrated into your IntelSphere platform! 🛩️
