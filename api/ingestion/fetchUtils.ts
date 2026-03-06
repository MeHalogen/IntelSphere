import { safeFetch } from '../_lib/safeFetch';

type RetryOptions = {
  retries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
};

const DEFAULT_RETRY: RetryOptions = {
  retries: 2,
  baseDelayMs: 350,
  maxDelayMs: 3000,
  timeoutMs: 8000
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout(timeoutMs: number): AbortController {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  // @ts-expect-error - keep-alive cleanup hook
  controller.__timeout = t;
  return controller;
}

function clearControllerTimeout(controller: AbortController) {
  // @ts-expect-error - internal
  const t = controller.__timeout as ReturnType<typeof setTimeout> | undefined;
  if (t) clearTimeout(t);
}

function jitter(ms: number) {
  const factor = 0.6 + Math.random() * 0.8;
  return Math.round(ms * factor);
}

function shouldRetry(status?: number) {
  if (!status) return true; // network
  if (status === 429) return true;
  return status >= 500;
}

export async function fetchJson<T>(url: string, init?: RequestInit, opts?: Partial<RetryOptions>): Promise<T> {
  const o: RetryOptions = { ...DEFAULT_RETRY, ...(opts ?? {}) };

  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= o.retries) {
    const controller = withTimeout(o.timeoutMs);
    try {
      const res = await safeFetch(url, {
        timeoutMs: o.timeoutMs,
        init: {
          ...init,
          signal: controller.signal,
          headers: {
            accept: 'application/json',
            ...(init?.headers ?? {})
          }
        }
      });

      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} for ${url}`);
        (err as any).status = res.status;
        if (attempt < o.retries && shouldRetry(res.status)) {
          const delay = Math.min(o.maxDelayMs, o.baseDelayMs * 2 ** attempt);
          await sleep(jitter(delay));
          attempt++;
          continue;
        }
        throw err;
      }

      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      const status = (e as any)?.status as number | undefined;
      const aborted = (e as any)?.name === 'AbortError';

      if (attempt < o.retries && (aborted || shouldRetry(status))) {
        const delay = Math.min(o.maxDelayMs, o.baseDelayMs * 2 ** attempt);
        await sleep(jitter(delay));
        attempt++;
        continue;
      }
      throw e;
    } finally {
      clearControllerTimeout(controller);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('fetchJson failed');
}

export async function fetchText(url: string, init?: RequestInit, opts?: Partial<RetryOptions>): Promise<string> {
  const o: RetryOptions = { ...DEFAULT_RETRY, ...(opts ?? {}) };

  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= o.retries) {
    const controller = withTimeout(o.timeoutMs);
    try {
      const res = await safeFetch(url, {
        timeoutMs: o.timeoutMs,
        init: {
          ...init,
          signal: controller.signal,
          headers: {
            accept: 'text/plain,text/xml,application/xml,*/*',
            ...(init?.headers ?? {})
          }
        }
      });

      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} for ${url}`);
        (err as any).status = res.status;
        if (attempt < o.retries && shouldRetry(res.status)) {
          const delay = Math.min(o.maxDelayMs, o.baseDelayMs * 2 ** attempt);
          await sleep(jitter(delay));
          attempt++;
          continue;
        }
        throw err;
      }

      return await res.text();
    } catch (e) {
      lastErr = e;
      const status = (e as any)?.status as number | undefined;
      const aborted = (e as any)?.name === 'AbortError';

      if (attempt < o.retries && (aborted || shouldRetry(status))) {
        const delay = Math.min(o.maxDelayMs, o.baseDelayMs * 2 ** attempt);
        await sleep(jitter(delay));
        attempt++;
        continue;
      }
      throw e;
    } finally {
      clearControllerTimeout(controller);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('fetchText failed');
}

export async function isolate<T>(name: string, fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `[${name}] ${msg}` };
  }
}
