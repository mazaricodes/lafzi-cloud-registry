import { getAllLicenses, getAlert, getUpdatesManifest } from '../../lib/redis.js';

const ADMIN_PIN = process.env.LAFZI_ADMIN_PIN || 'lafzi2025';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pin =
    req.query.admin_pin ||
    req.headers['x-admin-pin'] ||
    (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : '');

  // If PIN is provided, verify it. If not provided in query, permit read-only metrics overview
  if (pin && pin !== ADMIN_PIN) {
    return res.status(401).json({ ok: false, error: 'Invalid Admin PIN' });
  }

  try {
    const licenses = await getAllLicenses();
    const alert = await getAlert();
    const updates = await getUpdatesManifest();

    const activeLicenses = licenses.filter(l => l.status === 'active');
    const revokedLicenses = licenses.filter(l => l.status === 'revoked');
    const unboundLicenses = licenses.filter(l => l.status === 'unbound');

    const totalOrders = licenses.filter(l => l.provider === 'gumroad').length;
    const grossRevenue = totalOrders * 10; // $10 per Studio license

    return res.status(200).json({
      ok: true,
      revenue: {
        total: grossRevenue,
        currency_symbol: '$',
        currency: 'USD',
        order_count: totalOrders,
        base_price: 10,
      },
      licenses: {
        total_issued: licenses.length,
        active_available: activeLicenses.length,
        revoked: revokedLicenses.length,
        unbound: unboundLicenses.length,
      },
      users: {
        total_installs: activeLicenses.length,
        studio_installs: activeLicenses.length,
        base_installs: 0,
      },
      downloads: {
        total: licenses.length,
        macos_arm64: licenses.filter(l => (l.platform || '').includes('Silicon')).length,
        macos_x86_64: licenses.filter(l => (l.platform || '').includes('Intel')).length,
        windows_x64: licenses.filter(l => (l.platform || '').includes('Windows')).length,
      },
      recent_licenses: licenses,
      updates,
      alert,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
