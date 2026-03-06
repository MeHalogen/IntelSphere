import { describe, it, expect } from 'vitest';
import eventsHandler from './events';
import briefHandler from './ai/brief.ts';

function expectJson(res: Response) {
  const ct = res.headers.get('content-type') ?? '';
  expect(ct).toContain('application/json');
}

describe('api contract', () => {
  it('GET /api/events returns {events,count,timestamp} and events match schema', async () => {
    const req = new Request('http://localhost/api/events?limit=25', {
      headers: { accept: 'application/json' }
    });

    const res = await eventsHandler(req);
    expect(res.status).toBe(200);
    expectJson(res);

    const body = await res.json();
    expect(Array.isArray(body.events)).toBe(true);
    expect(typeof body.count).toBe('number');
    expect(typeof body.timestamp).toBe('string');

    // We allow 0 events on transient upstream failures, but when present validate shape.
    for (const e of body.events.slice(0, 5)) {
      expect(typeof e.id).toBe('string');
      expect(typeof e.source).toBe('string');
      expect(typeof e.layer).toBe('string');
      expect(typeof e.title).toBe('string');
      expect(typeof e.time).toBe('string');
      expect(typeof e.lat).toBe('number');
      expect(typeof e.lon).toBe('number');
      expect(typeof e.severityScore).toBe('number');
      expect(typeof e.severityLabel).toBe('string');

      if (e.links) {
        expect(typeof e.links).toBe('object');
      }
    }
  }, 30_000);

  it('GET /api/ai/brief returns 400 without eventId', async () => {
    const req = new Request('http://localhost/api/ai/brief', {
      headers: { accept: 'application/json' }
    });

    const res = await briefHandler(req);
    expect(res.status).toBe(400);
    expectJson(res);

    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('GET /api/ai/brief returns fallback brief without keys', async () => {
    const req = new Request('http://localhost/api/ai/brief?eventId=test:event', {
      headers: { accept: 'application/json' }
    });

    const res = await briefHandler(req);
    expect(res.status).toBe(200);
    expectJson(res);

    const body = await res.json();
    expect(typeof body.shortBrief).toBe('string');
    expect(Array.isArray(body.keyRisks)).toBe(true);
    expect(Array.isArray(body.expectedImpact)).toBe(true);
    expect(Array.isArray(body.recommendedMonitoringActions)).toBe(true);
    expect(typeof body.generatedAt).toBe('string');
  });
});
