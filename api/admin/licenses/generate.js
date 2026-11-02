import crypto from 'crypto';
import { saveLicense } from '../../../lib/redis.js';

const ADMIN_PIN = process.env.LAFZI_ADMIN_PIN || 'lafzi2025';

function generateRandomKey() {
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `LAFZI-${seg()}-${seg()}-${seg()}`;
}

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
    const count = Math.min(Math.max(parseInt(body.count || 1, 10), 1), 50);
    const note = String(body.note || 'Manual batch').trim();

    const createdKeys = [];
    for (let i = 0; i < count; i++) {
      const key = generateRandomKey();
      const record = {
        key,
        email: body.email || '',
        order_number: `BATCH-${Date.now().toString(36).toUpperCase()}-${i + 1}`,
        status: 'unbound',
        bound_hwid: null,
        provider: 'manual',
        note,
        created_at: Date.now(),
      };
      await saveLicense(key, record);
      createdKeys.push(key);
    }

    return res.status(200).json({
      ok: true,
      message: `Generated ${createdKeys.length} license key(s)`,
      keys: createdKeys,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
