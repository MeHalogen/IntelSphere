/**
 * API Endpoint: Global Risk Score
 * GET /api/intelligence/global-risk
 * 
 * Returns unified global risk assessment
 */

import { ingestAll } from './helpers';
import { getGlobalRisk } from './globalRisk';
import type { IntelligenceResponse, GlobalRisk } from './types';

export const config = {
  runtime: 'edge'
};

export default async function handler(req: Request): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // Ingest all events
    const events = await ingestAll();
    
    // Calculate global risk
    const globalRisk = getGlobalRisk(events);
    
    const response: IntelligenceResponse<GlobalRisk> = {
      data: globalRisk,
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
    console.error('Global risk calculation failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to calculate global risk' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
