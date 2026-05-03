# IntelSphere Intelligence Platform

## Architecture Overview

IntelSphere is a next-generation global crisis intelligence platform that combines real-time event monitoring with advanced pattern detection, correlation analysis, and predictive insights.

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │   Map    │  │  Events  │  │   Intelligence       │  │
│  │  Viewer  │  │  Panel   │  │   Dashboard          │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              API Layer (Edge Functions)                  │
│  ┌──────────┐  ┌──────────────────────────────────┐    │
│  │  Feed    │  │  Intelligence Endpoints          │    │
│  │  /events │  │  /correlations /hotspots /trends │    │
│  └──────────┘  └──────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              Intelligence Engine                         │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────┐  │
│  │ Correlation  │  │  Hotspot       │  │  Trends    │  │
│  │ Detection    │  │  Analysis      │  │  Detection │  │
│  ├──────────────┤  ├────────────────┤  ├────────────┤  │
│  │  Timeline    │  │  Risk Scoring  │  │ Predictive │  │
│  │  Analysis    │  │  Global/Region │  │  Signals   │  │
│  └──────────────┘  └────────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              Data Ingestion Layer                        │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐     │
│  │ USGS │  │GDACS │  │ NOAA │  │FIRMS │  │ etc  │     │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘     │
└─────────────────────────────────────────────────────────┘
```

## Intelligence Capabilities

### 1. Event Correlation Engine
**File:** `/api/intelligence/eventCorrelation.ts`

Detects when multiple crisis types occur in close spatial and temporal proximity.

**Algorithm:**
- Groups events into 1° lat/lon grid cells
- Identifies clusters with 3+ distinct event types within 24h
- Calculates aggregate severity with density/diversity bonuses
- Returns high-risk correlation zones

**Use Case:** Detect compound disasters (e.g., earthquake → tsunami → flooding)

**API:** `GET /api/intelligence/correlations?limit=20`

---

### 2. Hotspot Detection
**File:** `/api/intelligence/hotspots.ts`

Identifies global risk hotspots using multi-factor analysis.

**Risk Score Formula:**
```
Risk = (avgSeverity × 0.40) + 
       (densityScore × 0.25) + 
       (recencyScore × 0.20) + 
       (populationExposure × 0.15)
```

**Factors:**
- Event severity scores
- Event density (log scale)
- Recent activity (24h window)
- Population exposure estimates

**API:** `GET /api/intelligence/hotspots-api?limit=15`

---

### 3. Trend Detection
**File:** `/api/intelligence/trends.ts`

Detects trending disaster keywords through spike analysis.

**Algorithm:**
- Extracts keywords from event titles/descriptions
- Calculates frequency in 2h window vs 7-day baseline
- Identifies significant spikes (>1.5x baseline)
- Assigns confidence levels based on data quality

**Use Case:** Early warning of emerging threats

**API:** `GET /api/intelligence/trends-api?limit=15`

---

### 4. AI Global Brief
**File:** `/api/ai/globalBrief.ts`

Generates daily intelligence summaries using AI or rule-based logic.

**Features:**
- OpenAI/Groq integration for AI-powered summaries
- Fallback to deterministic rule-based generation
- Includes headline, summary, risks, watch regions
- Key metrics dashboard

**API:** `GET /api/ai/global-brief-api`

---

### 5. Crisis Timeline Analysis
**File:** `/api/intelligence/timeline.ts`

Tracks event progression and detects escalation patterns.

**Detects:**
- Seismic swarms (earthquake clusters)
- Tsunami sequences
- Compound disasters
- Wildfire spread patterns
- Storm-to-flood progressions

**Metrics:**
- Severity trend (increasing/stable/decreasing)
- Activity acceleration (events/hour rate change)
- Escalation patterns

**API:** `GET /api/intelligence/timeline-api?limit=15`

---

### 6. Global Risk Score
**File:** `/api/intelligence/globalRisk.ts`

Computes unified world risk score (0-100).

**Components:**
- 35% Active crises count
- 30% Average severity
- 20% Correlation clusters
- 15% Trending signals

**Levels:**
- Low: 0-44
- Elevated: 45-64
- High: 65-79
- Critical: 80-100

**API:** `GET /api/intelligence/global-risk`

---

### 7. Predictive Signals
**File:** `/api/intelligence/predictiveSignals.ts`

Early warning system for potential escalation.

**Signal Types:**

**Swarm:** 5+ earthquakes in 2h (potential larger event)
**Escalation:** Rapid severity increase (>2x)
**Cascade:** 3+ event types in 12h (compound disaster)
**Convergence:** Events clustering over time

**Confidence Levels:**
- High: 80-100 (immediate action)
- Medium: 60-79 (increased monitoring)
- Low: 50-59 (watch)

**API:** `GET /api/intelligence/signals?minConfidence=50`

---

## Frontend Dashboard

### Intelligence Tab Components

**Location:** `/apps/web/src/ui/`

1. **GlobalRiskPanel** - Real-time world risk score
2. **TopRiskRegionsPanel** - Ranked hotspots
3. **TrendingSignalsPanel** - Emerging keywords
4. **AIGlobalBriefPanel** - AI-generated summary
5. **CorrelationZonesPanel** - Multi-event clusters
6. **CrisisTimelinePanel** - Regional escalation tracking
7. **PredictiveSignalsPanel** - Early warnings

All panels auto-refresh:
- Risk/Hotspots/Correlations: every 30-45s
- Trends/Timeline/Signals: every 60s
- AI Brief: every 2m

---

## Performance Optimization

### Design for Scale

**Target:** 10,000 events with real-time updates

**Optimizations:**

1. **Grid-based Spatial Indexing**
   - Events grouped into geographic bins
   - O(1) lookup for regional queries
   - Reduces complexity from O(n²) to O(n)

2. **Time Window Filtering**
   - Analysis limited to relevant time windows
   - Recent events (24h) prioritized
   - Baseline comparisons use 7-day samples

3. **Edge Caching**
   - API responses cached at CDN edge
   - `s-maxage=30-120` depending on endpoint
   - `stale-while-revalidate` for graceful updates

4. **Incremental Computation**
   - Trending analysis uses sliding windows
   - Risk scores calculated incrementally
   - Historical baselines updated gradually

5. **Client-Side Optimizations**
   - React components memoized
   - SWR for smart data fetching
   - Virtualized lists for large datasets

---

## API Endpoints Reference

### Event Feed
```
GET /api/feed?layers=earthquakes,floods&limit=2000
```

### Intelligence APIs
```
GET /api/intelligence/correlations?limit=20
GET /api/intelligence/hotspots-api?limit=15
GET /api/intelligence/trends-api?limit=15
GET /api/intelligence/timeline-api?limit=15
GET /api/intelligence/global-risk
GET /api/intelligence/signals?minConfidence=70
GET /api/ai/global-brief-api
```

### Response Format
```typescript
{
  data: T,                  // Intelligence data
  generatedAt: string,      // ISO timestamp
  computeTimeMs: number,    // Processing time
  eventCount: number        // Events analyzed
}
```

---

## Configuration

### Environment Variables

```bash
# AI Brief Generation (optional)
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...

# If not set: falls back to rule-based summaries
```

### Tuning Parameters

**Correlation Detection:**
- `GRID_SIZE`: 1.0° (adjust for granularity)
- `TIME_WINDOW_MS`: 24h (correlation window)
- `MIN_EVENT_TYPES`: 3 (minimum for cluster)

**Hotspot Analysis:**
- `GRID_SIZE`: 5.0° (regional scale)
- `RECENT_WINDOW_MS`: 24h (recent activity)
- `MIN_EVENTS_FOR_HOTSPOT`: 2

**Trend Detection:**
- `RECENT_WINDOW_MS`: 2h (trending window)
- `BASELINE_WINDOW_MS`: 7d (baseline comparison)
- `MIN_SPIKE_RATIO`: 1.5 (50% increase threshold)

---

## Testing

### Manual Testing

```bash
# Test correlation detection
curl http://localhost:3000/api/intelligence/correlations

# Test with specific parameters
curl http://localhost:3000/api/intelligence/signals?minConfidence=80
```

### Integration Tests

```typescript
// Test event correlation
import { detectCorrelations } from '@/api/intelligence/eventCorrelation';

const events = [...]; // mock events
const clusters = detectCorrelations(events);
expect(clusters.length).toBeGreaterThan(0);
```

---

## Deployment

### Vercel Configuration

All intelligence endpoints run as edge functions:
```typescript
export const config = {
  runtime: 'edge'
};
```

**Benefits:**
- Global distribution
- Low latency (<100ms)
- Auto-scaling
- Built-in caching

### Performance Monitoring

Track these metrics:
- Compute time per endpoint
- Cache hit rates
- Event processing throughput
- Intelligence generation latency

---

## Future Enhancements

### Phase 2
- [ ] Machine learning for pattern recognition
- [ ] Satellite imagery integration
- [ ] Social media sentiment analysis
- [ ] Automated alert distribution

### Phase 3
- [ ] Historical pattern matching
- [ ] Seasonal trend analysis
- [ ] Multi-language support
- [ ] Custom alert rules

---

## Support

For technical questions:
- Review code comments in `/api/intelligence/`
- Check error logs in Vercel dashboard
- Test endpoints locally with `npm run dev`

---

**Built with:** TypeScript, React, Edge Functions, Advanced Analytics
**Design Goal:** Bloomberg Terminal meets Palantir for crisis intelligence
