import { config } from '../_lib/config';

export type FinnhubQuote = {
  c: number; // current
  d: number; // change
  dp: number; // percent change
  h: number; // high
  l: number; // low
  o: number; // open
  pc: number; // prev close
  t: number; // timestamp
};

/**
 * Fetch a quote from Finnhub.
 *
 * - Uses `config.markets.finnhubKey` only.
 * - Returns null if FINNHUB_API_KEY is not set.
 * - Never logs or returns the API key.
 */
export async function fetchFinnhubQuote(symbol: string): Promise<FinnhubQuote | null> {
  const key = config.markets.finnhubKey;
  if (!key) {
    console.warn('[markets] Finnhub disabled: missing FINNHUB_API_KEY');
    return null;
  }

  const u = new URL('https://finnhub.io/api/v1/quote');
  u.searchParams.set('symbol', symbol);
  u.searchParams.set('token', key);

  const res = await fetch(u.toString(), {
    headers: { accept: 'application/json' }
  });

  if (!res.ok) {
    throw new Error(`[markets] Finnhub HTTP ${res.status}`);
  }

  return (await res.json()) as FinnhubQuote;
}
