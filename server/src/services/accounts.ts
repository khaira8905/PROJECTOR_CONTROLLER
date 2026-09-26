import { AsyncLocalStorage } from 'node:async_hooks';
import { z } from 'zod';
import type { User } from '@prisma/client';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { HttpError, notFound } from '../lib/errors';
import { logger } from '../lib/logger';

/**
 * Accounts. With sign-in enabled every request runs "as" one user (set by requireAuth),
 * and every event belongs to one user: people sharing the same EventControl server never
 * see or touch each other's events. With open access (no sign-in) there is no current user
 * and nothing is scoped — the single-show setup.
 */

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  plan: string;
}

const context = new AsyncLocalStorage<CurrentUser | null>();

export const runAs = <T>(user: CurrentUser | null, fn: () => T): T => context.run(user, fn);
export const currentUser = (): CurrentUser | null => context.getStore() ?? null;

const toCurrent = (u: User): CurrentUser => ({ id: u.id, email: u.email, name: u.name, plan: u.plan });

/** Throws 404 (not 403: don't reveal that it exists) unless the current user owns the event. */
export async function assertEventAccess(eventId: string) {
  const user = currentUser();
  if (!user) return;
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } });
  if (!event || event.ownerId !== user.id) throw notFound('Event not found.');
}

/** Filter for event queries: only the current user's events (everything in open mode). */
export const ownedEvents = () => {
  const user = currentUser();
  return user ? { ownerId: user.id } : {};
};

/**
 * Creates the account on first sign-in (or updates its email/name). The first account —
 * or the one matching ADMIN_EMAIL — takes over events created before accounts existed.
 */
export async function upsertUser(input: { authId: string; email: string; name?: string }): Promise<CurrentUser> {
  const email = input.email.trim().toLowerCase();
  const existing = (await prisma.user.findUnique({ where: { authId: input.authId } })) ?? (await prisma.user.findUnique({ where: { email } }));
  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: { authId: input.authId, email, name: input.name || existing.name, lastLoginAt: new Date() } })
    : await prisma.user.create({ data: { authId: input.authId, email, name: input.name ?? '', lastLoginAt: new Date() } });
  if (!existing) logger.info(`New account: ${email}`);
  await claimLegacyEvents(user);
  return toCurrent(user);
}

async function claimLegacyEvents(user: User) {
  const admin = config.auth.adminEmail;
  const eligible = admin ? user.email === admin : (await prisma.user.count()) === 1;
  if (!eligible) return;
  const { count } = await prisma.event.updateMany({ where: { ownerId: null }, data: { ownerId: user.id } });
  if (count) logger.info(`${user.email} now owns ${count} event(s) created before accounts.`);
}

/**
 * The user behind a session. Subjects: "user:<id>" (accounts), "operator" (the single
 * local password), "google:<email>" (Sign in with Google in private mode).
 */
export async function userFromSubject(subject: string): Promise<CurrentUser | null> {
  if (subject.startsWith('user:')) {
    const user = await prisma.user.findUnique({ where: { id: subject.slice(5) } });
    return user ? toCurrent(user) : null;
  }
  if (subject === 'operator') return upsertUser({ authId: 'local:operator', email: 'operator@local', name: 'Operator' });
  if (subject.startsWith('google:')) return upsertUser({ authId: subject, email: subject.slice(7) });
  return null;
}

// ---- Preferences that follow the account ----------------------------------------------

/** Console settings: a JSON object of known-safe size. The client owns its shape. */
export const accountPreferencesSchema = z
  .record(z.string().max(60), z.unknown())
  .refine((v) => JSON.stringify(v).length <= 20_000, 'Settings are too large.');

export async function getAccount(user: CurrentUser) {
  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row) throw new HttpError(401, 'Please sign in.', 'UNAUTHENTICATED');
  let preferences: Record<string, unknown> = {};
  try {
    preferences = JSON.parse(row.preferences || '{}');
  } catch {
    preferences = {};
  }
  return { id: row.id, email: row.email, name: row.name, plan: row.plan, createdAt: row.createdAt, preferences };
}

export async function saveAccountPreferences(user: CurrentUser, preferences: Record<string, unknown>) {
  await prisma.user.update({ where: { id: user.id }, data: { preferences: JSON.stringify(preferences) } });
}
