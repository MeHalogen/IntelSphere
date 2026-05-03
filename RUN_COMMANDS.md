# IntelSphere – Run Commands

## Prerequisites

```zsh
npm install
```

## Development

| Command | Description |
|---|---|
| `npm run dev` | Start both API + Web dev servers concurrently |
| `npm run dev:api` | Start the API dev server only (`tsx scripts/dev-api.ts`) |
| `npm run dev:web` | Start the Vite web dev server only |

## Build & Preview

| Command | Description |
|---|---|
| `npm run build` | Build the web app (`tsc -b && vite build`) |
| `npm run -w @crisis-monitor/web preview` | Preview the production build locally |

## Testing

| Command | Description |
|---|---|
| `npm test` | Run all tests via Vitest |
| `npm run smoke:events` | Run the smoke test for events ingestion |
| `npm run -w @crisis-monitor/web test` | Run web app tests only |
| `npm test api/intelligence/` | Run intelligence module tests |

## Code Quality

| Command | Description |
|---|---|
| `npm run lint` | Lint all workspaces |
| `npm run typecheck` | Type-check all workspaces |
| `npm run -w @crisis-monitor/web lint` | Lint web app only |
| `npm run -w @crisis-monitor/web typecheck` | Type-check web app only |

## Intelligence API Testing

Test individual intelligence endpoints locally:

```zsh
# Start dev server
npm run dev

# In another terminal:
curl http://localhost:3000/api/intelligence/correlations
curl http://localhost:3000/api/intelligence/hotspots-api
curl http://localhost:3000/api/intelligence/trends-api
curl http://localhost:3000/api/intelligence/global-risk
curl http://localhost:3000/api/intelligence/signals
curl http://localhost:3000/api/intelligence/timeline-api
curl http://localhost:3000/api/ai/global-brief-api
```

## Environment Variables

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Optional: For AI summaries via GPT-4o-mini (falls back to rule-based if unset) |
| `GROQ_API_KEY` | Optional: For AI summaries via Groq Mixtral (alternative to OpenAI) |

## Quick Intelligence Check

To verify intelligence modules are working:

```zsh
# Run intelligence tests
npm test api/intelligence/intelligence.test.ts

# Check API endpoints
npm run dev
# Then visit http://localhost:5173 and click "Intelligence" tab
```

## Performance Benchmarks

Expected performance targets:

- **Event Feed**: <100ms for 2000 events
- **Correlations**: <150ms for 10K events
- **Hotspots**: <100ms for 10K events  
- **Trends**: <200ms for 10K events
- **Global Risk**: <50ms for 10K events
- **Predictive Signals**: <150ms for 10K events

Run benchmarks:

```zsh
npm test -- --reporter=verbose
```
