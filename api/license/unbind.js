import { getLicense, saveLicense } from '../../lib/redis.js';
import { sanitizeKey } from '../../lib/crypto.js';

const ADMIN_PIN = process.env.LAFZI_ADMIN_PIN || 'lafzi2025';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });

  try {
    const { key, admin_pin } = req.body || {};
    const normKey = sanitizeKey(key);

    if (admin_pin !== ADMIN_PIN) {
      return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid Admin PIN' });
    }
    if (!normKey) {
      return res.status(400).json({ ok: false, error: 'License key is required.' });
    }

    const record = await getLicense(normKey);
    if (!record) {
      return res.status(404).json({ ok: false, error: 'License key not found in registry.' });
    }

    const previousHwid = record.bound_hwid;
    record.bound_hwid = null;
    record.status = 'unbound';
    record.unbound_at = Date.now();
    await saveLicense(normKey, record);

    return res.status(200).json({
      ok: true,
      message: `License ${normKey} successfully unbound from ${previousHwid}. It can now be activated on a new workstation.`,
      license: record,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
