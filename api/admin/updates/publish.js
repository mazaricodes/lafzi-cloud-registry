import { saveUpdatesManifest, getUpdatesManifest } from '../../../lib/redis.js';

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
    const target = body.target || body.platform || 'all';
    const version = body.version || body.latest_version;
    const notes = body.release_notes || body.notes || '';
    const mandatory = Boolean(body.mandatory);

    if (!version && !body.platforms) {
      return res.status(400).json({ ok: false, error: 'Version string is required' });
    }

    let updatedManifest;

    if (target === 'all') {
      const downloads = body.downloads || body.download_urls || {};
      const platforms = body.platforms || {
        macos_arm64: {
          version,
          release_notes: notes,
          download_url: downloads.macos_arm64 || '',
          mandatory,
          active: true,
          recalled: false,
          updated_at: Date.now(),
        },
        macos_x86_64: {
          version,
          release_notes: notes,
          download_url: downloads.macos_x86_64 || '',
          mandatory,
          active: true,
          recalled: false,
          updated_at: Date.now(),
        },
        windows_x64: {
          version,
          release_notes: notes,
          download_url: downloads.windows_x64 || '',
          mandatory,
          active: true,
          recalled: false,
          updated_at: Date.now(),
        },
      };

      updatedManifest = await saveUpdatesManifest({
        recalled: false,
        active: true,
        latest_version: version,
        release_notes: notes,
        mandatory,
        downloads,
        download_urls: downloads,
        platforms,
      });
    } else {
      // Single device release (e.g. windows_x64, macos_arm64, macos_x86_64)
      const dlUrl = body.download_url || (body.downloads && body.downloads[target]) || '';
      updatedManifest = await saveUpdatesManifest({
        target,
        version,
        release_notes: notes,
        download_url: dlUrl,
        mandatory,
        active: true,
        recalled: false,
      });
    }

    const platformLabels = {
      macos_arm64: 'macOS Apple Silicon',
      macos_x86_64: 'macOS Intel',
      windows_x64: 'Windows 10/11',
      all: 'All Platforms',
    };

    return res.status(200).json({
      ok: true,
      message: `Software update v${version} published successfully for ${platformLabels[target] || target}!`,
      target,
      manifest: updatedManifest,
      updates: updatedManifest,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
