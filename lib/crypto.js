import crypto from 'crypto';

export const MASTER_SALT = process.env.LAFZI_MASTER_SECRET || 'LAFZI_STUDIO_SECRET_SIGN_SALT_v1_2025';

export function signActivation(machineId, key, email = '') {
  const normalizedData = `${machineId.trim().toUpperCase()}:${key.trim().toUpperCase()}:${email.trim().toLowerCase()}`;
  return crypto.createHmac('sha256', MASTER_SALT).update(normalizedData).digest('hex');
}

export function verifyActivationSignature(sig, machineId, key, email = '') {
  const expected = signActivation(machineId, key, email);
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return sig.toLowerCase() === expected.toLowerCase();
  }
}

export function sanitizeKey(key) {
  return String(key || '').trim().toUpperCase();
}
