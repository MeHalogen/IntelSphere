/**
 * AI GLOBAL BRIEF
 * 
 * Generates daily intelligence summaries from crisis events.
 * Uses AI (OpenAI/Groq) when available, falls back to rule-based summarization.
 * 
 * Output includes:
 * - Headline: one-sentence summary
 * - Summary: 2-3 sentence overview
 * - Risks: key threats identified
 * - Watch regions: areas requiring monitoring
 */

import type { CrisisEvent } from '../_lib/types';
import type { GlobalBrief } from '../intelligence/types';
import { getTopHotspots } from '../intelligence/hotspots';
import { getTopTrends } from '../intelligence/trends';

/**
 * Generate rule-based brief (fallback when no AI available)
 */
function generateRuleBasedBrief(events: CrisisEvent[]): GlobalBrief {
  const now = new Date().toISOString();
  
  // Calculate key metrics
  const totalEvents = events.length;
  const criticalEvents = events.filter(e => e.severityLabel === 'critical' || e.severityScore >= 80).length;
  const highEvents = events.filter(e => e.severityLabel === 'high' || e.severityScore >= 60).length;
  
  // Get layer distribution
  const layerCounts = new Map<string, number>();
  for (const event of events) {
    layerCounts.set(event.layer, (layerCounts.get(event.layer) ?? 0) + 1);
  }
  const topLayers = Array.from(layerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  // Get top regions from hotspot analysis
  const hotspots = getTopHotspots(events, 5);
  const watchRegions = hotspots.map(h => h.region);
  
  // Get trending keywords
  const trends = getTopTrends(events, 3);
  
  // Generate headline
  let headline = 'Global crisis monitoring active';
  if (criticalEvents > 0) {
    const primaryLayer = topLayers[0]?.[0] || 'events';
    headline = `${criticalEvents} critical ${primaryLayer} event${criticalEvents !== 1 ? 's' : ''} detected globally`;
  } else if (topLayers.length > 0) {
    const primaryLayer = topLayers[0][0];
    headline = `Monitoring ${totalEvents} events: ${primaryLayer} activity across multiple regions`;
  }
  
  // Generate summary
  let summary = `Currently tracking ${totalEvents} crisis events worldwide. `;
  if (criticalEvents > 0) {
    summary += `${criticalEvents} critical and ${highEvents} high-severity incidents require immediate attention. `;
  }
  if (topLayers.length > 0) {
    const layerDesc = topLayers.map(([layer, count]) => `${count} ${layer}`).join(', ');
    summary += `Primary activity: ${layerDesc}. `;
  }
  if (hotspots.length > 0) {
    summary += `Elevated risk detected in ${hotspots.length} regions.`;
  }
  
  // Generate risk list
  const risks: string[] = [];
  
  if (criticalEvents > 5) {
    risks.push('Multiple critical events occurring simultaneously');
  }
  
  for (const [layer, count] of topLayers.slice(0, 2)) {
    if (count >= 3) {
      risks.push(`Elevated ${layer} activity (${count} events)`);
    }
  }
  
  if (trends.length > 0 && trends[0].spike >= 2.0) {
    risks.push(`Rapidly developing: ${trends[0].keyword} (${trends[0].spike}x increase)`);
  }
  
  for (const hotspot of hotspots.slice(0, 2)) {
    if (hotspot.riskScore >= 75) {
      risks.push(`High regional risk: ${hotspot.region} (score: ${hotspot.riskScore})`);
    }
  }
  
  if (risks.length === 0) {
    risks.push('Routine monitoring activity');
    risks.push('No immediate critical threats identified');
  }
  
  return {
    headline,
    summary,
    risks,
    watchRegions: watchRegions.length > 0 ? watchRegions : ['Global monitoring'],
    keyMetrics: {
      totalEvents,
      criticalEvents,
      activeRegions: hotspots.length
    },
    generatedAt: now
  };
}

/**
 * Generate AI-powered brief using OpenAI/Groq
 */
async function generateAiBrief(events: CrisisEvent[], apiKey: string, provider: 'openai' | 'groq'): Promise<GlobalBrief> {
  // Prepare event summary for AI
  const criticalEvents = events.filter(e => e.severityScore >= 70).slice(0, 20);
  const hotspots = getTopHotspots(events, 5);
  const trends = getTopTrends(events, 5);
  
  const eventSummary = criticalEvents.map(e => 
    `- ${e.layer}: ${e.title} (severity: ${e.severityScore}, location: ${e.place || `${e.lat.toFixed(1)},${e.lon.toFixed(1)}`})`
  ).join('\n');
  
  const hotspotSummary = hotspots.map(h =>
    `- ${h.region}: risk score ${h.riskScore}, ${h.eventCount} events`
  ).join('\n');
  
  const trendSummary = trends.map(t =>
    `- ${t.keyword}: ${t.spike}x spike`
  ).join('\n');
  
  const prompt = `You are a global intelligence analyst. Generate a concise crisis briefing based on the following data:

CRITICAL EVENTS:
${eventSummary}

RISK HOTSPOTS:
${hotspotSummary}

TRENDING KEYWORDS:
${trendSummary}

Generate a JSON response with:
- headline: One sentence summary (max 100 chars)
- summary: 2-3 sentence overview (max 300 chars)
- risks: Array of 3-5 key risk points (each max 80 chars)
- watchRegions: Array of 3-5 regions to monitor

Focus on the most significant threats and emerging patterns. Be specific and actionable.`;

  try {
    let response: any;
    
    if (provider === 'openai') {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 500
        })
      });
    } else {
      // Groq
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'mixtral-8x7b-32768',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 500
        })
      });
    }
    
    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in AI response');
    }
    
    // Parse JSON from AI response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in AI response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      headline: parsed.headline || 'Global crisis monitoring',
      summary: parsed.summary || '',
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      watchRegions: Array.isArray(parsed.watchRegions) ? parsed.watchRegions : [],
      keyMetrics: {
        totalEvents: events.length,
        criticalEvents: criticalEvents.length,
        activeRegions: hotspots.length
      },
      generatedAt: new Date().toISOString(),
      model: provider === 'openai' ? 'gpt-4o-mini' : 'mixtral-8x7b-32768'
    };
  } catch (error) {
    console.error('AI brief generation failed:', error);
    // Fallback to rule-based
    return generateRuleBasedBrief(events);
  }
}

/**
 * Generate global intelligence brief
 */
export async function generateGlobalBrief(
  events: CrisisEvent[],
  opts?: { openaiKey?: string; groqKey?: string }
): Promise<GlobalBrief> {
  // Try AI first if keys available
  if (opts?.openaiKey) {
    return await generateAiBrief(events, opts.openaiKey, 'openai');
  }
  
  if (opts?.groqKey) {
    return await generateAiBrief(events, opts.groqKey, 'groq');
  }
  
  // Fallback to rule-based
  return generateRuleBasedBrief(events);
}

/**
 * Get brief for environment variables
 */
export async function getGlobalBrief(events: CrisisEvent[]): Promise<GlobalBrief> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  
  return generateGlobalBrief(events, { openaiKey, groqKey });
}
