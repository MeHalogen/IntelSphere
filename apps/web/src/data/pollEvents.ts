import type { CrisisEvent } from '../core/types';

export type EventsPayload = {
  events: CrisisEvent[];
  count: number;
  timestamp: string;
};

type Subscriber = (payload: EventsPayload) => void;

type PollerOptions = {
  url?: string;
  visibleIntervalMs?: number;
  hiddenIntervalMs?: number;
  maxBackoffMs?: number;
  timeoutMs?: number;
};

const DEFAULTS: Required<PollerOptions> = {
  url: '/api/events',
  visibleIntervalMs: 30_000,
  hiddenIntervalMs: 120_000,
  maxBackoffMs: 10 * 60_000,
  timeoutMs: 12_000
};

let running = false;
let timer: number | null = null;
let backoffMs = 0;
let abort: AbortController | null = null;
let opts: Required<PollerOptions> = DEFAULTS;
const subs = new Set<Subscriber>();

function isHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

function baseIntervalMs() {
  return isHidden() ? opts.hiddenIntervalMs : opts.visibleIntervalMs;
}

function scheduleNext(delayMs: number) {
  if (!running) return;
  if (timer != null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void tick();
  }, delayMs);
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<EventsPayload> {
  abort?.abort();
  abort = new AbortController();

  const t = window.setTimeout(() => abort?.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: abort.signal,
      headers: {
        accept: 'application/json'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as EventsPayload;
  } finally {
    window.clearTimeout(t);
  }
}

function nextBackoff(prev: number) {
  // Exponential backoff with jitter; deterministic-ish but not synchronized across tabs.
  const next = prev ? Math.min(opts.maxBackoffMs, prev * 2) : 1_000;
  const jitter = Math.round(next * (0.2 * Math.random()));
  return next + jitter;
}

async function tick() {
  if (!running) return;

  try {
    const payload = await fetchWithTimeout(opts.url, opts.timeoutMs);

    // Success: reset backoff and notify.
    backoffMs = 0;
    for (const s of subs) s(payload);

    scheduleNext(baseIntervalMs());
  } catch {
    // Failure: keep last good events (subscribers do that) and retry with backoff.
    backoffMs = nextBackoff(backoffMs);
    scheduleNext(backoffMs);
  }
}

function onVisibilityChange() {
  if (!running) return;
  // Re-schedule relative to the new base interval (don’t wait 2 minutes after coming back).
  scheduleNext(Math.min(1_000, baseIntervalMs()));
}

/**
 * Start polling /api/events.
 *
 * Subscribe to updates with `onEventsUpdated()`.
 */
export function startPolling(options?: PollerOptions) {
  if (running) return;
  running = true;
  opts = { ...DEFAULTS, ...(options ?? {}) };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  // Fire immediately.
  scheduleNext(0);
}

export function stopPolling() {
  running = false;
  abort?.abort();
  abort = null;

  if (timer != null) {
    window.clearTimeout(timer);
    timer = null;
  }

  backoffMs = 0;

  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }
}

/** Register a listener to receive new event payloads. Returns an unsubscribe function. */
export function onEventsUpdated(fn: Subscriber) {
  subs.add(fn);
  return () => subs.delete(fn);
}
