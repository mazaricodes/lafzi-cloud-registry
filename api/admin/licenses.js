import { getAllLicenses } from '../../lib/redis.js';

const ADMIN_PIN = process.env.LAFZI_ADMIN_PIN || 'lafzi2025';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pin =
    req.query.admin_pin ||
    req.headers['x-admin-pin'] ||
    (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : '');

  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid Admin PIN' });
  }

  try {
    const list = await getAllLicenses();
    return res.status(200).json({
      ok: true,
      count: list.length,
      licenses: list,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
