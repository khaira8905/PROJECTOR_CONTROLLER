import type { Request, Response } from 'express';
import { z } from 'zod';
import { config, googleConfigured } from '../config';
import { parseCookies } from '../lib/cookies';
import * as auth from '../services/authService';
import { cookieOptions } from '../lib/network';

const passwordSchema = z.object({ password: z.string().min(1, 'Password is required').max(200) });
const loginSchema = z.object({ email: z.string().trim().max(200).optional(), password: z.string().min(1, 'Password is required').max(200) });
const changeSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(1).max(200) });

export async function startSession(req: Request, res: Response, subject: string) {
  const { token, maxAgeMs } = await auth.createSessionToken(subject);
  res.cookie(auth.SESSION_COOKIE, token, cookieOptions(req, { sameSite: 'strict', maxAge: maxAgeMs, path: '/' }));
}

export async function status(req: Request, res: Response) {
  const session = await auth.verifySessionToken(parseCookies(req.headers.cookie)[auth.SESSION_COOKIE]);
  res.json({
    provider: config.auth.provider,
    enabled: auth.authEnabled(),
    configured: await auth.isPasswordConfigured(),
    authenticated: !auth.authEnabled() || !!session,
    user: session?.subject ?? null,
    // "Continue with Google" on the sign-in page.
    google: auth.authEnabled() && googleConfigured() && config.google.allowedEmails.length > 0,
  });
}

export async function setup(req: Request, res: Response) {
  const { password } = passwordSchema.parse(req.body);
  await auth.setupPassword(password);
  await startSession(req, res, 'operator');
  res.status(201).json({ ok: true });
}

export async function login(req: Request, res: Response) {
  const ip = req.ip ?? 'unknown';
  auth.checkRateLimit(ip);
  const body = loginSchema.parse(req.body);
  const subject = await auth.authenticate(body);
  auth.clearRateLimit(ip);
  await startSession(req, res, subject);
  res.json({ ok: true, user: subject });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(auth.SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = changeSchema.parse(req.body);
  await auth.changePassword(currentPassword, newPassword);
  // Rotating the secret signed everyone out; keep this operator signed in.
  await startSession(req, res, 'operator');
  res.json({ ok: true });
}
