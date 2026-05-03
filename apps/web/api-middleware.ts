/**
 * Vite plugin that intercepts /api/* requests during local dev and
 * forwards them to the Edge-style TS handlers in ../../api/*.ts.
 *
 * Vite's SSR pipeline handles TS natively, so no build step needed.
 */

// @ts-nocheck
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

export function apiMiddleware() {
  return {
    name: 'crisis-monitor-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
        const path = url.pathname;

        if (!path.startsWith('/api/')) return next();

        try {
          let handler;
          let modulePath;

          // Map URL paths to file paths
          if (path === '/api/events') {
            modulePath = 'api/events.ts';
          } else if (path === '/api/feed') {
            modulePath = 'api/feed.ts';
          } else if (path === '/api/ai/brief' || path.startsWith('/api/ai/brief?')) {
            modulePath = 'api/ai/brief.ts';
          } else if (path === '/api/ai/global-brief-api' || path.startsWith('/api/ai/global-brief-api?')) {
            modulePath = 'api/ai/global-brief-api.ts';
          } else if (path === '/api/flights' || path.startsWith('/api/flights?')) {
            modulePath = 'api/flights.ts';
          } else if (path === '/api/intelligence/global-risk' || path.startsWith('/api/intelligence/global-risk?')) {
            modulePath = 'api/intelligence/global-risk.ts';
          } else if (path === '/api/intelligence/hotspots-api' || path.startsWith('/api/intelligence/hotspots-api?')) {
            modulePath = 'api/intelligence/hotspots-api.ts';
          } else if (path === '/api/intelligence/trends-api' || path.startsWith('/api/intelligence/trends-api?')) {
            modulePath = 'api/intelligence/trends-api.ts';
          } else if (path === '/api/intelligence/correlations' || path.startsWith('/api/intelligence/correlations?')) {
            modulePath = 'api/intelligence/correlations.ts';
          } else if (path === '/api/intelligence/signals' || path.startsWith('/api/intelligence/signals?')) {
            modulePath = 'api/intelligence/signals.ts';
          } else if (path === '/api/intelligence/timeline-api' || path.startsWith('/api/intelligence/timeline-api?')) {
            modulePath = 'api/intelligence/timeline-api.ts';
          }

          if (modulePath) {
            const mod = await server.ssrLoadModule(resolve(REPO_ROOT, modulePath));
            handler = mod.default;
          }

          if (!handler) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found', path }));
            return;
          }

          const edgeReq = new Request(url.toString(), {
            method: req.method,
            headers: req.headers,
          });

          const edgeRes = await handler(edgeReq);

          res.statusCode = edgeRes.status;
          edgeRes.headers.forEach((v, k) => res.setHeader(k, v));
          const body = Buffer.from(await edgeRes.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error('[api-middleware]', err?.message ?? err);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: err?.message ?? 'Internal error' }));
        }
      });
    },
  };
}
