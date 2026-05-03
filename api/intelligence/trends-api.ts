/**
 * API Endpoint: Trending Keywords
 * GET /api/intelligence/trends
 * 
 * Returns trending disaster keywords with spike detection
 */

import { ingestAll } from './helpers';
import { getTopTrends } from './trends';
import type { IntelligenceResponse, TrendingKeyword } from './types';

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
    
    // Detect trends
    const trends = getTopTrends(events, limit);
    
    const response: IntelligenceResponse<TrendingKeyword[]> = {
      data: trends,
      generatedAt: new Date().toISOString(),
      computeTimeMs: Date.now() - startTime,
      eventCount: events.length
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    console.error('Trend detection failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to detect trends' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
