import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
import { toQueueItemDto } from '../lib/dto';
import { idParam, trimmed } from '../lib/validation';
import * as display from '../services/displayService';
import { emitToOperators } from '../socket/bus';
import { findEventOr404 } from './eventsController';

const optionalTitle = trimmed(200)
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));
const duration = z.number().int().min(0).max(24 * 60 * 60).nullable().optional();

const addSchema = z.object({
  mediaId: idParam,
  title: optionalTitle,
  durationSeconds: duration,
  notes: trimmed(5000).optional(),
});

const reorderSchema = z.object({ order: z.array(idParam).max(1000) });

const updateSchema = z.object({
  title: optionalTitle,
  durationSeconds: duration,
  notes: trimmed(5000).optional(),
});

async function queueFor(eventId: string) {
  const items = await prisma.queueItem.findMany({
    where: { eventId },
    orderBy: { position: 'asc' },
    include: { media: true },
  });
  return items.map(toQueueItemDto);
}

/** Queue payloads contain speaker notes, so they only ever go to operators. */
async function queueChanged(eventId: string) {
  emitToOperators(eventId, 'queue:changed', { eventId });
  await display.refresh(eventId);
}

async function findItemOr404(id: string) {
  const item = await prisma.queueItem.findUnique({ where: { id: idParam.parse(id) } });
  if (!item) throw notFound('Queue item not found.');
  return item;
}

export async function getQueue(req: Request<{ id: string }>, res: Response) {
  const event = await findEventOr404(req.params.id);
  res.json(await queueFor(event.id));
}

export async function addToQueue(req: Request<{ id: string }>, res: Response) {
  const event = await findEventOr404(req.params.id);
  const body = addSchema.parse(req.body);
  const media = await prisma.media.findFirst({ where: { id: body.mediaId, eventId: event.id } });
  if (!media) throw badRequest('Media not found in this event.');
  const last = await prisma.queueItem.findFirst({ where: { eventId: event.id }, orderBy: { position: 'desc' } });
  const item = await prisma.queueItem.create({
    data: {
      eventId: event.id,
      mediaId: media.id,
      position: (last?.position ?? -1) + 1,
      title: body.title ?? null,
      durationSeconds: body.durationSeconds ?? null,
      notes: body.notes ?? '',
    },
    include: { media: true },
  });
  await queueChanged(event.id);
  res.status(201).json(toQueueItemDto(item));
}

/** Reorders the queue. `order` must contain every queue item id of the event exactly once. */
export async function reorderQueue(req: Request<{ id: string }>, res: Response) {
  const event = await findEventOr404(req.params.id);
  const { order } = reorderSchema.parse(req.body);
  const existing = await prisma.queueItem.findMany({ where: { eventId: event.id }, select: { id: true } });
  const existingIds = new Set(existing.map((i) => i.id));
  if (order.length !== existingIds.size || new Set(order).size !== order.length || !order.every((id) => existingIds.has(id))) {
    throw badRequest('The queue changed. Refresh and try again.', 'QUEUE_OUT_OF_DATE');
  }
  await prisma.$transaction(
    order.map((id, position) => prisma.queueItem.update({ where: { id }, data: { position } })),
  );
  await queueChanged(event.id);
  res.json(await queueFor(event.id));
}

export async function updateQueueItem(req: Request<{ itemId: string }>, res: Response) {
  const item = await findItemOr404(req.params.itemId);
  const body = updateSchema.parse(req.body);
  const updated = await prisma.queueItem.update({ where: { id: item.id }, data: body, include: { media: true } });
  await queueChanged(item.eventId);
  res.json(toQueueItemDto(updated));
}

export async function deleteQueueItem(req: Request<{ itemId: string }>, res: Response) {
  const item = await findItemOr404(req.params.itemId);
  await display.handleRemoval(item.eventId, { queueItemIds: [item.id] });
  await prisma.queueItem.delete({ where: { id: item.id } });
  // Close the gap so positions stay contiguous.
  const rest = await prisma.queueItem.findMany({ where: { eventId: item.eventId }, orderBy: { position: 'asc' } });
  await prisma.$transaction(rest.map((q, position) => prisma.queueItem.update({ where: { id: q.id }, data: { position } })));
  await queueChanged(item.eventId);
  res.status(204).end();
}
