/**
 * OpenSky Flight Tracking API
 * 
 * Returns real-time aircraft positions similar to the OpenSky Network map.
 * Useful for live flight tracking visualization on the intelligence platform.
 * 
 * GET /api/flights?lamin=40&lomin=-75&lamax=42&lomax=-73
 * 
 * Query Parameters:
 * - lamin: Minimum latitude (optional)
 * - lomin: Minimum longitude (optional)
 * - lamax: Maximum latitude (optional)
 * - lomax: Maximum longitude (optional)
 */

import { fetchOpenSkyFlights } from './ingestion/fetchOpenSky';

export const config = {
  runtime: 'edge'
};

// Simple in-memory cache (30 second TTL to respect OpenSky rate limits)
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 seconds

function getCacheKey(bounds?: { lamin: number; lomin: number; lamax: number; lomax: number }): string {
  return bounds 
    ? `${bounds.lamin},${bounds.lomin},${bounds.lamax},${bounds.lomax}`
    : 'global';
}

function getCachedData(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setCachedData(key: string, data: any): void {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    );
  }

  try {
    // Parse optional bounding box
    const lamin = url.searchParams.get('lamin');
    const lomin = url.searchParams.get('lomin');
    const lamax = url.searchParams.get('lamax');
    const lomax = url.searchParams.get('lomax');
    
    let bounds: { lamin: number; lomin: number; lamax: number; lomax: number } | undefined;
    
    if (lamin && lomin && lamax && lomax) {
      bounds = {
        lamin: parseFloat(lamin),
        lomin: parseFloat(lomin),
        lamax: parseFloat(lamax),
        lomax: parseFloat(lomax)
      };

      // Validate bounds
      if (
        !Number.isFinite(bounds.lamin) ||
        !Number.isFinite(bounds.lomin) ||
        !Number.isFinite(bounds.lamax) ||
        !Number.isFinite(bounds.lomax) ||
        bounds.lamin >= bounds.lamax ||
        bounds.lomin >= bounds.lomax
      ) {
        return new Response(
          JSON.stringify({ error: 'Invalid bounds. Use: lamin < lamax and lomin < lomax' }),
          { status: 400, headers }
        );
      }
    }

    // Check cache first
    const cacheKey = getCacheKey(bounds);
    const cached = getCachedData(cacheKey);
    
    if (cached) {
      console.log(`[Cache Hit] Returning cached flight data for ${cacheKey}`);
      return new Response(
        JSON.stringify(cached),
        { 
          status: 200, 
          headers: {
            ...headers,
            'X-Cache': 'HIT'
          }
        }
      );
    }

    // Fetch flights from OpenSky
    console.log(`[Cache Miss] Fetching fresh flight data for ${cacheKey}`);
    const flights = await fetchOpenSkyFlights(bounds);

    const response = {
      flights,
      count: flights.length,
      timestamp: new Date().toISOString(),
      bounds: bounds || 'global'
    };

    // Cache the response
    setCachedData(cacheKey, response);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: {
          ...headers,
          'X-Cache': 'MISS'
        }
      }
    );

  } catch (err: any) {
    console.error('Error fetching OpenSky flights:', err);
    
    // Check if it's a rate limit error
    const status = err?.status === 429 ? 429 : 500;
    const message = err?.status === 429 
      ? 'OpenSky Network rate limit exceeded. Please wait 30 seconds before refreshing.'
      : err?.message || String(err);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch flight data',
        message,
        status
      }),
      { status, headers }
    );
  }
}
