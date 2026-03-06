import { optionalEnv } from './env';

/**
 * Centralized server-side configuration.
 *
 * IMPORTANT:
 * - Do NOT return this object to the frontend; it may contain secrets.
 * - Prefer passing only derived, non-sensitive booleans (e.g., "aiEnabled").
 */
export const config = {
  ai: {
    // Groq API key: https://console.groq.com/keys
    groqApiKey: optionalEnv('GROQ_API_KEY'),

    // OpenRouter key: https://openrouter.ai/keys
    openRouterKey: optionalEnv('OPENROUTER_API_KEY'),

    // OpenAI key (kept for backward compatibility with existing endpoint):
    // https://platform.openai.com/api-keys
    openAiApiKey: optionalEnv('OPENAI_API_KEY')
  },

  markets: {
    // Finnhub key: https://finnhub.io/dashboard
    finnhubKey: optionalEnv('FINNHUB_API_KEY')
  },

  geopolitics: {
    // ACLED token: https://acleddata.com/data-export-tool/
    acledKey: optionalEnv('ACLED_ACCESS_TOKEN')
  },

  cache: {
    // Upstash Redis REST:
    // - Create database: https://console.upstash.com/
    // - REST URL and token are shown in the REST API section.
    redisUrl: optionalEnv('UPSTASH_REDIS_REST_URL'),
    redisToken: optionalEnv('UPSTASH_REDIS_REST_TOKEN')
  }
} as const;

export type AppConfig = typeof config;
