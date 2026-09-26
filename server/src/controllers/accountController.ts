import type { Request, Response } from 'express';
import { HttpError } from '../lib/errors';
import { accountPreferencesSchema, currentUser, getAccount, saveAccountPreferences } from '../services/accounts';

function requireUser() {
  const user = currentUser();
  if (!user) throw new HttpError(404, 'Accounts are not enabled on this server.', 'NO_ACCOUNTS');
  return user;
}

/** Who is signed in, their plan and their saved console settings. */
export async function get(_req: Request, res: Response) {
  res.json(await getAccount(requireUser()));
}

/** Saves the console settings (theme, shortcuts, layout…) to the account. */
export async function savePreferences(req: Request, res: Response) {
  const user = requireUser();
  const preferences = accountPreferencesSchema.parse(req.body?.preferences ?? req.body);
  await saveAccountPreferences(user, preferences);
  res.json({ ok: true });
}
