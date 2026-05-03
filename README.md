# IntelSphere

**Next-generation global crisis intelligence platform** – Real-time event monitoring enhanced with advanced pattern detection, correlation analysis, and AI-powered insights.

## 🚀 What's New: Intelligence Platform

IntelSphere now features a groundbreaking intelligence layer that goes beyond simple event display:

### 🧠 Intelligence Capabilities

- **Event Correlation Engine** – Detects compound disasters (earthquake + tsunami + flooding)
- **Hotspot Detection** – Identifies global risk zones using multi-factor analysis
- **Trend Detection** – Spots emerging keywords with spike analysis (2h vs 7-day baseline)
- **AI Global Brief** – Daily intelligence summaries (OpenAI/Groq or rule-based)
- **Crisis Timelines** – Tracks event progression and escalation patterns
- **Global Risk Score** – Unified world risk assessment (0-100 with severity levels)
- **Predictive Signals** – Early warnings for swarms, cascades, and escalation
- **Air Traffic Anomaly Detection** – Statistical analysis surfaces genuine disruptions only (90%+ noise reduction)
- **Event Deduplication** – Intelligent merging of duplicate reports from multiple sources (15-25% reduction)

### 📊 Dashboard Features

- **Real-time Intelligence Tab** with 7 specialized panels
- **Correlation Zones** visualization on map
- **Top Risk Regions** ranked by comprehensive risk scores
- **Trending Keywords** with confidence indicators
- **Escalation Patterns** detection (earthquake swarms, compound disasters)
- **Predictive Warnings** with recommended actions
- **Smart Air Traffic Monitoring** – Holding patterns, altitude stacking, ATC congestion

## What's inside

## What’s inside
## What's inside
- **Frontend**: Vite + React + TypeScript, **MapLibre GL** basemap + **Deck.gl** layers
- **Backend**: Vercel **Edge Functions** serving:
  - Normalized event feeds
  - Intelligence analysis endpoints
  - AI brief generation
- **Intelligence Engine**: Pattern detection, correlation analysis, predictive signals
- **Modular Architecture**: Ingestion → Scoring → Intelligence → Visualization

## Data sources (current wiring)
- USGS Earthquakes (real-time GeoJSON)
- GDACS alerts (v2 feed)

Other sources (FIRMS, NOAA, OpenSky, GDELT) scaffolded for integration.

## Intelligence APIs

```bash
GET /api/feed                              # Event feed
GET /api/intelligence/correlations         # Multi-event clusters
GET /api/intelligence/hotspots-api         # Global risk hotspots
GET /api/intelligence/trends-api           # Trending keywords
GET /api/intelligence/timeline-api         # Regional escalation
GET /api/intelligence/global-risk          # World risk score
GET /api/intelligence/signals              # Predictive warnings
GET /api/ai/global-brief-api               # AI summary
```

## Quick start

```zsh
npm install
npm run dev
```

Then open `http://localhost:5173` (web) or check the API at port 3000.

## Environment variables
```bash
# Optional: For AI-generated summaries
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...

# If not set: falls back to rule-based intelligence summaries
```

## Architecture

See [INTELLIGENCE_ARCHITECTURE.md](./INTELLIGENCE_ARCHITECTURE.md) for detailed documentation on:
- Intelligence algorithms
- Performance optimizations
- API specifications
- Tuning parameters

## Deployment (Vercel)
- Import the repo
- Set optional `OPENAI_API_KEY` or `GROQ_API_KEY`
- Deploy – `vercel.json` handles configuration

## Performance

**Optimized for:**
- 10,000+ events
- Real-time updates
- <100ms API latency (edge functions)
- Smart caching (30-120s TTL)

**Techniques:**
- Grid-based spatial indexing
- Time-windowed analysis
- Edge caching with stale-while-revalidate
- Incremental computation

## Notes
- Intelligence panels auto-refresh (30s-2m intervals)
- Scoring model designed for extensibility
- Clean separation: Ingestion → Analysis → Visualization
- Professional UI inspired by Bloomberg Terminal + Palantir

## Run Commands

See [RUN_COMMANDS.md](./RUN_COMMANDS.md) for all available commands.
