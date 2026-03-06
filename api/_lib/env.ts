/**
 * Production-grade environment variable access for Vercel Edge + Node runtimes.
 *
 * Goals:
 * - Typed access (no accidental typos)
 * - Clear validation errors
 * - Optional keys supported (app still works without them)
 * - No secret leakage (never serialize config/env into responses)
 */

type EnvValue = string | undefined;

// Vercel Edge: `process` may not be typed. This keeps TS happy.
// (At runtime, Vercel Edge provides `process.env`.)
declare const process: { env: Record<string, EnvValue> };

export type EnvName =
  | 'GROQ_API_KEY'
  | 'OPENROUTER_API_KEY'
  | 'FINNHUB_API_KEY'
  | 'ACLED_ACCESS_TOKEN'
  | 'UPSTASH_REDIS_REST_URL'
  | 'UPSTASH_REDIS_REST_TOKEN'
  | 'OPENAI_API_KEY';

export type EnvMap = Record<EnvName, EnvValue>;

function rawEnv(name: EnvName): EnvValue {
  return process.env[name];
}

function assertValid(name: EnvName, value: string): void {
  if (name === 'UPSTASH_REDIS_REST_URL') {
    // Upstash REST URL looks like: https://<id>.upstash.io or https://<id>.upstash.io/...
    try {
      const u = new URL(value);
      if (u.protocol !== 'https:') {
        throw new Error('must be https');
      }
    } catch {
      throw new Error(`[env] ${name} must be a valid https URL`);
    }
  }

  // Basic token hygiene (helps catch accidental quotes / whitespace)
  if (/\s/.test(value)) {
    throw new Error(`[env] ${name} must not contain whitespace (check for quotes or newlines)`);
  }
}

/**
 * Get a required environment variable.
 * Throws with a clear message if missing or invalid.
 */
export function getEnv(name: EnvName): string {
  const v = rawEnv(name);
  if (!v) {
    throw new Error(`[env] Missing required environment variable: ${name}`);
  }
  assertValid(name, v);
  return v;
}

/**
 * Get an optional environment variable.
 * Returns undefined if missing; throws if present but invalid.
 */
export function optionalEnv(name: EnvName): string | undefined {
  const v = rawEnv(name);
  if (!v) return undefined;
  assertValid(name, v);
  return v;
}

/**
 * Helper for cases where you want a runtime error with a friendly message.
 * Example:
 *   requireApiKey('GROQ_API_KEY')
 */
export function requireApiKey(name: EnvName): string {
  return getEnv(name);
}
