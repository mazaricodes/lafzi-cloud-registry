import { saveLicense, getLicense } from '../../lib/redis.js';
import { sanitizeKey } from '../../lib/crypto.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const payload = req.body || {};
    const eventType = payload.event_type || 'sale';
    const licenseKey = sanitizeKey(payload.license_key);
    const email = String(payload.email || '').trim().toLowerCase();
    const orderNumber = payload.order_number || payload.sale_id || '';
    const refunded = Boolean(payload.refunded || eventType === 'refund');
    const chargebacked = Boolean(payload.chargebacked || payload.disputed);

    console.log(`[Gumroad Webhook] Received ${eventType} for order #${orderNumber}, key: ${licenseKey}`);

    if (licenseKey) {
      const existing = (await getLicense(licenseKey)) || {};

      if (refunded || chargebacked) {
        existing.status = 'revoked';
        existing.revoked_at = Date.now();
        existing.revoke_reason = refunded ? 'Refunded on Gumroad' : 'Chargeback/Dispute on Gumroad';
        await saveLicense(licenseKey, existing);
        return res.status(200).json({ ok: true, action: 'revoked', key: licenseKey });
      }

      // Pre-seed or update key
      const record = {
        ...existing,
        key: licenseKey,
        email: email || existing.email,
        order_number: orderNumber,
        status: existing.status || 'unbound',
        bound_hwid: existing.bound_hwid || null,
        provider: 'gumroad',
        created_at: existing.created_at || Date.now(),
      };
      await saveLicense(licenseKey, record);
    }

    return res.status(200).json({ ok: true, recorded: true });
  } catch (err) {
    console.error('[Gumroad Webhook Error]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
