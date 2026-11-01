import { getDbStatus, getUpdatesManifest } from '../lib/redis.js';

export default async function handler(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  const acceptsHtml = (req.headers.accept || '').includes('text/html');
  const dbStatus = await getDbStatus();
  const updates = await getUpdatesManifest();

  if (acceptsHtml && !req.query.json) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lafzi Cloud Registry — Status</title>
  <style>
    body {
      background: #0d0d11;
      color: #f8f5f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: #18181f;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      max-width: 540px;
      width: 100%;
      padding: 32px 28px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.76rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 16px;
    }
    .badge.online {
      background: rgba(0, 255, 178, 0.12);
      border: 1px solid rgba(0, 255, 178, 0.35);
      color: #00ffb2;
    }
    .badge.warning {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #fbbf24;
    }
    h1 {
      font-size: 1.45rem;
      font-weight: 800;
      margin: 0 0 8px;
    }
    p {
      color: #a0a0ab;
      font-size: 0.88rem;
      line-height: 1.5;
      margin: 0 0 20px;
    }
    .status-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 0.84rem;
    }
    .status-row:last-child {
      border-bottom: none;
    }
    .status-row strong {
      color: #fff;
    }
    .links {
      display: flex;
      gap: 10px;
      margin-top: 24px;
    }
    .btn {
      flex: 1;
      text-align: center;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.84rem;
      font-weight: 700;
      text-decoration: none;
      transition: opacity 0.15s;
    }
    .btn-primary {
      background: #ef2b2d;
      color: #fff;
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.14);
    }
    .btn:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge ${dbStatus.connected ? 'online' : 'warning'}">
      ● ${dbStatus.connected ? 'Cloud Database Connected' : 'Running (No Database Connected)'}
    </div>
    <h1>Lafzi Cloud Registry & Licensing API</h1>
    <p>Operational serverless backend powering Lafzi updates, hardware-bound studio licensing, and telemetry analytics.</p>
    
    <div class="status-row">
      <span>Service Status:</span>
      <strong style="color: #00ffb2;">✓ Online (HTTP 200)</strong>
    </div>
    <div class="status-row">
      <span>Database Persistence:</span>
      <strong style="color: ${dbStatus.connected ? '#00ffb2' : '#fbbf24'};">
        ${dbStatus.connected ? 'Upstash Redis (Active)' : 'In-Memory (Ephemeral)'}
      </strong>
    </div>
    <div class="status-row">
      <span>Latest Release:</span>
      <strong>v${updates.latest_version || '1.0.0'}</strong>
    </div>

    <div class="links">
      <a href="https://aurafi.studio/products/lafzi/thisissecret.html" class="btn btn-primary">
        Open Admin Portal ↗
      </a>
      <a href="https://aurafi.studio/products/lafzi/" class="btn btn-secondary">
        Official Website ↗
      </a>
    </div>
  </div>
</body>
</html>`);
  }

  return res.status(200).json({
    ok: true,
    service: 'Lafzi Cloud Registry & Licensing API',
    status: 'online',
    version: updates.latest_version || '1.0.0',
    database: dbStatus,
    admin_portal: 'https://aurafi.studio/products/lafzi/thisissecret.html',
    website: 'https://aurafi.studio/products/lafzi/',
  });
}
