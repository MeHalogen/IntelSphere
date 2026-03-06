// Minimal smoke test runner for the Edge-style handler in api/events.ts
// Runs in Node; uses global fetch/Request/Response (Node 18+).

import { handler } from '../api/events.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const req = new Request('http://localhost/api/events?limit=50', {
    headers: {
      // mimic a dashboard poller
      'user-agent': 'smoke-events/1.0',
      accept: 'application/json',
    },
  });

  const res = await handler(req);
  assert(res instanceof Response, 'handler() did not return a Response');
  assert(res.status >= 200 && res.status < 600, `unexpected status: ${res.status}`);

  const ct = res.headers.get('content-type') ?? '';
  assert(ct.includes('application/json'), `expected JSON content-type; got: ${ct}`);

  const body = await res.json();
  assert(body && typeof body === 'object', 'response JSON was not an object');
  assert(Array.isArray(body.events), 'response.events is not an array');
  assert(typeof body.count === 'number', 'response.count is not a number');
  assert(typeof body.timestamp === 'string', 'response.timestamp is not a string');

  // Validate first event shape (if any)
  if (body.events.length > 0) {
    const e = body.events[0];
    assert(typeof e.id === 'string', 'event.id missing');
    assert(typeof e.title === 'string', 'event.title missing');
    assert(typeof e.time === 'string', 'event.time missing');
    assert(typeof e.layer === 'string', 'event.layer missing');
    assert(typeof e.lat === 'number', 'event.lat missing');
    assert(typeof e.lon === 'number', 'event.lon missing');

    // severity should exist after scoring
    assert(typeof e.severityScore === 'number', 'event.severityScore missing');
    assert(typeof e.severityLabel === 'string', 'event.severityLabel missing');
  }

  // Print a compact success summary
  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        status: res.status,
        count: body.count,
        sampleTitle: body.events?.[0]?.title ?? null,
      },
      null,
      2,
    ) + '\n',
  );
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
