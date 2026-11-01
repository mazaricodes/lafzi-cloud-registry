import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

let redisClient = null;
if (url && token && !url.includes('example.com')) {
  try {
    redisClient = new Redis({ url, token });
    console.log('[Registry DB] Connected to Upstash/KV Redis at', url.slice(0, 24) + '...');
  } catch (err) {
    console.warn('[Registry DB] Failed to initialize Redis client:', err.message);
  }
} else {
  console.log('[Registry DB] Redis credentials not set. Running with local persistent fallback.');
}

// Local fallback store (persists to fallback_store.json if Redis not yet configured)
const FALLBACK_FILE = path.resolve(process.cwd(), '.registry_local_store.json');
let localStore = {
  licenses: {},
  all_keys: [],
  alert: {
    active: false,
    id: 'alert-v1',
    type: 'info',
    title: '',
    message: '',
    action_label: '',
    action_url: '',
    updated_at: 0
  },
  updates: {
    latest_version: '1.0.0',
    release_notes: 'Initial release of Lafzi & Lafzi Studio.',
    release_date: Date.now() / 1000,
    mandatory: false,
    downloads: {
      macos_arm64: 'https://drive.google.com/file/d/1ko7UVnAsgrSxxZR4xD3nE-RStxfcQZHo/view?usp=sharing',
      macos_x86_64: 'https://drive.google.com/file/d/1gsIsR6cu6u_GQQGq4pMpPv4SpjBBFwAx/view?usp=sharing',
      windows_x64: 'https://drive.google.com/file/d/1Vy9Z0cHnD5kOr6hE5EkZSewV3oRRWuW5/view?usp=sharing'
    }
  },
  orders: []
};

try {
  if (fs.existsSync(FALLBACK_FILE)) {
    const raw = fs.readFileSync(FALLBACK_FILE, 'utf-8');
    localStore = { ...localStore, ...JSON.parse(raw) };
  }
} catch (e) {
  // Ignore load error
}

function persistLocalFallback() {
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(localStore, null, 2), 'utf-8');
  } catch {
    // Vercel serverless filesystem is read-only, silently ignore in lambda
  }
}

export async function getLicense(key) {
  const normKey = String(key || '').trim().toUpperCase();
  if (redisClient) {
    try {
      const data = await redisClient.get(`license:${normKey}`);
      if (!data) return null;
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      console.error('[Redis getLicense error]', e);
    }
  }
  return localStore.licenses[normKey] || null;
}

export async function saveLicense(key, data) {
  const normKey = String(key || '').trim().toUpperCase();
  const entry = {
    ...data,
    key: normKey,
    updated_at: Date.now()
  };

  if (redisClient) {
    try {
      await redisClient.set(`license:${normKey}`, JSON.stringify(entry));
      await redisClient.sadd('set:licenses', normKey);
      return entry;
    } catch (e) {
      console.error('[Redis saveLicense error]', e);
    }
  }

  localStore.licenses[normKey] = entry;
  if (!localStore.all_keys.includes(normKey)) {
    localStore.all_keys.push(normKey);
  }
  persistLocalFallback();
  return entry;
}

export async function getAllLicenses() {
  if (redisClient) {
    try {
      const keys = await redisClient.smembers('set:licenses');
      if (!keys || keys.length === 0) return [];

      const pipeline = redisClient.pipeline();
      for (const k of keys) {
        pipeline.get(`license:${k}`);
      }
      const results = await pipeline.exec();
      return results
        .map(r => (typeof r === 'string' ? JSON.parse(r) : r))
        .filter(Boolean)
        .sort((a, b) => (b.activated_at || b.created_at || 0) - (a.activated_at || a.created_at || 0));
    } catch (e) {
      console.error('[Redis getAllLicenses error]', e);
    }
  }

  return Object.values(localStore.licenses).sort(
    (a, b) => (b.activated_at || b.created_at || 0) - (a.activated_at || a.created_at || 0)
  );
}

export async function getAlert() {
  if (redisClient) {
    try {
      const data = await redisClient.get('system:alert');
      if (data) return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      console.error('[Redis getAlert error]', e);
    }
  }
  return localStore.alert;
}

export async function saveAlert(alertData) {
  const merged = {
    ...alertData,
    updated_at: Date.now()
  };
  if (redisClient) {
    try {
      await redisClient.set('system:alert', JSON.stringify(merged));
      return merged;
    } catch (e) {
      console.error('[Redis saveAlert error]', e);
    }
  }
  localStore.alert = merged;
  persistLocalFallback();
  return merged;
}

export async function getUpdatesManifest() {
  if (redisClient) {
    try {
      const data = await redisClient.get('system:updates');
      if (data) return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (e) {
      console.error('[Redis getUpdatesManifest error]', e);
    }
  }
  return localStore.updates;
}

export async function saveUpdatesManifest(updatesData) {
  const merged = {
    ...updatesData,
    updated_at: Date.now()
  };
  if (redisClient) {
    try {
      await redisClient.set('system:updates', JSON.stringify(merged));
      return merged;
    } catch (e) {
      console.error('[Redis saveUpdatesManifest error]', e);
    }
  }
  localStore.updates = merged;
  persistLocalFallback();
  return merged;
}

export async function incrementDownload(platform, edition = 'free') {
  let validKey = 'macos_arm64';
  const p = String(platform || '').toLowerCase();
  if (p.includes('intel') || p.includes('x86')) {
    validKey = 'macos_x86_64';
  } else if (p.includes('win')) {
    validKey = 'windows_x64';
  } else if (p.includes('silicon') || p.includes('arm') || p.includes('mac')) {
    validKey = 'macos_arm64';
  }

  const isPaid = String(edition).toLowerCase().includes('paid') || String(edition).toLowerCase().includes('studio');
  const editionKey = isPaid ? 'paid' : 'free';

  if (redisClient) {
    try {
      const pipeline = redisClient.pipeline();
      pipeline.incr('counter:downloads:total');
      pipeline.incr(`counter:downloads:${validKey}`);
      pipeline.incr(`counter:downloads:${editionKey}`);
      const [total, platCount, edCount] = await pipeline.exec();
      return {
        total: Number(total) || 1,
        platform: validKey,
        platform_count: Number(platCount) || 1,
        edition: editionKey,
        edition_count: Number(edCount) || 1,
      };
    } catch (e) {
      console.error('[Redis incrementDownload error]', e);
    }
  }

  // Local fallback
  localStore.downloads = localStore.downloads || { macos_arm64: 0, macos_x86_64: 0, windows_x64: 0, paid: 0, free: 0, total: 0 };
  localStore.downloads[validKey] = (localStore.downloads[validKey] || 0) + 1;
  localStore.downloads[editionKey] = (localStore.downloads[editionKey] || 0) + 1;
  localStore.downloads.total = (localStore.downloads.total || 0) + 1;
  persistLocalFallback();
  return {
    total: localStore.downloads.total,
    platform: validKey,
    platform_count: localStore.downloads[validKey],
    edition: editionKey,
    edition_count: localStore.downloads[editionKey],
  };
}

export async function getDownloadCounts() {
  if (redisClient) {
    try {
      const pipeline = redisClient.pipeline();
      pipeline.get('counter:downloads:total');
      pipeline.get('counter:downloads:macos_arm64');
      pipeline.get('counter:downloads:macos_x86_64');
      pipeline.get('counter:downloads:windows_x64');
      pipeline.get('counter:downloads:paid');
      pipeline.get('counter:downloads:free');
      const [total, arm, intel, win, paid, free] = await pipeline.exec();

      return {
        total: Number(total) || 0,
        macos_arm64: Number(arm) || 0,
        macos_x86_64: Number(intel) || 0,
        windows_x64: Number(win) || 0,
        paid: Number(paid) || 0,
        free: Number(free) || 0,
      };
    } catch (e) {
      console.error('[Redis getDownloadCounts error]', e);
    }
  }

  return localStore.downloads || { macos_arm64: 0, macos_x86_64: 0, windows_x64: 0, paid: 0, free: 0, total: 0 };
}

export async function recordTelemetry(data) {
  const installId = String(data?.install_id || '').trim();
  if (!installId) return { ok: false, error: 'Missing install_id' };

  const edition = String(data?.edition || 'base').toLowerCase() === 'studio' ? 'studio' : 'base';
  const entry = {
    install_id: installId,
    edition,
    version: data?.version || '1.0.0',
    platform: data?.platform || 'unknown',
    launch_count: data?.launch_count || 1,
    last_seen: Date.now(),
  };

  if (redisClient) {
    try {
      await redisClient.set(`install:${installId}`, JSON.stringify(entry));
      await redisClient.sadd('set:installs', installId);
      await redisClient.sadd(`set:installs:${edition}`, installId);
      return { ok: true, install_id: installId };
    } catch (e) {
      console.error('[Redis recordTelemetry error]', e);
    }
  }

  localStore.installs = localStore.installs || {};
  localStore.installs[installId] = entry;
  persistLocalFallback();
  return { ok: true, install_id: installId };
}

export async function getInstallStats() {
  if (redisClient) {
    try {
      const [total, studio, base] = await Promise.all([
        redisClient.scard('set:installs'),
        redisClient.scard('set:installs:studio'),
        redisClient.scard('set:installs:base'),
      ]);
      return {
        total: Number(total) || 0,
        studio: Number(studio) || 0,
        base: Number(base) || 0,
      };
    } catch (e) {
      console.error('[Redis getInstallStats error]', e);
    }
  }

  const installs = Object.values(localStore.installs || {});
  const studioCount = installs.filter(i => i.edition === 'studio').length;
  return {
    total: installs.length,
    studio: studioCount,
    base: installs.length - studioCount,
  };
}

export async function getDbStatus() {
  if (redisClient) {
    try {
      const pong = await redisClient.ping();
      const isPong = pong === 'PONG' || pong === 'pong' || Boolean(pong);
      return {
        connected: isPong,
        provider: process.env.KV_REST_API_URL ? 'Vercel KV' : 'Upstash Redis',
        url_prefix: (url || '').slice(0, 24) + '...',
      };
    } catch (err) {
      return {
        connected: false,
        provider: process.env.KV_REST_API_URL ? 'Vercel KV' : 'Upstash Redis',
        error: err.message,
      };
    }
  }
  return {
    connected: false,
    provider: 'Local In-Memory (No Upstash/KV credentials configured)',
  };
}
