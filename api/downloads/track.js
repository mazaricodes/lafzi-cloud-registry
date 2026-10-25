import { incrementDownload } from '../../lib/redis.js';

export default async function handler(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let platform = 'macos_arm64';
    if (req.method === 'POST') {
      const body = req.body || {};
      platform = body.platform || req.query?.platform || 'macos_arm64';
    } else {
      platform = req.query?.platform || 'macos_arm64';
    }

    const result = await incrementDownload(platform);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
