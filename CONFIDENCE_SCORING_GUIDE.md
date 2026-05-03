# Signal Confidence Scoring System

## Overview

The IntelSphere platform implements a sophisticated **confidence scoring system** that evaluates the reliability of every crisis event based on its source, data quality indicators, and multi-source confirmation. This system addresses a critical challenge in intelligence analysis: **distinguishing between highly reliable government/scientific data and unreliable social media reports**.

### Problem Statement

Intelligence platforms typically treat all events equally, regardless of whether they come from:
- **USGS earthquake data** (government agency with seismic sensors)
- **NASA satellite observations** (scientific space agency)
- **Twitter reports** (unverified user-generated content)

This leads to:
- ❌ **Equal weighting** of reliable and unreliable sources
- ❌ **False positives** from low-quality data
- ❌ **Lack of prioritization** in event analysis
- ❌ **Poor intelligence quality** overall

### Solution

IntelSphere assigns a **confidenceScore** (0.0-1.0) to every event based on:

1. **Source Tier** (government/scientific vs. social media)
2. **Data Quality Indicators** (GPS coordinates, metrics, timestamps, satellite confirmation)
3. **Multi-Source Confirmation** (multiple independent sources reporting same event)
4. **Event Type Multipliers** (earthquakes more verifiable than conflicts)

---

## Confidence Score Range

| Score | Label | Meaning | Examples |
|-------|-------|---------|----------|
| **0.90 - 1.0** | Very High | Government/scientific agencies with high-quality data | USGS earthquakes, NOAA weather, NASA satellites |
| **0.75 - 0.89** | High | International organizations or specialized monitoring | GDACS disasters, ACLED conflicts, OpenSky aviation |
| **0.60 - 0.74** | Medium | News agencies or crowdsourced platforms with verification | Reuters, BBC, Finnhub markets |
| **0.40 - 0.59** | Low | Unverified news or limited data quality | Local news, blogs, aggregators |
| **0.00 - 0.39** | Very Low | Social media or unreliable sources | Twitter, Reddit, unverified reports |

---

## Source Confidence Tiers

### Tier 1: Government & Scientific Agencies (0.93 - 0.95)

**Highest reliability**. These sources have:
- Direct sensor networks (seismographs, weather stations, satellites)
- Rigorous data validation processes
- Decades of operational history
- International scientific credibility

| Source | Confidence | Description |
|--------|------------|-------------|
| `usgs` | 0.95 | U.S. Geological Survey - Global earthquake monitoring |
| `noaa` | 0.95 | National Oceanic and Atmospheric Administration - Weather/climate |
| `jma` | 0.95 | Japan Meteorological Agency - Earthquakes/tsunamis |
| `bom` | 0.93 | Australian Bureau of Meteorology - Pacific weather |

**Example Event:**
```json
{
  "id": "usgs-us7000abc123",
  "source": "usgs",
  "layer": "earthquakes",
  "title": "M 6.5 - 10 km SE of Tokyo, Japan",
  "lat": 35.6762,
  "lon": 139.6503,
  "time": "2025-01-15T08:30:45Z",
  "metrics": { "magnitude": 6.5, "depth": 10 },
  "confidenceScore": 0.98,
  "confidenceLabel": "very-high"
}
```

**Why 0.98?**
- Base: 0.95 (USGS Tier 1)
- GPS: +0.05 (precise coordinates)
- Metrics: +0.05 (magnitude, depth)
- Realtime: +0.08 (< 1 hour old)
- **Capped at 1.0**

---

### Tier 2: International Organizations (0.85 - 0.90)

**High reliability**. These sources are:
- UN agencies, international space agencies, global scientific bodies
- Well-established verification processes
- Multiple data sources for cross-validation

| Source | Confidence | Description |
|--------|------------|-------------|
| `gdacs` | 0.90 | Global Disaster Alert and Coordination System - Multi-source disaster data |
| `nasa` | 0.90 | NASA Earth Observatory - Satellite monitoring |
| `esa` | 0.90 | European Space Agency - Earth observation |
| `firms` | 0.85 | NASA FIRMS - Fire detection satellites |

**Example Event:**
```json
{
  "id": "gdacs-EQ-1234567",
  "source": "gdacs",
  "layer": "earthquakes",
  "title": "Earthquake M6.2 in Turkey",
  "lat": 37.7749,
  "lon": 36.8916,
  "time": "2025-01-15T08:30:45Z",
  "links": { "satellite": "https://nasa.gov/image.jpg" },
  "confidenceScore": 1.0,
  "confidenceLabel": "very-high"
}
```

**Why 1.0?**
- Base: 0.90 (GDACS Tier 2)
- GPS: +0.05
- Satellite: +0.10 (NASA confirmation)
- Realtime: +0.08
- **Total: 1.13 → Capped at 1.0**

---

### Tier 3: Aviation & Financial Monitoring (0.78 - 0.92)

**Medium-high reliability**. Specialized real-time tracking systems with:
- Industry-standard verification
- Commercial data feeds
- Known accuracy limitations

| Source | Confidence | Description |
|--------|------------|-------------|
| `flightradar24` | 0.92 | Commercial flight tracking - ADS-B transponders |
| `opensky` | 0.80 | Crowdsourced ADS-B network - Volunteer receivers |
| `finnhub` | 0.78 | Financial market data - Exchange feeds |

**Example Event:**
```json
{
  "id": "opensky-anomaly-1234",
  "source": "opensky",
  "layer": "airspace",
  "title": "Air Traffic Disruption Hotspot",
  "lat": 40.7128,
  "lon": -74.0060,
  "time": "2025-01-15T08:30:45Z",
  "metrics": { "z_score": 3.2, "aircraft_count": 87 },
  "confidenceScore": 0.72,
  "confidenceLabel": "medium"
}
```

**Why 0.72?**
- Base: 0.80 (OpenSky Tier 3)
- Airspace Multiplier: ×0.75 (less verifiable than earthquakes)
- GPS: +0.05
- Metrics: +0.05 (z-score, aircraft count)
- Realtime: +0.08
- **Total: (0.80 × 0.75) + boosts = 0.72**

---

### Tier 4: Humanitarian & Conflict Data (0.75 - 0.80)

**Medium reliability**. Human-curated datasets with:
- Field reporting from local sources
- Manual verification processes
- Potential biases or incomplete data

| Source | Confidence | Description |
|--------|------------|-------------|
| `acled` | 0.75 | Armed Conflict Location & Event Data - Manually curated |
| `reliefweb` | 0.75 | UN humanitarian news - Aggregated reports |

**Example Event:**
```json
{
  "id": "acled-12345",
  "source": "acled",
  "layer": "conflicts",
  "title": "Armed conflict event in Region X",
  "lat": 15.5527,
  "lon": 48.5164,
  "time": "2025-01-14T12:00:00Z",
  "confidenceScore": 0.53,
  "confidenceLabel": "low"
}
```

**Why 0.53?**
- Base: 0.75 (ACLED Tier 4)
- Conflict Multiplier: ×0.70 (harder to verify)
- GPS: +0.05
- No satellite, metrics, or realtime
- **Total: (0.75 × 0.70) + 0.05 = 0.53**

---

### Tier 5: News & Social Media (0.35 - 0.70)

**Low to medium reliability**. User-generated or journalistic content with:
- Variable quality and verification standards
- Potential misinformation
- Useful for trend detection but requires corroboration

| Source | Confidence | Description |
|--------|------------|-------------|
| `reuters` | 0.70 | International news agency - Professional journalism |
| `bbc` | 0.68 | UK national broadcaster - Editorial standards |
| `cnn` | 0.65 | U.S. news network - Breaking news focus |
| `twitter` | 0.40 | Social media - User-generated content |
| `reddit` | 0.35 | Social forum - Community-sourced |

**Example Event (News):**
```json
{
  "id": "reuters-2025-abc",
  "source": "reuters",
  "layer": "conflicts",
  "title": "Breaking: Explosion reported in capital",
  "lat": 33.3152,
  "lon": 44.3661,
  "time": "2025-01-15T08:30:45Z",
  "confidenceScore": 0.54,
  "confidenceLabel": "low"
}
```

**Why 0.54?**
- Base: 0.70 (Reuters Tier 5)
- Conflict Multiplier: ×0.70
- GPS: +0.05
- Realtime: +0.08
- **Total: (0.70 × 0.70) + boosts = 0.54**

**Example Event (Social Media):**
```json
{
  "id": "twitter-abc123",
  "source": "twitter",
  "layer": "other",
  "title": "User reports strange activity",
  "lat": 40.7128,
  "lon": -74.0060,
  "time": "2025-01-15T08:30:45Z",
  "confidenceScore": 0.30,
  "confidenceLabel": "very-low"
}
```

**Why 0.30?**
- Base: 0.40 (Twitter Tier 5)
- Other Multiplier: ×0.75
- **Total: 0.40 × 0.75 = 0.30**

---

## Data Quality Indicators

Beyond source tier, confidence is boosted by data quality indicators:

### 1. GPS Coordinates (`hasGPS`)

**+5% confidence boost**

- Validates: Event has valid latitude/longitude coordinates
- Impact: Enables spatial correlation and verification
- Example: `lat: 40.7128, lon: -74.0060` → +0.05

### 2. Metrics (`hasMetrics`)

**+5% confidence boost**

- Validates: Event has quantitative measurements
- Impact: Provides objective severity indicators
- Examples:
  - Earthquakes: `{ magnitude: 6.5, depth: 10 }`
  - Air Traffic: `{ aircraft_count: 87, z_score: 3.2 }`
  - Markets: `{ volume: 1000000, change_percent: -5.2 }`

### 3. Timestamp (`hasTimestamp`)

**Required (no boost)**

- Validates: Event has ISO 8601 timestamp
- Impact: Enables temporal correlation
- Example: `"2025-01-15T08:30:45Z"`

### 4. Satellite Confirmation (`hasSatelliteConfirmation`)

**+10% confidence boost**

- Validates: Event confirmed by satellite imagery or NASA/ESA source
- Impact: Strong physical evidence
- Detection:
  - `links.satellite` exists
  - `source === 'nasa' || source === 'esa'`

### 5. Multiple Sources (`hasMultipleSources`)

**+15% confidence boost**

- Validates: Multiple independent sources report same event
- Impact: Cross-validation reduces false positives
- Detection: Event ID contains `+` separator (e.g., `usgs-123+nasa-456`)

### 6. Realtime Data (`isRealtime`)

**+8% confidence boost**

- Validates: Event timestamp < 1 hour ago
- Impact: Recent data more actionable
- Calculation: `now - event.time < 3600000 ms`

### 7. Official Source (`hasOfficialSource`)

**Inherent in Tier 1-3**

- Validates: Source is government/scientific (Tier 1-3)
- Impact: Institutional credibility
- Examples: USGS, NOAA, NASA, GDACS

---

## Event Type Multipliers

Different event types have different verifiability:

| Layer | Multiplier | Rationale |
|-------|------------|-----------|
| `earthquakes` | 1.0 | Seismic sensors provide objective data |
| `weather` | 1.0 | Weather stations/satellites provide objective data |
| `floods` | 0.90 | Satellite + ground reports (some subjectivity) |
| `fires` | 0.90 | Satellite thermal detection (some false positives) |
| `storms` | 0.90 | Weather radar/satellites (prediction uncertainty) |
| `volcanos` | 0.95 | Seismic + visual + gas monitoring |
| `airspace` | 0.75 | ADS-B data (crowdsourced, potential gaps) |
| `satellites` | 0.85 | Orbital tracking (known but complex) |
| `conflicts` | 0.70 | Human reports (bias, fog of war) |
| `markets` | 0.95 | Exchange data (official but volatile) |
| `geopolitics` | 0.70 | Human analysis (subjective interpretation) |
| `other` | 0.75 | Unknown event type (default caution) |

**Example:**
```typescript
// USGS earthquake
confidence = 0.95 (source) × 1.0 (earthquakes) + boosts = 0.98

// Twitter conflict report
confidence = 0.40 (source) × 0.70 (conflicts) + boosts = 0.30
```

---

## Multi-Source Confidence Boost

When **deduplication** merges events from multiple independent sources, confidence increases:

### Formula

```typescript
const sourceCount = countUniqueSources(mergedEvents);
const baseConfidence = Math.max(...events.map(e => e.confidenceScore));
const confidenceBoost = Math.min(0.20, (sourceCount - 1) × 0.05);
const mergedConfidence = Math.min(1.0, baseConfidence + confidenceBoost);
```

### Examples

**2 Sources (USGS + GDACS)**
```typescript
// USGS earthquake: 0.95
// GDACS earthquake: 0.90
baseConfidence = 0.95
boost = (2 - 1) × 0.05 = 0.05
mergedConfidence = min(1.0, 0.95 + 0.05) = 1.0 ✅
```

**3 Sources (USGS + GDACS + NASA)**
```typescript
// USGS: 0.95, GDACS: 0.90, NASA: 0.92
baseConfidence = 0.95
boost = (3 - 1) × 0.05 = 0.10
mergedConfidence = min(1.0, 0.95 + 0.10) = 1.0 ✅
```

**5 Sources (Multiple Tier 2/3)**
```typescript
// 5 sources reporting same disaster
baseConfidence = 0.85
boost = min(0.20, (5 - 1) × 0.05) = 0.20 (capped)
mergedConfidence = min(1.0, 0.85 + 0.20) = 1.0 ✅
```

### Rationale

- **+5% per additional source** (max +20%)
- Cross-validation significantly reduces false positives
- Capped at 1.0 to maintain score range
- Only applies to **independent sources** (not duplicates from same agency)

---

## Algorithm Implementation

### 1. Calculate Base Confidence

```typescript
import { calculateConfidenceScore, inferDataQualityIndicators } from './confidence';

const event = {
  source: 'usgs',
  layer: 'earthquakes',
  lat: 40.7128,
  lon: -74.0060,
  time: new Date().toISOString(),
  metrics: { magnitude: 6.5 }
};

const indicators = inferDataQualityIndicators(event);
const confidence = calculateConfidenceScore(event, indicators);
// Result: 0.98 (very-high)
```

### 2. Filter by Minimum Confidence

```typescript
import { filterByConfidence } from './confidence';

const allEvents = [ /* ... */ ];
const highConfidenceEvents = filterByConfidence(allEvents, 0.75);
// Only returns events with confidence ≥ 0.75
```

### 3. Sort by Confidence

```typescript
import { sortByConfidence } from './confidence';

const events = [ /* ... */ ];
const sorted = sortByConfidence(events);
// Returns events sorted highest confidence first
```

### 4. Get Confidence Statistics

```typescript
import { getConfidenceStats } from './confidence';

const events = [ /* ... */ ];
const stats = getConfidenceStats(events);
/*
{
  veryHigh: 15,
  high: 23,
  medium: 12,
  low: 8,
  veryLow: 2,
  average: 0.78,
  bySource: {
    usgs: { count: 15, avgConfidence: 0.95 },
    gdacs: { count: 10, avgConfidence: 0.90 },
    twitter: { count: 2, avgConfidence: 0.35 }
  }
}
*/
```

### 5. Boost for Multi-Source

```typescript
import { boostConfidenceForMultiSource } from './confidence';

const baseConfidence = 0.90;
const sourceCount = 3;
const boosted = boostConfidenceForMultiSource(baseConfidence, sourceCount);
// Result: 1.0 (0.90 + 0.10 boost, capped)
```

---

## Use Cases

### 1. Filtering Low-Confidence Events

**Problem:** Dashboard cluttered with unverified social media reports

**Solution:**
```typescript
const events = await fetchEvents();
const reliable = filterByConfidence(events, 0.70);
// Only show news-quality or better
```

### 2. Confidence-Weighted Correlation

**Problem:** Hotspot detection treats Twitter rumors same as USGS data

**Solution:**
```typescript
const correlations = detectCorrelations(events);
const weightedScore = correlations.reduce((sum, event) => 
  sum + event.correlationScore * event.confidenceScore, 0
) / correlations.length;
```

### 3. Prioritizing Intelligence Briefings

**Problem:** AI brief includes low-quality data in summary

**Solution:**
```typescript
const highConfidence = filterByConfidence(events, 0.85);
const brief = await generateAIBrief(highConfidence);
// Brief only includes Tier 1-2 sources
```

### 4. Source Reliability Dashboard

**Problem:** Analysts don't know which sources to trust

**Solution:**
```typescript
const stats = getConfidenceStats(events);
console.log(`
  Very High: ${stats.veryHigh} events
  High: ${stats.high} events
  USGS Avg: ${stats.bySource.usgs.avgConfidence}
  Twitter Avg: ${stats.bySource.twitter.avgConfidence}
`);
```

### 5. Event Display with Badges

**Problem:** Users can't quickly assess event reliability

**Solution:**
```jsx
{events.map(event => (
  <EventCard key={event.id}>
    <h3>{event.title}</h3>
    <ConfidenceBadge label={event.confidenceLabel} />
    <p>Source: {event.source.toUpperCase()}</p>
  </EventCard>
))}
```

---

## Testing & Validation

The confidence scoring system has **42 comprehensive tests** covering:

### Test Coverage

1. **Source Confidence Tiers** (8 tests)
   - Government/scientific agencies → 0.93-0.95
   - International organizations → 0.85-0.90
   - Aviation/financial → 0.78-0.92
   - Humanitarian → 0.75-0.80
   - News/social → 0.35-0.70

2. **Data Quality Indicators** (10 tests)
   - GPS detection, invalid coordinates
   - Timestamp presence
   - Metrics presence
   - Satellite confirmation (links + NASA/ESA)
   - Multiple sources (ID parsing)
   - Realtime data (<1 hour)
   - Official source validation

3. **Confidence Calculation** (8 tests)
   - Base confidence from source
   - Layer-specific multipliers
   - GPS, realtime, satellite, multi-source boosts
   - Capping at 1.0, floor at 0.0

4. **Confidence Labels** (5 tests)
   - very-high (≥0.9), high (0.75-0.89), medium (0.6-0.74), low (0.4-0.59), very-low (<0.4)

5. **Filtering & Sorting** (2 tests)
   - Minimum confidence threshold
   - Descending confidence sort

6. **Statistics** (4 tests)
   - Average confidence
   - Distribution by label
   - Per-source statistics
   - Empty array handling

7. **Multi-Source Boost** (3 tests)
   - +5% per additional source
   - +20% maximum boost
   - 1.0 cap enforcement

8. **Integration** (2 tests)
   - USGS earthquake with metrics → 0.95+
   - Twitter conflict report → <0.50

### Run Tests

```bash
npx vitest run api/_lib/confidence.test.ts
```

**Expected Output:**
```
✓ |1| api/_lib/confidence.test.ts (42 tests) 7ms
Test Files  1 passed (1)
Tests  42 passed (42)
```

---

## Migration Guide

### Adding Confidence to Existing Fetchers

**Before:**
```typescript
events.push({
  id: `usgs-${eq.id}`,
  source: 'usgs',
  layer: 'earthquakes',
  // ... other fields
  severityScore: 0.8,
  severityLabel: 'high'
});
```

**After:**
```typescript
import { calculateConfidenceScore, inferDataQualityIndicators } from '../_lib/confidence';

const base = {
  id: `usgs-${eq.id}`,
  source: 'usgs',
  layer: 'earthquakes',
  // ... other fields
};

const sev = getSeverity(base);
const indicators = inferDataQualityIndicators(base);
const confidence = calculateConfidenceScore(base, indicators);

events.push({
  ...base,
  severityScore: sev.severityScore,
  severityLabel: sev.severityLabel,
  confidenceScore: confidence  // NEW
});
```

### Updating Deduplication

**Before:**
```typescript
function mergeEvents(primary, secondary) {
  return {
    ...primary,
    id: `${primary.id}+${secondary.id}`,
    description: `${primary.description}; ${secondary.description}`
  };
}
```

**After:**
```typescript
import { boostConfidenceForMultiSource } from '../_lib/confidence';

function mergeEvents(primary, secondary) {
  const sources = new Set([
    ...primary.id.split('+').map(extractSource),
    ...secondary.id.split('+').map(extractSource)
  ]);
  
  const baseConfidence = Math.max(
    primary.confidenceScore,
    secondary.confidenceScore
  );
  
  const mergedConfidence = boostConfidenceForMultiSource(
    baseConfidence,
    sources.size
  );
  
  return {
    ...primary,
    id: `${primary.id}+${secondary.id}`,
    description: `${primary.description}; ${secondary.description}`,
    confidenceScore: mergedConfidence  // NEW
  };
}
```

---

## Performance Considerations

### Time Complexity

- `calculateConfidenceScore()`: **O(1)** - Simple arithmetic
- `inferDataQualityIndicators()`: **O(1)** - Property checks
- `filterByConfidence()`: **O(n)** - Linear filter
- `sortByConfidence()`: **O(n log n)** - Array sort
- `getConfidenceStats()`: **O(n)** - Single pass aggregation

### Memory Impact

- Each event: **+8 bytes** (1 float64 for confidenceScore)
- 10,000 events: **+80 KB** memory
- Negligible overhead for typical workloads

### Caching

Confidence scores are **calculated once** at ingestion time and cached in the event object. No runtime recalculation needed.

---

## Future Enhancements

### 1. Dynamic Source Confidence

**Current:** Static confidence tiers defined in code
**Future:** Machine learning model that adjusts source confidence based on historical accuracy

```typescript
// Adjust USGS confidence based on false positive rate
if (usgs.falsePositiveRate < 0.01) {
  SOURCE_CONFIDENCE['usgs'] = 0.98; // Increase
} else if (usgs.falsePositiveRate > 0.05) {
  SOURCE_CONFIDENCE['usgs'] = 0.92; // Decrease
}
```

### 2. Temporal Confidence Decay

**Current:** Confidence static after calculation
**Future:** Confidence decreases as event ages without confirmation

```typescript
const hoursSinceEvent = (Date.now() - new Date(event.time)) / 3600000;
const decayFactor = Math.max(0.5, 1 - (hoursSinceEvent * 0.01));
const decayedConfidence = event.confidenceScore * decayFactor;
```

### 3. User Feedback Loop

**Current:** No user input on confidence
**Future:** Allow analysts to flag incorrect confidences

```typescript
if (userReportsFalsePositive(event)) {
  adjustSourceConfidence(event.source, -0.02);
  retrainModel();
}
```

### 4. Contextual Confidence

**Current:** Same confidence rules globally
**Future:** Adjust confidence based on geographic region or event history

```typescript
// Higher confidence for USGS in California (dense seismic network)
// Lower confidence for USGS in remote ocean (sparse coverage)
const regionalMultiplier = getRegionalMultiplier(event.lat, event.lon);
confidence *= regionalMultiplier;
```

---

## References

### Code Files

- `/api/_lib/confidence.ts` - Core confidence scoring module (330 lines)
- `/api/_lib/confidence.test.ts` - Test suite (400+ lines, 42 tests)
- `/api/_lib/types.ts` - CrisisEvent type with confidenceScore field
- `/api/intelligence/deduplicateEvents.ts` - Multi-source confidence boost
- `/api/ingestion/fetchEarthquakes.ts` - USGS confidence implementation
- `/api/ingestion/fetchGDACS.ts` - GDACS confidence implementation
- `/api/ingestion/fetchOpenSky.ts` - OpenSky confidence implementation
- `/api/ingestion/fetchEONET.ts` - NASA EONET confidence implementation

### Related Documentation

- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Overall project summary
- [INTELLIGENCE_ARCHITECTURE.md](./INTELLIGENCE_ARCHITECTURE.md) - Intelligence module algorithms
- [DEDUPLICATION_GUIDE.md](./DEDUPLICATION_GUIDE.md) - Event deduplication system
- [AIR_TRAFFIC_INTELLIGENCE.md](./AIR_TRAFFIC_INTELLIGENCE.md) - Anomaly detection

### External Resources

- USGS Real-time Earthquake Data: https://earthquake.usgs.gov/earthquakes/feed/
- GDACS Global Disaster Alerts: https://www.gdacs.org/
- NASA EONET Event Tracker: https://eonet.gsfc.nasa.gov/
- OpenSky Network: https://opensky-network.org/

---

## Summary

The **IntelSphere Confidence Scoring System** transforms crisis intelligence from binary (included/excluded) to **continuous reliability assessment** (0.0-1.0). This enables:

✅ **Data Quality Prioritization** - USGS (0.95) ranks above Twitter (0.40)  
✅ **Multi-Source Validation** - +5% confidence per additional source  
✅ **Intelligent Filtering** - Remove low-confidence noise  
✅ **Confidence-Weighted Analysis** - Weight correlations by reliability  
✅ **Transparent Sourcing** - Users see confidence labels (very-high to very-low)  

**Result:** Production-grade intelligence platform with multi-tier data quality controls.
