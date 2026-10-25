import { getLicense, saveLicense } from '../../lib/redis.js';
import { sanitizeKey } from '../../lib/crypto.js';

const ADMIN_PIN = process.env.LAFZI_ADMIN_PIN || 'lafzi2025';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });

  try {
    const { key, admin_pin, reason } = req.body || {};
    const normKey = sanitizeKey(key);

    if (admin_pin !== ADMIN_PIN) {
      return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid Admin PIN' });
    }
    if (!normKey) {
      return res.status(400).json({ ok: false, error: 'License key is required.' });
    }

    let record = await getLicense(normKey);
    if (!record) {
      // Create a revoked entry to block future activations of this key
      record = {
        key: normKey,
        email: '',
        bound_hwid: null,
        provider: 'revoked',
        created_at: Date.now(),
      };
    }

    record.status = 'revoked';
    record.revoked_at = Date.now();
    record.revoke_reason = reason || 'Revoked by administrator';
    await saveLicense(normKey, record);

    return res.status(200).json({
      ok: true,
      message: `License ${normKey} has been permanently revoked.`,
      license: record,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
