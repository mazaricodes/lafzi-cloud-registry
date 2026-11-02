import { getAlert, getUpdatesManifest } from '../lib/redis.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const manifest = (await getUpdatesManifest()) || {};
    const alert = await getAlert();
    const alertData = alert && alert.active ? alert : null;

    // 1. Check if global update notifications are recalled or disabled
    if (manifest.recalled === true || manifest.active === false) {
      return res.status(200).json({
        latest_version: req.query.version || '1.0.0',
        update_available: false,
        recalled: true,
        message: 'No active updates at this time.',
        alert: alertData,
      });
    }

    // 2. Identify requesting platform
    const rawPlat = String(req.query.platform || '').toLowerCase();
    let osKey = null;
    if (rawPlat.includes('win')) {
      osKey = 'windows_x64';
    } else if (rawPlat.includes('intel') || rawPlat.includes('x86')) {
      osKey = 'macos_x86_64';
    } else if (rawPlat.includes('silicon') || rawPlat.includes('arm') || rawPlat.includes('mac')) {
      osKey = 'macos_arm64';
    }

    const platforms = manifest.platforms || {};

    // 3. Per-device specific release check
    if (osKey && platforms[osKey]) {
      const plat = platforms[osKey];

      // If update for this specific device has been recalled or deactivated
      if (plat.active === false || plat.recalled === true) {
        return res.status(200).json({
          latest_version: req.query.version || plat.version || '1.0.0',
          update_available: false,
          recalled: true,
          platform: osKey,
          alert: alertData,
        });
      }

      const version = plat.version || manifest.latest_version || '1.0.0';
      const notes = plat.release_notes || manifest.release_notes || 'A new update is available.';
      const dlUrl = plat.download_url || manifest.downloads?.[osKey] || manifest.download_urls?.[osKey] || '';
      const mandatory = plat.mandatory !== undefined ? Boolean(plat.mandatory) : Boolean(manifest.mandatory);

      return res.status(200).json({
        latest_version: version,
        release_notes: notes,
        download_url: dlUrl,
        download_urls: {
          [osKey]: dlUrl,
          ...(manifest.download_urls || manifest.downloads || {}),
        },
        mandatory,
        platform: osKey,
        recalled: false,
        alert: alertData,
      });
    }

    // 4. Default universal response (e.g. browser inspection or unrecognised OS)
    return res.status(200).json({
      ...manifest,
      recalled: Boolean(manifest.recalled),
      alert: alertData,
    });
  } catch (err) {
    return res.status(500).json({
      latest_version: '1.0.0',
      update_available: false,
      error: err.message,
    });
  }
}
