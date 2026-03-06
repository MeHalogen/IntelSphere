export type SafeFetchOptions = {
  /** Request init passed to fetch() */
  init?: RequestInit;
  /** Timeout enforced via AbortController (ms). Default 10s. */
  timeoutMs?: number;
  /** Failures required to open the circuit. Default 5. */
  failureThreshold?: number;
  /** Cooldown before allowing a probe request (ms). Default 5 minutes. */
  cooldownMs?: number;
  /** Optional key override for grouping (default is URL host). */
  key?: string;
};

type CircuitState = {
  failures: number;
  openedAtMs: number | null;
};

// Edge runtime note:
// - This is best-effort state. It persists per edge isolate and can reset at any time.
// - That's still useful for preventing tight-loop retries within the same region/isolate.
const circuits = new Map<string, CircuitState>();

function nowMs() {
  return Date.now();
}

function getKey(url: string, override?: string) {
  if (override) return override;
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function isOpen(state: CircuitState, cooldownMs: number, t: number) {
  if (state.openedAtMs == null) return false;
  return t - state.openedAtMs < cooldownMs;
}

function open(state: CircuitState, t: number) {
  state.openedAtMs = t;
}

function close(state: CircuitState) {
  state.failures = 0;
  state.openedAtMs = null;
}

function recordFailure(state: CircuitState, threshold: number, t: number) {
  state.failures += 1;
  if (state.failures >= threshold) open(state, t);
}

export async function safeFetch(url: string, options?: SafeFetchOptions): Promise<Response> {
  const failureThreshold = options?.failureThreshold ?? 5;
  const cooldownMs = options?.cooldownMs ?? 5 * 60_000;
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const key = getKey(url, options?.key);

  const t = nowMs();
  const state = circuits.get(key) ?? { failures: 0, openedAtMs: null };
  circuits.set(key, state);

  if (isOpen(state, cooldownMs, t)) {
    // Circuit open: fail fast.
    throw new Error(`circuit_open:${key}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs);

  try {
    const res = await fetch(url, {
      ...(options?.init ?? {}),
      signal: controller.signal
    });

    // Treat 429 and 5xx as failures for circuit purposes.
    if (!res.ok && (res.status === 429 || res.status >= 500)) {
      recordFailure(state, failureThreshold, nowMs());
      return res;
    }

    // Success: close circuit.
    close(state);
    return res;
  } catch (err) {
    recordFailure(state, failureThreshold, nowMs());
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/** For tests/diagnostics only. */
export function __unsafeGetCircuitState(key: string) {
  return circuits.get(key);
}
