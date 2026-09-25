import crypto from 'node:crypto';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';

/**
 * Operator authentication.
 *
 * Sessions are stateless HMAC-signed tokens kept in an HttpOnly cookie, so the
 * browser sends them automatically with REST calls, uploads and the Socket.IO
 * handshake. The signing secret lives in the database; changing the password
 * rotates it, which signs every existing session out.
 */
export const SESSION_COOKIE = 'ec_session';

const PASSWORD_KEY = 'operator_password';
const SECRET_KEY = 'session_secret';

export const authEnabled = () => config.auth.provider !== 'none';

async function getSetting(key: string) {
  return (await prisma.setting.findUnique({ where: { key } }))?.value ?? null;
}

async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

let cachedSecret: string | null = null;
async function sessionSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  let secret = await getSetting(SECRET_KEY);
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    await setSetting(SECRET_KEY, secret);
  }
  cachedSecret = secret;
  return secret;
}

async function rotateSecret() {
  cachedSecret = crypto.randomBytes(32).toString('hex');
  await setSetting(SECRET_KEY, cachedSecret);
}

// ---- Password hashing (scrypt, no native dependency) -----------------------------

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export function validateNewPassword(password: string) {
  if (password.length < 6) throw new HttpError(400, 'Use at least 6 characters for the password.');
  if (password.length > 200) throw new HttpError(400, 'Password is too long.');
}

// ---- Session tokens ------------------------------------------------------------

export interface Session {
  subject: string;
  expiresAt: number;
}

export async function createSessionToken(subject: string): Promise<{ token: string; maxAgeMs: number }> {
  const maxAgeMs = config.auth.sessionHours * 3600_000;
  const payload = Buffer.from(JSON.stringify({ s: subject, e: Date.now() + maxAgeMs })).toString('base64url');
  const sig = crypto.createHmac('sha256', await sessionSecret()).update(payload).digest('base64url');
  return { token: `${payload}.${sig}`, maxAgeMs };
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', await sessionSecret()).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.e !== 'number' || data.e < Date.now()) return null;
    return { subject: String(data.s), expiresAt: data.e };
  } catch {
    return null;
  }
}

// ---- Providers -----------------------------------------------------------------

export async function isPasswordConfigured(): Promise<boolean> {
  if (config.auth.provider !== 'local') return true;
  return (await getSetting(PASSWORD_KEY)) !== null;
}

/** First-run: the operator chooses the password. Only allowed while none exists. */
export async function setupPassword(password: string) {
  if (config.auth.provider !== 'local') throw new HttpError(400, 'Password setup is only used with local sign-in.');
  if (await isPasswordConfigured()) throw new HttpError(409, 'A password is already set. Sign in instead.');
  validateNewPassword(password);
  await setSetting(PASSWORD_KEY, hashPassword(password));
  await rotateSecret();
  logger.info('Operator password created.');
}

export async function changePassword(current: string, next: string) {
  const stored = await getSetting(PASSWORD_KEY);
  if (!stored || !verifyPassword(current, stored)) throw new HttpError(401, 'Current password is incorrect.');
  validateNewPassword(next);
  await setSetting(PASSWORD_KEY, hashPassword(next));
  await rotateSecret();
}

/** Returns the session subject on success. */
export async function authenticate(credentials: { email?: string; password: string }): Promise<string> {
  if (config.auth.provider === 'supabase') return authenticateWithSupabase(credentials.email ?? '', credentials.password);
  const stored = await getSetting(PASSWORD_KEY);
  if (!stored) throw new HttpError(409, 'No password has been set yet.', 'SETUP_REQUIRED');
  if (!verifyPassword(credentials.password, stored)) throw new HttpError(401, 'Incorrect password.');
  return 'operator';
}

/** Verifies an email/password against Supabase Auth (GoTrue) and returns the user's email. */
async function authenticateWithSupabase(email: string, password: string): Promise<string> {
  const { url, anonKey } = config.supabase;
  if (!url || !anonKey) throw new HttpError(500, 'Supabase sign-in is not configured (SUPABASE_URL / SUPABASE_ANON_KEY).');
  let res: Response;
  try {
    res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    logger.error('Supabase sign-in request failed:', err);
    throw new HttpError(503, 'Cannot reach the sign-in service. Check the internet connection.');
  }
  if (!res.ok) throw new HttpError(401, 'Incorrect email or password.');
  const data: any = await res.json().catch(() => ({}));
  return String(data?.user?.email ?? email);
}

/** Resets local sign-in so the next visit asks for a new password. */
export async function resetPassword() {
  await prisma.setting.deleteMany({ where: { key: { in: [PASSWORD_KEY, SECRET_KEY] } } });
  cachedSecret = null;
}

// ---- Brute-force protection ----------------------------------------------------

const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return;
  }
  entry.count++;
  if (entry.count > 10) throw new HttpError(429, 'Too many sign-in attempts. Wait a minute and try again.');
}

export function clearRateLimit(ip: string) {
  attempts.delete(ip);
}
