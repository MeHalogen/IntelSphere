/**
 * Local dev API server — run with `tsx scripts/dev-api.ts`.
 *
 * Bridges Vercel Edge-style handlers (Request → Response) to a plain Node HTTP server
 * so that the Vite dev server can proxy /api/* to this process.
 */
import http from 'node:http';
import { URL } from 'node:url';

// Import the Edge handlers directly — tsx handles .ts imports natively.
import eventsHandler from '../api/events';
import feedHandler from '../api/feed';
import aiBriefHandler from '../api/ai/brief';
import flightsHandler from '../api/flights';
import globalRiskHandler from '../api/intelligence/global-risk';
import hotspotsHandler from '../api/intelligence/hotspots-api';
import trendsHandler from '../api/intelligence/trends-api';
import correlationsHandler from '../api/intelligence/correlations';
import signalsHandler from '../api/intelligence/signals';
import timelineHandler from '../api/intelligence/timeline-api';
import globalBriefHandler from '../api/ai/global-brief-api';

type EdgeHandler = (req: Request) => Promise<Response>;

const routes: Array<{ path: string; handler: EdgeHandler }> = [
  { path: '/api/events', handler: eventsHandler as unknown as EdgeHandler },
  { path: '/api/feed', handler: feedHandler as unknown as EdgeHandler },
  { path: '/api/ai/brief', handler: aiBriefHandler as unknown as EdgeHandler },
  { path: '/api/flights', handler: flightsHandler as unknown as EdgeHandler },
  { path: '/api/intelligence/global-risk', handler: globalRiskHandler as unknown as EdgeHandler },
  { path: '/api/intelligence/hotspots-api', handler: hotspotsHandler as unknown as EdgeHandler },
  { path: '/api/intelligence/trends-api', handler: trendsHandler as unknown as EdgeHandler },
  { path: '/api/intelligence/correlations', handler: correlationsHandler as unknown as EdgeHandler },
  { path: '/api/intelligence/signals', handler: signalsHandler as unknown as EdgeHandler },
  { path: '/api/intelligence/timeline-api', handler: timelineHandler as unknown as EdgeHandler },
  { path: '/api/ai/global-brief-api', handler: globalBriefHandler as unknown as EdgeHandler },
];

async function callEdgeHandler(handler: EdgeHandler, nodeReq: http.IncomingMessage, urlObj: URL): Promise<Response> {
  // Build a Web-standard Request from the Node request.
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(nodeReq.headers)) {
    if (typeof v === 'string') headers[k] = v;
    else if (Array.isArray(v)) headers[k] = v.join(', ');
  }

  const edgeReq = new Request(urlObj.toString(), {
    method: nodeReq.method ?? 'GET',
    headers,
  });

  return handler(edgeReq);
}

const PORT = Number(process.env.PORT ?? 3001);

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const pathname = urlObj.pathname;

  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Health check
  if (pathname === '/health') {
    res.statusCode = 200;
    res.setHeader('content-type', 'text/plain');
    res.end('ok');
    return;
  }

  // Match a route
  const route = routes.find((r) => pathname === r.path || pathname.startsWith(r.path + '?'));
  if (!route) {
    res.statusCode = 404;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'not found', pathname }));
    return;
  }

  try {
    const edgeRes = await callEdgeHandler(route.handler, req, urlObj);

    res.statusCode = edgeRes.status;
    edgeRes.headers.forEach((v, k) => res.setHeader(k, v));
    const buf = Buffer.from(await edgeRes.arrayBuffer());
    res.end(buf);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[dev-api] ${pathname} error:`, message);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'dev-api handler error', message }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  🔥 dev-api listening on http://127.0.0.1:${PORT}\n`);
  console.log(`  Routes:`);
  for (const r of routes) console.log(`    ${r.path}`);
  console.log('');
});
