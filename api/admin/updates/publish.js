import { saveUpdatesManifest, getUpdatesManifest } from '../../../lib/redis.js';

const ADMIN_PIN = process.env.LAFZI_ADMIN_PIN || 'lafzi2025';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const pin =
    req.body?.admin_pin ||
    req.query.admin_pin ||
    req.headers['x-admin-pin'] ||
    (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : '');

  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid Admin PIN' });
  }

  try {
    const body = req.body || {};
    const version = body.version || body.latest_version;
    if (!version) {
      return res.status(400).json({ ok: false, error: 'Version string is required' });
    }

    const downloads = body.downloads || body.download_urls || {};
    const manifest = await saveUpdatesManifest({
      latest_version: version,
      release_notes: body.release_notes || body.notes || '',
      mandatory: Boolean(body.mandatory),
      downloads,
      download_urls: downloads,
    });

    return res.status(200).json({
      ok: true,
      message: `Software update v${version} published successfully!`,
      manifest,
      updates: manifest,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
