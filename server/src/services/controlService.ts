import { z } from 'zod';
import * as display from './displayService';
import * as timer from './timerService';
import { emitToDisplays, emitToEvent } from '../socket/bus';
import { prisma } from '../lib/prisma';
import { badRequest } from '../lib/errors';
import { toEventDto } from '../lib/dto';

export const OVERLAY_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'] as const;

/** Branding overlay: which logo, where, how big, how opaque, shown or hidden. */
async function setOverlay(
  eventId: string,
  opts: { visible?: boolean; mediaId?: string | null; position?: string; size?: number; opacity?: number },
) {
  if (opts.mediaId) {
    const media = await prisma.media.findFirst({ where: { id: opts.mediaId, eventId } });
    if (!media || media.kind !== 'image') throw badRequest('The overlay logo must be an image from this event.');
  }
  const event = await prisma.event.update({
    where: { id: eventId },
    data: {
      overlayVisible: opts.visible,
      overlayMediaId: opts.mediaId,
      overlayPosition: opts.position,
      overlaySize: opts.size,
      overlayOpacity: opts.opacity,
    },
  });
  emitToEvent(eventId, 'event:changed', toEventDto(event));
  await display.refresh(eventId);
  return display.getSnapshot(eventId);
}

const id = z.string().min(1).max(64);

/**
 * Every operator action is a typed command. Socket.IO ("control" event) and the
 * REST endpoint (POST /api/events/:id/control) both go through this dispatcher,
 * which makes it easy to add new controllers later (phone remote, Stream Deck, ...).
 */
export const controlCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('next') }),
  z.object({ type: z.literal('previous') }),
  z.object({ type: z.literal('show-item'), queueItemId: id, page: z.number().int().min(1).max(9999).optional() }),
  z.object({ type: z.literal('show-media'), mediaId: id, page: z.number().int().min(1).max(9999).optional() }),
  z.object({ type: z.literal('show-current') }),
  z.object({
    type: z.literal('show-screen'),
    screenId: id.optional(),
    key: z.string().max(40).optional(),
    timerMs: z.number().int().min(1000).max(timer.MAX_DURATION_MS).optional(),
  }),
  z.object({ type: z.literal('black') }),
  // Kept for older clients: "waiting" shows the Please Wait screen.
  z.object({ type: z.literal('waiting') }),
  z.object({ type: z.literal('logo') }),
  z.object({
    type: z.literal('overlay'),
    visible: z.boolean().optional(),
    mediaId: id.nullable().optional(),
    position: z.enum(OVERLAY_POSITIONS).optional(),
    size: z.number().int().min(2).max(60).optional(),
    opacity: z.number().int().min(0).max(100).optional(),
  }),
  z
    .object({ type: z.literal('page'), page: z.number().int().min(1).max(9999).optional(), delta: z.number().int().min(-100).max(100).optional() })
    .refine((c) => c.page !== undefined || c.delta !== undefined, 'page or delta is required'),
  z.object({ type: z.literal('video'), action: z.enum(['play', 'pause', 'restart']) }),
  z.object({ type: z.literal('fullscreen') }),
  z.object({ type: z.literal('timer-start') }),
  z.object({ type: z.literal('timer-pause') }),
  z.object({ type: z.literal('timer-toggle') }),
  z.object({ type: z.literal('timer-reset') }),
  z.object({ type: z.literal('timer-adjust'), deltaMs: z.number().int().min(-timer.MAX_DURATION_MS).max(timer.MAX_DURATION_MS) }),
  z.object({
    type: z.literal('timer-configure'),
    durationMs: z.number().int().min(1000).max(timer.MAX_DURATION_MS).optional(),
    warningMs: z.number().int().min(0).max(timer.MAX_DURATION_MS).optional(),
    showOnDisplay: z.boolean().optional(),
  }),
]);

export type ControlCommand = z.infer<typeof controlCommandSchema>;

export async function execute(eventId: string, command: ControlCommand): Promise<unknown> {
  switch (command.type) {
    case 'next':
      return display.step(eventId, 1);
    case 'previous':
      return display.step(eventId, -1);
    case 'show-item':
      return display.showQueueItem(eventId, command.queueItemId, command.page);
    case 'show-media':
      return display.showMedia(eventId, command.mediaId, command.page);
    case 'show-current':
      return display.showCurrent(eventId);
    case 'show-screen':
      return display.showScreen(eventId, command);
    case 'waiting':
      return display.showScreen(eventId, { key: 'please-wait' });
    case 'black':
    case 'logo':
      return display.setMode(eventId, command.type);
    case 'overlay':
      return setOverlay(eventId, command);
    case 'page':
      return display.setPage(eventId, command);
    case 'video':
      emitToDisplays(eventId, 'display:video', { action: command.action, at: Date.now() });
      return null;
    case 'fullscreen':
      emitToDisplays(eventId, 'display:fullscreen', { at: Date.now() });
      return null;
    case 'timer-start':
      return timer.start(eventId);
    case 'timer-pause':
      return timer.pause(eventId);
    case 'timer-toggle':
      return timer.toggle(eventId);
    case 'timer-reset':
      return timer.reset(eventId);
    case 'timer-adjust':
      return timer.adjust(eventId, command.deltaMs);
    case 'timer-configure':
      return timer.configure(eventId, command);
  }
}
