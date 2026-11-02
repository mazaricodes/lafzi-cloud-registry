import { getUpdatesManifest, saveUpdatesManifest } from '../../../lib/redis.js';

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
    const target = body.platform || body.target || 'all';
    const manifest = (await getUpdatesManifest()) || {};

    let platforms = { ...(manifest.platforms || {}) };

    if (target === 'all') {
      manifest.recalled = true;
      manifest.active = false;
      Object.keys(platforms).forEach((k) => {
        platforms[k] = {
          ...platforms[k],
          active: false,
          recalled: true,
          updated_at: Date.now(),
        };
      });
    } else if (platforms[target]) {
      platforms[target] = {
        ...platforms[target],
        active: false,
        recalled: true,
        updated_at: Date.now(),
      };
    }

    const updated = await saveUpdatesManifest({
      ...manifest,
      platforms,
      recalled: target === 'all' ? true : Boolean(manifest.recalled),
      active: target === 'all' ? false : (manifest.active !== false),
    });

    const targetLabel = target === 'all' ? 'all devices' : target;

    return res.status(200).json({
      ok: true,
      message: `✓ Software update notification recalled and dismissed for ${targetLabel}.`,
      target,
      updates: updated,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
