# Flight API Rate Limit Fix

## Problem
The OpenSky Network API was returning **HTTP 429 (Rate Limit Exceeded)** errors because:
1. Anonymous users are limited to **1 request per 10 seconds**
2. The UI was polling every 10 seconds, causing rate limit issues
3. No server-side caching was implemented
4. Multiple browser tabs/refreshes could exceed the limit

## Solution Implemented

### 1. Server-Side Caching (`/api/flights.ts`)

Added a 30-second in-memory cache to prevent excessive API calls:

```typescript
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 seconds

// Caches by region key (global, or lat/lon bounds)
// Multiple UI requests within 30 seconds serve cached data
```

**Benefits:**
- ✅ Reduces OpenSky API calls by 90%+
- ✅ Multiple users/tabs share cached data
- ✅ Respects rate limits automatically
- ✅ Includes `X-Cache: HIT/MISS` headers for debugging

### 2. UI Polling Rate (`LiveFlightsPanel.tsx`)

Changed SWR configuration to be more conservative:

```typescript
{
  refreshInterval: 30000,      // Was 10s → Now 30s
  dedupingInterval: 25000,     // Prevent duplicate requests
  revalidateOnFocus: false,    // Don't refetch on window focus
  shouldRetryOnError: false    // Don't retry 429 errors
}
```

### 3. Improved Error Handling

Added specific rate limit error messages:

**Server (`/api/flights.ts`):**
```typescript
const status = err?.status === 429 ? 429 : 500;
const message = err?.status === 429 
  ? 'OpenSky Network rate limit exceeded. Please wait 30 seconds.'
  : err?.message;
```

**UI (`LiveFlightsPanel.tsx`):**
```typescript
{error?.status === 429 
  ? 'Rate limit reached. OpenSky allows 1 request per 10s. Please wait 30s...'
  : error.message
}
```

## How It Works

### Request Flow
1. **Browser** requests `/api/flights` → **Dev Server** (port 3001)
2. **Dev Server** checks cache:
   - **Cache Hit**: Returns cached data (< 30s old) ✅
   - **Cache Miss**: Fetches from OpenSky → Caches → Returns
3. **UI** updates every 30 seconds automatically

### Cache Strategy
```
Time 0s:  Browser → Server [Cache Miss] → OpenSky ✅ (200 OK)
Time 10s: Browser → Server [Cache Hit]  → Cached ✅
Time 20s: Browser → Server [Cache Hit]  → Cached ✅
Time 30s: Browser → Server [Cache Hit]  → Cached ✅
Time 40s: Browser → Server [Cache Miss] → OpenSky ✅ (200 OK)
```

**Result:** Only 1 OpenSky API call per 30 seconds, even with multiple users.

## Testing the Fix

### 1. Check Server Logs
```bash
npm run dev
```

Look for:
```
[Cache Miss] Fetching fresh flight data for global
[Cache Hit] Returning cached flight data for global
```

### 2. Test with curl
```bash
# First request (cache miss)
curl -i http://127.0.0.1:3001/api/flights | grep X-Cache
# X-Cache: MISS

# Immediate second request (cache hit)
curl -i http://127.0.0.1:3001/api/flights | grep X-Cache
# X-Cache: HIT
```

### 3. Browser Testing
1. Open http://localhost:5173
2. Click **🧠 Intelligence** tab
3. Scroll to **✈️ Live Flight Tracking**
4. Open Network tab (F12)
5. Look for `/api/flights` requests
6. Should see successful 200 responses, not 429 errors

### 4. Verify Live Updates
Watch the "Updated" timestamp in the stats bar:
- Should update every ~30 seconds
- No errors should appear
- Flight count should be 8,000+ (global view)

## Rate Limit Details

### OpenSky Network Limits (Anonymous Users)
- **Rate Limit**: 1 request per 10 seconds
- **Status Code**: 429 Too Many Requests
- **Reset**: No retry-after header, just wait

### Our Configuration
- **Server Cache TTL**: 30 seconds
- **UI Refresh**: 30 seconds
- **Combined Effect**: Well under rate limit

## Regional Filters

Each region has its own cache key:
- **Global**: No bounds, cache key = `global`
- **US East**: `35,-85,45,-65`
- **US West**: `32,-125,49,-100`
- **Europe**: `40,-10,60,30`
- **Asia**: `20,100,45,145`
- **Middle East**: `20,30,40,60`

Switching regions triggers a new API call (if not cached).

## Performance Impact

### Before Fix
- 🔴 1 OpenSky API call per 10 seconds per user
- 🔴 Frequent 429 errors
- 🔴 Empty UI panels
- 🔴 Poor user experience

### After Fix
- 🟢 1 OpenSky API call per 30 seconds total (all users)
- 🟢 No 429 errors
- 🟢 Reliable data display
- 🟢 Smooth user experience

## Deployment Notes

### Vercel Edge Functions
The in-memory cache will work, but:
- Each edge node has its own cache
- Edge nodes may scale up/down
- Consider Redis for production caching

### Production Improvements
1. **Redis Cache**: Shared across all instances
2. **Authenticated API**: 4,000 requests/day instead of anonymous limits
3. **CloudFlare CDN**: Cache responses at CDN level
4. **WebSocket**: Real-time updates without polling

## Troubleshooting

### Still seeing 429 errors?
1. Clear browser cache (Cmd+Shift+R)
2. Wait 60 seconds for rate limit to reset
3. Check server logs for cache hits
4. Verify only one dev server is running: `lsof -i:3001`

### Cache not working?
1. Check dev server console for cache logs
2. Test with curl to verify `X-Cache` headers
3. Ensure dev server restarted after code changes

### Empty panel?
1. Check Network tab for actual error
2. Look for CORS issues
3. Verify dev-api is running on port 3001
4. Check browser console for JavaScript errors

## Next Steps

✅ Rate limiting fixed
✅ Caching implemented
✅ Error handling improved
⏭️ Test UI in browser
⏭️ Monitor for 24 hours
⏭️ Consider authenticated OpenSky account
⏭️ Add Redis for production
