import { config } from '../_lib/config';

export type GroqChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type GroqChatResponse = {
  id?: string;
  choices?: Array<{ index: number; message?: { role: string; content?: string } }>;
  error?: { message?: string };
};

/**
 * Minimal Groq chat API wrapper.
 *
 * Docs:
 * - Keys: https://console.groq.com/keys
 * - API: https://console.groq.com/docs
 *
 * - Uses `config.ai.groqApiKey` only.
 * - Returns null if GROQ_API_KEY is not set.
 * - Never logs or returns the API key.
 */
export async function groqChatCompletions(args: {
  model: string;
  messages: GroqChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<GroqChatResponse | null> {
  const key = config.ai.groqApiKey;
  if (!key) {
    console.warn('[ai] Groq disabled: missing GROQ_API_KEY');
    return null;
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      temperature: args.temperature ?? 0.2,
      max_tokens: args.maxTokens ?? 512
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[ai] Groq HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }

  return (await res.json()) as GroqChatResponse;
}
