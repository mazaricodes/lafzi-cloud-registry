import { saveAlert, getAlert } from '../../../lib/redis.js';

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
    const alertData = body.alert || {
      title: body.title || '',
      message: body.message || '',
      type: body.type || 'info',
      action_label: body.action_label || '',
      action_url: body.action_url || '',
      active: Boolean(body.active),
    };

    const saved = await saveAlert(alertData);

    return res.status(200).json({
      ok: true,
      message: alertData.active ? 'In-app alert published successfully!' : 'In-app alert cleared.',
      alert: saved,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
