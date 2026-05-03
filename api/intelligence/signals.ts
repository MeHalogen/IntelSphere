/**
 * API Endpoint: Predictive Signals
 * GET /api/intelligence/signals
 * 
 * Returns early warning signals for potential escalation
 */

import { ingestAll } from './helpers';
import { detectPredictiveSignals } from './predictiveSignals';
import type { IntelligenceResponse, PredictiveSignal } from './types';

export const config = {
  runtime: 'edge'
};

export default async function handler(req: Request): Promise<Response> {
  const startTime = Date.now();
  const url = new URL(req.url);
  const limit = Math.min(30, Number(url.searchParams.get('limit') ?? 15) || 15);
  const minConfidence = Math.max(0, Math.min(100, Number(url.searchParams.get('minConfidence') ?? 50) || 50));
  
  try {
    // Ingest all events
    const events = await ingestAll();
    
    // Detect predictive signals
    const signals = detectPredictiveSignals(events, { limit })
      .filter(s => s.confidence >= minConfidence);
    
    const response: IntelligenceResponse<PredictiveSignal[]> = {
      data: signals,
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
    console.error('Predictive signal detection failed:', error);
    return new Response(JSON.stringify({ error: 'Failed to detect signals' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
