import http from 'http';
import { URL } from 'url';

import activateHandler from './api/license/activate.js';
import unbindHandler from './api/license/unbind.js';
import revokeHandler from './api/license/revoke.js';
import adminLicensesHandler from './api/admin/licenses.js';
import adminAlertHandler from './api/admin/alert.js';
import adminMetricsHandler from './api/admin/metrics.js';
import updatesHandler from './api/updates.js';
import webhookHandler from './api/gumroad/webhook.js';
import trackDownloadHandler from './api/downloads/track.js';

const PORT = process.env.PORT || 3002;

const routes = {
  '/api/license/activate': activateHandler,
  '/api/license/unbind': unbindHandler,
  '/api/license/revoke': revokeHandler,
  '/api/admin/licenses': adminLicensesHandler,
  '/api/admin/alert': adminAlertHandler,
  '/api/admin/metrics': adminMetricsHandler,
  '/api/updates': updatesHandler,
  '/api/gumroad/webhook': webhookHandler,
  '/api/downloads/track': trackDownloadHandler,
};

function addCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Pin');
}

const server = http.createServer(async (req, res) => {
  addCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const handler = routes[pathname];

  if (!handler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'Route not found' }));
  }

  // Parse query params into req.query
  req.query = Object.fromEntries(parsedUrl.searchParams.entries());

  // Parse JSON body if present
  let bodyBuffer = '';
  req.on('data', chunk => {
    bodyBuffer += chunk;
  });

  req.on('end', async () => {
    try {
      req.body = bodyBuffer ? JSON.parse(bodyBuffer) : {};
    } catch {
      // Form URL-encoded fallback
      req.body = Object.fromEntries(new URLSearchParams(bodyBuffer).entries());
    }

    // Mock Vercel response helpers if not native
    res.status = function (code) {
      this.statusCode = code;
      return this;
    };
    res.json = function (obj) {
      this.setHeader('Content-Type', 'application/json');
      return this.end(JSON.stringify(obj, null, 2));
    };

    try {
      await handler(req, res);
    } catch (err) {
      console.error('[Server Handler Error]', err);
      if (!res.writableEnded) {
        res.status(500).json({ ok: false, error: err.message });
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`⚡ Lafzi Cloud Registry running locally on http://localhost:${PORT}`);
  console.log(`   - POST /api/license/activate`);
  console.log(`   - GET  /api/admin/licenses`);
  console.log(`   - GET  /api/updates`);
});
