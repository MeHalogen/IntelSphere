import http from 'node:http';
import { URL } from 'node:url';

import feedHandler from '../api/feed.js';
import aiBriefHandler from '../api/ai/brief.js';

async function callEdgeHandler(edgeHandler, nodeReq, urlObj, nodeRes) {
  const edgeReq = new Request(urlObj.toString(), {
    method: nodeReq.method,
    headers: nodeReq.headers,
  });
  const edgeRes = await edgeHandler(edgeReq);

  nodeRes.statusCode = edgeRes.status;
  edgeRes.headers.forEach((v, k) => nodeRes.setHeader(k, v));
  const buf = Buffer.from(await edgeRes.arrayBuffer());
  nodeRes.end(buf);
}

const port = Number(process.env.PORT ?? 3000);

function toVercelLikeReq(req, urlObj) {
  const query = Object.fromEntries(urlObj.searchParams.entries());
  return {
    method: req.method,
    headers: req.headers,
    query
  };
}

function toVercelLikeRes(res) {
  return {
    setHeader: (k, v) => res.setHeader(k, v),
    status: (code) => {
      res.statusCode = code;
      return {
        send: (body) => res.end(body),
        json: (obj) => {
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(obj));
        }
      };
    },
    send: (body) => res.end(body),
    json: (obj) => {
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(obj));
    }
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
    const path = urlObj.pathname;

    if (path === '/health') {
      res.statusCode = 200;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end('ok');
      return;
    }

    if (path === '/api/feed') {
      await feedHandler(toVercelLikeReq(req, urlObj), toVercelLikeRes(res));
      return;
    }

    if (path === '/api/events') {
  // Load TS module at runtime; Node won't resolve TS -> JS by default.
  const mod = await import('../api/events.ts');
  await callEdgeHandler(mod.default, req, urlObj, res);
      return;
    }

    if (path === '/api/ai/brief') {
      await aiBriefHandler(toVercelLikeReq(req, urlObj), toVercelLikeRes(res));
      return;
    }

    res.statusCode = 404;
    res.end();
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'dev-api failed', message: err?.message ?? String(err) }));
  }
});

server.listen(port, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`[dev-api] listening on http://127.0.0.1:${port}`);
});
