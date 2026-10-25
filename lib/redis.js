import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

let redisClient = null;
if (url && token && !url.includes('example.com')) {
  try {
    redisClient = new Redis({ url, token });
    console.log('[Registry DB] Connected to Upstash Redis at', url.slice(0, 24) + '...');
  } catch (err) {
    console.warn('[Registry DB] Failed to initialize Upstash client:', err.message);
  }
} else {
  console.log('[Registry DB] UPSTASH credentials not set. Running with local persistent fallback.');
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
      macos_arm64: 'https://drive.google.com/file/d/1_rjVpBeG1ubkX2rRn4Kl-zVSckVTzBYZ/view?usp=sharing',
      macos_x86_64: 'https://drive.google.com/file/d/1_rjVpBeG1ubkX2rRn4Kl-zVSckVTzBYZ/view?usp=sharing',
      windows_x64: 'https://drive.google.com/file/d/1_rjVpBeG1ubkX2rRn4Kl-zVSckVTzBYZ/view?usp=sharing'
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
