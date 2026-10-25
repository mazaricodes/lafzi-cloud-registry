import { getAlert, getUpdatesManifest } from '../lib/redis.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const manifest = await getUpdatesManifest();
    const alert = await getAlert();

    return res.status(200).json({
      ...manifest,
      alert: alert && alert.active ? alert : null,
    });
  } catch (err) {
    return res.status(500).json({
      latest_version: '1.0.0',
      update_available: false,
      error: err.message,
    });
  }
}
