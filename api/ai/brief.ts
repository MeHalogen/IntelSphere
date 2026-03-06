import type { AiBrief } from '../_lib/types';
import { config as appConfig } from '../_lib/config';

export const config = {
  runtime: 'edge'
};

function fallbackBrief(eventId: string): AiBrief {
  const now = new Date().toISOString();
  return {
    shortBrief: `Event ${eventId}: early signals detected. Monitor official updates and trusted news sources for confirmation and impact assessment.`,
    keyRisks: ['Information uncertainty / rumors', 'Escalation risk depending on secondary hazards', 'Infrastructure disruption'],
    expectedImpact: ['Localized service interruptions possible', 'Potential travel and logistics delays'],
    recommendedMonitoringActions: [
      'Track official agencies and verified field reports',
      'Watch for aftershocks / secondary hazards',
      'Monitor transport disruptions and advisories'
    ],
    model: 'fallback',
    generatedAt: now
  };
}

async function openAiBrief(eventId: string): Promise<AiBrief | null> {
  const key = appConfig.ai.openAiApiKey;
  if (!key) return null;

  const now = new Date().toISOString();
  const prompt = {
    role: 'user',
    content:
      `You generate analyst-grade OSINT crisis briefs. Return strict JSON with keys: shortBrief (string), keyRisks (string[]), expectedImpact (string[]), recommendedMonitoringActions (string[]).\n\nEventId: ${eventId}`
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [prompt]
    })
  });

  if (!resp.ok) return null;
  const json = (await resp.json()) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return null;

  const parsed = JSON.parse(content);
  const brief: AiBrief = {
    shortBrief: String(parsed.shortBrief ?? ''),
    keyRisks: Array.isArray(parsed.keyRisks) ? parsed.keyRisks.map(String) : [],
    expectedImpact: Array.isArray(parsed.expectedImpact) ? parsed.expectedImpact.map(String) : [],
    recommendedMonitoringActions: Array.isArray(parsed.recommendedMonitoringActions)
      ? parsed.recommendedMonitoringActions.map(String)
      : [],
    model: 'gpt-4o-mini',
    generatedAt: now
  };
  return brief;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const eventId = String(url.searchParams.get('eventId') ?? '').trim();
  if (!eventId) {
    return new Response(JSON.stringify({ error: 'Missing eventId' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }

  const brief = (await openAiBrief(eventId)) ?? fallbackBrief(eventId);

  return new Response(JSON.stringify(brief), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, s-maxage=60, stale-while-revalidate=300'
    }
  });
}
