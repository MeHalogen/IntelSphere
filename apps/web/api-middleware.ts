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

          if (path === '/api/events') {
            const mod = await server.ssrLoadModule(resolve(REPO_ROOT, 'api/events.ts'));
            handler = mod.default;
          } else if (path === '/api/feed') {
            const mod = await server.ssrLoadModule(resolve(REPO_ROOT, 'api/feed.ts'));
            handler = mod.default;
          } else if (path === '/api/ai/brief') {
            const mod = await server.ssrLoadModule(resolve(REPO_ROOT, 'api/ai/brief.ts'));
            handler = mod.default;
          }

          if (!handler) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Not found' }));
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
