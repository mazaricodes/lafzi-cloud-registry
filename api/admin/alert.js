import { getAlert, saveAlert, getUpdatesManifest, saveUpdatesManifest } from '../../lib/redis.js';

const ADMIN_PIN = process.env.LAFZI_ADMIN_PIN || 'lafzi2025';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pin =
    req.body?.admin_pin ||
    req.query.admin_pin ||
    req.headers['x-admin-pin'] ||
    (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : '');

  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid Admin PIN' });
  }

  if (req.method === 'GET') {
    const alert = await getAlert();
    const updates = await getUpdatesManifest();
    return res.status(200).json({ ok: true, alert, updates });
  }

  if (req.method === 'POST') {
    try {
      const { alert, updates } = req.body || {};
      let updatedAlert = null;
      let updatedManifest = null;

      if (alert) {
        updatedAlert = await saveAlert(alert);
      }
      if (updates) {
        updatedManifest = await saveUpdatesManifest(updates);
      }

      return res.status(200).json({
        ok: true,
        message: 'Broadcast alert & updates manifest saved.',
        alert: updatedAlert || (await getAlert()),
        updates: updatedManifest || (await getUpdatesManifest()),
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
