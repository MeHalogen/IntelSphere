# Crisis Monitor

Modern OSINT-style crisis intelligence dashboard (Bloomberg-terminal vibe for disasters).

## What’s inside
- **Frontend**: Vite + React + TypeScript, **MapLibre GL** basemap + **Deck.gl** layers.
- **Backend**: Vercel **Edge Functions** (Node runtime on the edge) serving normalized event feeds + AI brief endpoints.
- **Modular services** (in code): ingestion → scoring → ai analysis → map renderer.

## Data sources (current wiring)
- USGS Earthquakes (real-time GeoJSON)
- GDACS alerts (v2 feed)

Other sources (FIRMS, NOAA, OpenSky, GDELT) are scaffolded as adapters with placeholders for keys/CORS-friendly proxies.

## Quick start

```zsh
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Environment variables
For AI summaries, set one of:
- `OPENAI_API_KEY` (recommended)

If not set, the AI endpoint returns a deterministic fallback summary.

## Deployment (Vercel)
- Import the repo
- No special build settings required; `vercel.json` is included.

## Notes
- This is an MVP scaffold optimized for a clean intelligence UI and correct modularity.
- The scoring model is intentionally simple but designed to be extended with higher-fidelity population/infrastructure datasets.
