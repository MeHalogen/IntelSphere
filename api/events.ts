import { fetchAllEvents } from './ingestion/fetchAllEvents';

async function withTimeout<T>(p: Promise<T>, timeoutMs: number, label = 'timeout'): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(label)), timeoutMs);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t) clearTimeout(t);
  }
}

export const config = {
  runtime: 'edge'
};

export default async function handler(req: Request): Promise<Response> {
  const timestamp = new Date().toISOString();

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(10_000, Number(url.searchParams.get('limit') ?? 200)));

  try {
    // Dashboard contract: optimized for polling ~30s.
    // Hard overall timeout so the edge function never stalls the UI.
    const { events, errors } = await withTimeout(fetchAllEvents(), 25_000, 'ingestion-timeout');

    if (errors.length > 0) {
      console.warn('[events] partial ingestion errors:', errors);
    }

    const scored = events
      .slice(0, limit)
      .sort((a, b) => (b.severityScore ?? 0) - (a.severityScore ?? 0));

    return new Response(
      JSON.stringify({
        events: scored,
        count: scored.length,
        timestamp
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'public, s-maxage=30, stale-while-revalidate=120'
        }
      }
    );
  } catch (_err) {
    // Fall back to empty array for resilience; keep caching so dashboards don't thundering-herd.
    return new Response(
      JSON.stringify({
        events: [],
        count: 0,
        timestamp
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'public, s-maxage=30, stale-while-revalidate=120'
        }
      }
    );
  }
}
