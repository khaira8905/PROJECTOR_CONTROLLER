import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { assertEventAccess } from '../services/accounts';
import { badRequest, notFound } from '../lib/errors';
import { toScreenDto } from '../lib/dto';
import { idParam, trimmed } from '../lib/validation';
import * as display from '../services/displayService';
import { SCREEN_STYLES, ensureBuiltinScreens } from '../services/screenService';
import { emitToOperators } from '../socket/bus';
import { findEventOr404 } from './eventsController';

const fields = {
  title: trimmed(120).min(1, 'Title is required'),
  subtitle: trimmed(300),
  style: z.enum(SCREEN_STYLES),
  showTimer: z.boolean(),
  backgroundMediaId: idParam.nullable(),
};
const createSchema = z.object({
  title: fields.title,
  subtitle: fields.subtitle.optional().default(''),
  style: fields.style.optional().default('custom'),
  showTimer: fields.showTimer.optional().default(false),
  backgroundMediaId: fields.backgroundMediaId.optional(),
});
const updateSchema = z.object(fields).partial();

async function screensFor(eventId: string) {
  await ensureBuiltinScreens(eventId);
  const rows = await prisma.screen.findMany({ where: { eventId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  const bgIds = rows.map((r) => r.backgroundMediaId).filter((id): id is string => !!id);
  const backgrounds = new Map((await prisma.media.findMany({ where: { id: { in: bgIds } } })).map((m) => [m.id, m]));
  return rows.map((r) => toScreenDto({ ...r, background: r.backgroundMediaId ? (backgrounds.get(r.backgroundMediaId) ?? null) : null }));
}

async function checkBackground(eventId: string, mediaId: string | null | undefined) {
  if (!mediaId) return;
  const media = await prisma.media.findFirst({ where: { id: mediaId, eventId } });
  if (!media || (media.kind !== 'image' && media.kind !== 'video')) throw badRequest('The background must be an image or video from this event.');
}

async function changed(eventId: string) {
  emitToOperators(eventId, 'screens:changed', { eventId });
  await display.refresh(eventId);
}

async function findScreenOr404(id: string) {
  const screen = await prisma.screen.findUnique({ where: { id: idParam.parse(id) } });
  if (!screen) throw notFound('Screen not found.');
  await assertEventAccess(screen.eventId);
  return screen;
}

export async function listScreens(req: Request<{ id: string }>, res: Response) {
  const event = await findEventOr404(req.params.id);
  res.json(await screensFor(event.id));
}

export async function createScreen(req: Request<{ id: string }>, res: Response) {
  const event = await findEventOr404(req.params.id);
  const body = createSchema.parse(req.body);
  await checkBackground(event.id, body.backgroundMediaId);
  const last = await prisma.screen.findFirst({ where: { eventId: event.id }, orderBy: { position: 'desc' } });
  const screen = await prisma.screen.create({ data: { ...body, eventId: event.id, position: (last?.position ?? 0) + 1 } });
  await changed(event.id);
  res.status(201).json((await screensFor(event.id)).find((s) => s.id === screen.id));
}

export async function updateScreen(req: Request<{ screenId: string }>, res: Response) {
  const screen = await findScreenOr404(req.params.screenId);
  const body = updateSchema.parse(req.body);
  await checkBackground(screen.eventId, body.backgroundMediaId);
  await prisma.screen.update({ where: { id: screen.id }, data: body });
  await changed(screen.eventId);
  res.json((await screensFor(screen.eventId)).find((s) => s.id === screen.id));
}

export async function deleteScreen(req: Request<{ screenId: string }>, res: Response) {
  const screen = await findScreenOr404(req.params.screenId);
  if (screen.key) throw badRequest('Built-in screens can be edited but not deleted.');
  const items = await prisma.queueItem.findMany({ where: { screenId: screen.id }, select: { id: true } });
  await display.handleRemoval(screen.eventId, { screenId: screen.id, queueItemIds: items.map((i) => i.id) });
  await prisma.screen.delete({ where: { id: screen.id } });
  emitToOperators(screen.eventId, 'queue:changed', { eventId: screen.eventId });
  await changed(screen.eventId);
  res.status(204).end();
}
