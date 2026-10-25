import { getLicense, saveLicense } from '../../lib/redis.js';
import { signActivation, sanitizeKey } from '../../lib/crypto.js';

const GUMROAD_PRODUCT_ID = process.env.GUMROAD_PRODUCT_ID || 'i6F1q10sSYXQrW1UU4PDHQ==';
const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';

async function verifyGumroad(key) {
  try {
    const res = await fetch(GUMROAD_VERIFY_URL, {
      method: 'POST',
      headers: {
        'User-Agent': 'LafziCloudRegistry/1.0',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        product_id: GUMROAD_PRODUCT_ID,
        license_key: key,
        increment_uses_count: 'false',
      }),
    });

    const data = await res.json();
    if (data.success) {
      const purchase = data.purchase || {};
      if (purchase.refunded) return { valid: false, error: 'This Gumroad license has been refunded.' };
      if (purchase.chargebacked) return { valid: false, error: 'This Gumroad license has been chargebacked.' };
      return { valid: true, purchase };
    }
    return { valid: false, error: data.message || 'License does not exist for Lafzi Studio on Gumroad.' };
  } catch (err) {
    return { valid: false, error: `Could not connect to Gumroad API: ${err.message}` };
  }
}

export default async function handler(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed. Use POST.' });
  }

  try {
    const body = req.body || {};
    const key = sanitizeKey(body.key);
    const machineId = String(body.machine_id || '').trim().toUpperCase();
    const email = String(body.email || '').trim().toLowerCase();
    const platform = String(body.platform || 'unknown').trim();

    if (!key) {
      return res.status(400).json({ ok: false, error: 'License key is required.' });
    }
    if (!machineId) {
      return res.status(400).json({ ok: false, error: 'Hardware machine_id is required for activation.' });
    }

    // 1. Check existing record in cloud registry (Redis)
    let record = await getLicense(key);

    if (record) {
      if (record.status === 'revoked') {
        return res.status(403).json({
          ok: false,
          error: 'This license key has been revoked by the administrator.',
        });
      }

      // If active and bound to a hardware ID
      if (record.status === 'active' && record.bound_hwid) {
        if (record.bound_hwid === machineId) {
          // SAME MACHINE: Permitted reactivation
          record.last_seen_at = Date.now();
          record.platform = platform || record.platform;
          await saveLicense(key, record);

          const sig = signActivation(machineId, key, record.email || email);
          return res.status(200).json({
            ok: true,
            message: 'Device verified. Reactivation approved.',
            signature: sig,
            machine_id: machineId,
            edition: 'studio',
            email: record.email || email,
            status: 'active',
          });
        } else {
          // DIFFERENT MACHINE: Reject immediately!
          const previewHwid = record.bound_hwid.slice(0, 10) + '••••';
          return res.status(403).json({
            ok: false,
            error: `This license key is already cryptographically bound to another device (${previewHwid}). Each license is valid for 1 computer only. Contact support or use Admin Portal to transfer.`,
            bound_hwid_preview: previewHwid,
          });
        }
      }
    }

    // 2. Unbound or New License: Authenticate with Gumroad or developer keys
    let isValid = false;
    let provider = 'gumroad';
    let purchaseInfo = {};
    let resolvedEmail = email;

    // Check developer overrides
    if (['LAFZI-STUDIO-2025', 'LAFZI-STUDIO-PRO-2025', 'LAFZI-DEVELOPER-LICENSE'].includes(key)) {
      isValid = true;
      provider = 'developer';
    } else {
      // Online verification via Gumroad API
      const gumroadRes = await verifyGumroad(key);
      if (gumroadRes.valid) {
        isValid = true;
        purchaseInfo = gumroadRes.purchase || {};
        resolvedEmail = purchaseInfo.email ? purchaseInfo.email.trim().toLowerCase() : email;
      } else {
        return res.status(400).json({
          ok: false,
          error: gumroadRes.error,
        });
      }
    }

    if (!isValid) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid license key. Please check your Gumroad receipt and try again.',
      });
    }

    // 3. Cryptographically bind to this hardware ID in Upstash Redis
    const newRecord = {
      key,
      bound_hwid: machineId,
      email: resolvedEmail,
      platform,
      provider,
      status: 'active',
      order_number: purchaseInfo.order_number || '',
      variant: purchaseInfo.variants || '',
      activated_at: Date.now(),
      last_seen_at: Date.now(),
    };

    await saveLicense(key, newRecord);

    const sig = signActivation(machineId, key, resolvedEmail);
    return res.status(200).json({
      ok: true,
      message: 'License successfully bound to this workstation.',
      signature: sig,
      machine_id: machineId,
      edition: 'studio',
      email: resolvedEmail,
      status: 'active',
    });
  } catch (err) {
    console.error('[Activate Error]', err);
    return res.status(500).json({ ok: false, error: `Internal registry error: ${err.message}` });
  }
}
