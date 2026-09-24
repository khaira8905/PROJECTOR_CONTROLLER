import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { badRequest, notFound } from '../lib/errors';
import { logger } from '../lib/logger';
import { toEventDto } from '../lib/dto';
import { eventDate, idParam, trimmed } from '../lib/validation';
import { removeEventUploads } from '../services/mediaStorage';
import * as display from '../services/displayService';
import * as timer from '../services/timerService';
import { emitToEvent } from '../socket/bus';

const createSchema = z.object({
  name: trimmed(120).min(1, 'Event name is required'),
  date: eventDate,
  description: trimmed(2000).optional().default(''),
  venue: trimmed(200).optional().default(''),
  waitingMessage: trimmed(200).optional(),
});

const updateSchema = z.object({
  name: trimmed(120).min(1, 'Event name is required').optional(),
  date: eventDate.optional(),
  description: trimmed(2000).optional(),
  venue: trimmed(200).optional(),
  waitingMessage: trimmed(200).min(1).optional(),
  logoMediaId: idParam.nullable().optional(),
});

const withCounts = { _count: { select: { media: true, queueItems: true, scheduleItems: true } } } as const;

export async function findEventOr404(id: string) {
  const event = await prisma.event.findUnique({ where: { id: idParam.parse(id) } });
  if (!event) throw notFound('Event not found.');
  return event;
}

export async function listEvents(_req: Request, res: Response) {
  const events = await prisma.event.findMany({ orderBy: [{ date: 'asc' }, { createdAt: 'asc' }], include: withCounts });
  res.json(events.map(toEventDto));
}

export async function getEvent(req: Request<{ id: string }>, res: Response) {
  await findEventOr404(req.params.id);
  const event = await prisma.event.findUniqueOrThrow({ where: { id: req.params.id }, include: withCounts });
  res.json(toEventDto(event));
}

export async function createEvent(req: Request, res: Response) {
  const body = createSchema.parse(req.body);
  const event = await prisma.event.create({
    data: {
      ...body,
      waitingMessage: body.waitingMessage || undefined,
      timerState: { create: {} },
      displayState: { create: {} },
    },
    include: withCounts,
  });
  logger.info(`Created event "${event.name}" (${event.id})`);
  res.status(201).json(toEventDto(event));
}

export async function updateEvent(req: Request<{ id: string }>, res: Response) {
  const existing = await findEventOr404(req.params.id);
  const body = updateSchema.parse(req.body);
  if (body.logoMediaId) {
    const media = await prisma.media.findFirst({ where: { id: body.logoMediaId, eventId: existing.id } });
    if (!media) throw badRequest('Logo must be one of this event’s media files.');
    if (media.kind !== 'image') throw badRequest('The event logo must be an image.');
  }
  const event = await prisma.event.update({ where: { id: existing.id }, data: body, include: withCounts });
  const dto = toEventDto(event);
  emitToEvent(event.id, 'event:changed', dto);
  await display.refresh(event.id);
  res.json(dto);
}

export async function deleteEvent(req: Request<{ id: string }>, res: Response) {
  const event = await findEventOr404(req.params.id);
  await prisma.event.delete({ where: { id: event.id } });
  timer.forget(event.id);
  display.forget(event.id);
  emitToEvent(event.id, 'event:deleted', { eventId: event.id });
  try {
    await removeEventUploads(event.id);
  } catch (err) {
    logger.warn('Could not remove uploads for deleted event', event.id, err);
  }
  logger.info(`Deleted event "${event.name}" (${event.id})`);
  res.status(204).end();
}
