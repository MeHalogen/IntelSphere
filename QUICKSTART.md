# IntelSphere – Quick Start Guide

## 🚀 Get Running in 60 Seconds

### 1. Install Dependencies
```zsh
npm install
```

### 2. Start Development Servers
```zsh
npm run dev
```

This starts:
- **API Server** on `http://localhost:3000`
- **Web App** on `http://localhost:5173`

### 3. Open the App
Navigate to `http://localhost:5173`

You'll see:
- **🌍 Events Tab**: Live event map and list
- **🧠 Intelligence Tab**: NEW! Advanced analytics dashboard
- **📋 Details Tab**: Event details view

---

## 🎯 Exploring Intelligence Features

### Click the "Intelligence" Tab

You'll see 7 real-time intelligence panels:

1. **🌐 Global Risk Score** – World stability index (0-100)
2. **🤖 AI Global Brief** – Daily intelligence summary
3. **🔥 Top Risk Regions** – Ranked hotspot list
4. **📊 Trending Signals** – Emerging keywords
5. **🔗 Correlation Zones** – Multi-event clusters
6. **🎯 Predictive Signals** – Early warnings
7. **⏱️ Crisis Timelines** – Event progression

All panels **auto-refresh** every 30-120 seconds.

---

## 🔑 Optional: Enable AI Summaries

For AI-generated intelligence briefs:

```zsh
# OpenAI (recommended)
export OPENAI_API_KEY="sk-..."

# OR Groq (alternative)
export GROQ_API_KEY="gsk_..."

# Restart dev server
npm run dev
```

Without keys, the system uses **rule-based intelligence** (still powerful!).

---

## 🧪 Testing Intelligence

```zsh
# Run all tests
npm test

# Test intelligence modules specifically
npm test api/intelligence/

# Smoke test event ingestion
npm run smoke:events
```

---

## 📊 Understanding the Dashboard

### Global Risk Score
- **Critical** (80-100): Red, immediate attention needed
- **High** (65-79): Orange, elevated threat
- **Elevated** (45-64): Yellow, monitor closely
- **Low** (0-44): Green, routine monitoring

### Trending Signals
- **🔴 High Confidence**: Strong spike (≥2x baseline)
- **🟡 Medium Confidence**: Moderate spike
- **⚪ Low Confidence**: Weak signal

### Predictive Signals
- **⚡ Swarm**: Rapid event succession (5+ in 2h)
- **📈 Escalation**: Severity doubling
- **🌊 Cascade**: Multi-event compound disaster
- **🎯 Convergence**: Events clustering over time

---

## 🛠️ Development Workflow

### Make Changes to Intelligence Modules
1. Edit files in `api/intelligence/`
2. Server auto-reloads
3. Frontend auto-refreshes
4. Check browser console for errors

### Add New Panel
1. Create component in `apps/web/src/ui/`
2. Add to `IntelligenceDashboard.tsx`
3. Style in `styles.css`

### Create New Intelligence Module
1. Add module in `api/intelligence/`
2. Create API endpoint
3. Add types to `types.ts`
4. Create React panel
5. Write tests

---

## 📈 Performance Expectations

For 10,000 events:
- Correlations: ~50ms
- Hotspots: ~80ms
- Trends: ~150ms
- Risk Score: ~30ms
- Signals: ~130ms

**Total Intelligence Processing**: <500ms

---

## 🚢 Deploy to Production

### Vercel (Recommended)

```zsh
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel

# 3. (Optional) Add API keys
vercel env add OPENAI_API_KEY
vercel env add GROQ_API_KEY

# 4. Redeploy
vercel --prod
```

### Manual Deploy
```zsh
# Build
npm run build

# Deploy dist/ folder to any static host
# Deploy api/ folder to edge function provider
```

---

## 🐛 Troubleshooting

### Events Not Loading
- Check API is running on port 3000
- Verify USGS/GDACS endpoints are accessible
- Check browser console for errors

### Intelligence Panels Empty
- Wait 15-30 seconds for initial load
- Check network tab for API responses
- Verify sufficient event data exists

### TypeScript Errors
```zsh
npm run typecheck
```

### Build Errors
```zsh
npm run lint
npm run build
```

---

## 📚 Learn More

- **Full Documentation**: `INTELLIGENCE_ARCHITECTURE.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
- **All Commands**: `RUN_COMMANDS.md`
- **Main README**: `README.md`

---

## 🎓 Key Concepts

### Event Correlation
Events of different types occurring together signal compound disasters.

### Hotspots
Regions with high event density + severity + recent activity.

### Trends
Keywords with 1.5x+ spike vs 7-day baseline indicate emerging threats.

### Predictive Signals
Early warnings based on pattern recognition and acceleration detection.

### Global Risk
Unified score combining crises, severity, correlations, and trends.

---

## 💡 Pro Tips

1. **Use Intelligence Tab** for strategic overview
2. **Check Predictive Signals** for early warnings
3. **Monitor Trending Keywords** for emerging patterns
4. **Watch Correlation Zones** for compound disasters
5. **Track Global Risk** for world stability assessment

---

## 🤝 Need Help?

- Check documentation files in project root
- Review test files for usage examples
- Inspect browser dev tools Network tab
- Check API responses at `http://localhost:3000/api/*`

---

**Ready to monitor global crises with intelligence!** 🌍🧠

*Happy monitoring!*
