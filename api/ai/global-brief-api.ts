/**
 * API Endpoint: AI Global Brief
 * GET /api/ai/global-brief
 * 
 * Returns AI-generated intelligence summary
 */

import { ingestAll } from '../intelligence/helpers';
import { getGlobalBrief } from './globalBrief';
import type { IntelligenceResponse } from '../intelligence/types';
import type { GlobalBrief } from '../intelligence/types';

export const config = {
  runtime: 'edge'
};

export default async function handler(req: Request): Promise<Response> {
  const startTime = Date.now();
  
  try {
    // Ingest all events
    const events = await ingestAll();
    
    // Generate brief
    const brief = await getGlobalBrief(events);
    
    const response: IntelligenceResponse<GlobalBrief> = {
      data: brief,
      generatedAt: new Date().toISOString(),
      computeTimeMs: Date.now() - startTime,
      eventCount: events.length
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, s-maxage=120, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    console.error('Global brief generation failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate brief' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
