import { describe, it, expect } from 'vitest';
import handler from '../api/events';

describe('smoke: /api/events handler', () => {
  it('returns JSON with { events, count, timestamp }', async () => {
    const req = new Request('http://localhost/api/events?limit=50', {
      headers: {
        accept: 'application/json',
        'user-agent': 'smoke-events/1.0',
      },
    });

    const res = await handler(req);
    expect(res).toBeInstanceOf(Response);

    const ct = res.headers.get('content-type') ?? '';
    expect(ct).toContain('application/json');

    // Note: upstream fetches can fail transiently; the handler should still return a valid shape.
    const body = await res.json();
    expect(body).toBeTruthy();
    expect(Array.isArray(body.events)).toBe(true);
    expect(typeof body.count).toBe('number');
    expect(typeof body.timestamp).toBe('string');

    if (body.events.length > 0) {
      const e = body.events[0];
      expect(typeof e.id).toBe('string');
      expect(typeof e.title).toBe('string');
      expect(typeof e.time).toBe('string');
      expect(typeof e.layer).toBe('string');
      expect(typeof e.lat).toBe('number');
      expect(typeof e.lon).toBe('number');
      expect(typeof e.severityScore).toBe('number');
      expect(typeof e.severityLabel).toBe('string');
    }
  }, 30_000);
});
