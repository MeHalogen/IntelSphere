/**
 * API Endpoint: Event Correlation
 * GET /api/intelligence/correlations
 * 
 * Returns correlation clusters where multiple event types occur together
 */

import { ingestAll } from './helpers';
import { getTopCorrelations } from './eventCorrelation';
import type { IntelligenceResponse, CorrelationCluster } from './types';

export const config = {
  runtime: 'edge'
};

export default async function handler(req: Request): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(req.url);
  const limit = Math.min(50, Number(url.searchParams.get('limit') ?? 20) || 20);
  
  try {
    // Ingest all events
    const events = await ingestAll();
    
    // Detect correlations
    const correlations = getTopCorrelations(events, limit);
    
    const response: IntelligenceResponse<CorrelationCluster[]> = {
      data: correlations,
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
    console.error('Correlation detection failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to detect correlations' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
