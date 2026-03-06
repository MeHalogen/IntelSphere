import { config } from '../_lib/config';

export type AcledReadResponse = {
  // ACLED returns a nested JSON envelope; keep it flexible.
  // https://acleddata.com/resources/documentation/
  success?: boolean | number;
  message?: string;
  data?: unknown;
};

/**
 * ACLED Read API wrapper.
 *
 * NOTE: ACLED parameters can be extensive; this helper accepts a params bag.
 *
 * - Uses `config.geopolitics.acledKey` only.
 * - Returns null if ACLED_ACCESS_TOKEN is not set.
 * - Never logs or returns the API key.
 */
export async function fetchAcledRead(params: Record<string, string>): Promise<AcledReadResponse | null> {
  const key = config.geopolitics.acledKey;
  if (!key) {
    console.warn('[geopolitics] ACLED disabled: missing ACLED_ACCESS_TOKEN');
    return null;
  }

  const u = new URL('https://api.acleddata.com/acled/read');
  u.searchParams.set('key', key);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') u.searchParams.set(k, v);
  }

  const res = await fetch(u.toString(), {
    headers: { accept: 'application/json' }
  });

  if (!res.ok) {
    throw new Error(`[geopolitics] ACLED HTTP ${res.status}`);
  }

  return (await res.json()) as AcledReadResponse;
}
