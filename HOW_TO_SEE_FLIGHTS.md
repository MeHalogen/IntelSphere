# How to See the Live Flight Tracking Panel

## Quick Navigation

### Step 1: Click the Intelligence Tab

In your Crisis Monitor interface:

1. Look at the top of the sidebar (right side)
2. You'll see three tabs:
   - **🌍 Events** (currently selected - showing earthquake)
   - **🧠 Intelligence** ← **CLICK THIS ONE**
   - **📋 Details**

3. Click **🧠 Intelligence**

### Step 2: Scroll to Live Flight Tracking

Once in the Intelligence tab, you'll see:

1. **🌍 Global Risk Score** (at top)
2. **🤖 AI Global Brief**
3. **📊 Top Risk Regions**
4. **📈 Trending Signals**
5. **🔗 Correlation Zones**
6. **🔮 Predictive Signals**
7. **✈️ Live Flight Tracking** ← **THIS IS IT!**
8. **📅 Crisis Timeline**

Scroll down to section 7 to see the live flight tracking panel with 8,000+ aircraft!

---

## What You Should See

Once you're there, you'll see:

```
┌──────────────────────────────────────────┐
│ ✈️ Live Flight Tracking                  │
│ Real-time aircraft positions             │
├──────────────────────────────────────────┤
│ Total: 8,623  Airborne: 8,183           │
│                                          │
│ [🌍 Global] [🇺🇸 US East] [🇪🇺 Europe]  │
│                                          │
│ Flight cards with live data...          │
└──────────────────────────────────────────┘
```

---

## Alternative: Add Flights to Map

If you want to see flights on the **map** itself (not just in the Intelligence tab), I can add that feature. This would show airplane icons on the map with the events.

Would you like me to:

### Option A: Just navigate to Intelligence tab
→ No code changes needed, just click **🧠 Intelligence**

### Option B: Add flights to the map view
→ I'll add airplane markers to your map so you can see flights while on the Events tab

Let me know which you prefer!

---

## Troubleshooting

### "I don't see the Intelligence tab"

Make sure you're looking at the **sidebar** on the right side of the screen. The tabs are:
- 🌍 Events
- 🧠 Intelligence ← Click this
- 📋 Details

### "I clicked Intelligence but don't see flights"

Scroll down! The Live Flight Tracking panel is in the 4th row of the dashboard, after:
- Global Risk
- AI Brief  
- Top Risk Regions / Trending Signals
- Correlation Zones / Predictive Signals
- **← Live Flight Tracking is here**

### "The data isn't loading"

Check that:
1. Your API endpoint `/api/flights` is deployed and working
2. You're connected to the internet
3. The OpenSky Network is responding (they have rate limits)

---

## Quick Test

To verify everything is working:

1. Open browser console (F12)
2. Check for any errors
3. Try manually accessing: `http://localhost:5174/api/flights`
4. You should see JSON with flight data

If you see errors, let me know and I'll help debug!
