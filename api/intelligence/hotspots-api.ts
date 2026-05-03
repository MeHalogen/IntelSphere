/**
 * API Endpoint: Hotspots
 * GET /api/intelligence/hotspots
 * 
 * Returns global risk hotspots ranked by risk score
 */

import { ingestAll } from './helpers';
import { getTopHotspots } from './hotspots';
import type { IntelligenceResponse, Hotspot } from './types';

export const config = {
  runtime: 'edge'
};

export default async function handler(req: Request): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(req.url);
  const limit = Math.min(30, Number(url.searchParams.get('limit') ?? 15) || 15);
  
  try {
    // Ingest all events
    const events = await ingestAll();
    
    // Detect hotspots
    const hotspots = getTopHotspots(events, limit);
    
    const response: IntelligenceResponse<Hotspot[]> = {
      data: hotspots,
      generatedAt: new Date().toISOString(),
      computeTimeMs: Date.now() - startTime,
      eventCount: events.length
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, s-maxage=30, stale-while-revalidate=60'
      }
    });
  } catch (error) {
    console.error('Hotspot detection failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to detect hotspots' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
