import crypto from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { config, crossSite } from '../config';
import { parseCookies } from './cookies';

const LOOPBACK = /^(127\.\d+\.\d+\.\d+|::1|::ffff:127\.\d+\.\d+\.\d+)$/;

/**
 * True only when the browser runs on the server machine itself. Every hop must be
 * loopback: a tunnel or reverse proxy on the same machine connects from 127.0.0.1 but
 * adds the real visitor to X-Forwarded-For / CF-Connecting-IP, which then fails the check.
 * Used for actions that touch the server's desktop (launching PowerPoint).
 */
export function isLocalRequest(req: Request): boolean {
  const hops = [req.socket.remoteAddress ?? ''];
  for (const header of ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip', 'true-client-ip', 'forwarded']) {
    const value = req.get(header);
    if (!value) continue;
    if (header === 'forwarded') {
      for (const m of value.matchAll(/for="?\[?([^\]";,]+)/gi)) hops.push(m[1]);
    } else hops.push(...value.split(',').map((v) => v.trim()));
  }
  return hops.every((ip) => LOOPBACK.test(ip) || ip === 'localhost');
}

/** Cookie flags that work both for one-site hosting and for a separately hosted UI. */
export function cookieOptions(req: Request, extra: CookieOptions & { sameSite?: 'strict' | 'lax' }): CookieOptions {
  if (crossSite()) return { ...extra, httpOnly: true, sameSite: 'none', secure: true };
  return { httpOnly: true, secure: req.secure, ...extra };
}

export const DEVICE_COOKIE = 'ec_device';

/**
 * An anonymous, random id for this browser. With open access there are no accounts, so
 * things that must stay personal (a connected Google Drive) are tied to the browser that
 * connected them instead of to everyone who has the link.
 */
export function deviceId(req: Request, res: Response): string {
  const existing = parseCookies(req.headers.cookie)[DEVICE_COOKIE];
  if (existing && /^[\w-]{32,64}$/.test(existing)) return existing;
  const id = crypto.randomBytes(24).toString('base64url');
  res.cookie(DEVICE_COOKIE, id, cookieOptions(req, { sameSite: 'lax', maxAge: 400 * 24 * 3600_000, path: '/' }));
  // Same request may need it again (e.g. read then write).
  req.headers.cookie = `${req.headers.cookie ? `${req.headers.cookie}; ` : ''}${DEVICE_COOKIE}=${id}`;
  return id;
}

/** Absolute URL in the UI (for redirects back from Google); relative when the server hosts the UI. */
export const appUrl = (pathAndQuery: string) => `${config.publicAppUrl}${pathAndQuery}`;

/**
 * Socket.IO origin check: requests without an Origin, the server's own site, and a
 * separately hosted UI listed in PUBLIC_APP_URL / CORS_ORIGINS.
 */
export function allowedOrigin(origin: string | undefined, host: string | undefined) {
  if (!origin) return true;
  if (config.corsOrigins.includes(origin)) return true;
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}
