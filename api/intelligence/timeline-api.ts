/**
 * API Endpoint: Timeline Analysis
 * GET /api/intelligence/timeline
 * 
 * Returns regional timelines with escalation detection
 */

import { ingestAll } from './helpers';
import { analyzeTimelines } from './timeline';
import type { IntelligenceResponse, RegionalTimeline } from './types';

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
    
    // Analyze timelines
    const timelines = analyzeTimelines(events, { limit });
    
    const response: IntelligenceResponse<RegionalTimeline[]> = {
      data: timelines,
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
    console.error('Timeline analysis failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to analyze timelines' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
