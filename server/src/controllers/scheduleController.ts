import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/errors';
import { toScheduleItemDto } from '../lib/dto';
import { clockTime, idParam, trimmed } from '../lib/validation';
import { emitToOperators } from '../socket/bus';
import { findEventOr404 } from './eventsController';

const createSchema = z.object({
  time: clockTime,
  title: trimmed(200).min(1, 'Title is required'),
  description: trimmed(2000).optional().default(''),
  durationMinutes: z.number().int().min(0).max(24 * 60).nullable().optional(),
});
const updateSchema = createSchema.partial();

async function findItemOr404(id: string) {
  const item = await prisma.scheduleItem.findUnique({ where: { id: idParam.parse(id) } });
  if (!item) throw notFound('Schedule item not found.');
  return item;
}

const changed = (eventId: string) => emitToOperators(eventId, 'schedule:changed', { eventId });

export async function getSchedule(req: Request<{ id: string }>, res: Response) {
  const event = await findEventOr404(req.params.id);
  const items = await prisma.scheduleItem.findMany({
    where: { eventId: event.id },
    orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
  });
  res.json(items.map(toScheduleItemDto));
}

export async function addScheduleItem(req: Request<{ id: string }>, res: Response) {
  const event = await findEventOr404(req.params.id);
  const body = createSchema.parse(req.body);
  const item = await prisma.scheduleItem.create({ data: { ...body, eventId: event.id } });
  changed(event.id);
  res.status(201).json(toScheduleItemDto(item));
}

export async function updateScheduleItem(req: Request<{ itemId: string }>, res: Response) {
  const item = await findItemOr404(req.params.itemId);
  const body = updateSchema.parse(req.body);
  const updated = await prisma.scheduleItem.update({ where: { id: item.id }, data: body });
  changed(item.eventId);
  res.json(toScheduleItemDto(updated));
}

export async function deleteScheduleItem(req: Request<{ itemId: string }>, res: Response) {
  const item = await findItemOr404(req.params.itemId);
  await prisma.scheduleItem.delete({ where: { id: item.id } });
  changed(item.eventId);
  res.status(204).end();
}
