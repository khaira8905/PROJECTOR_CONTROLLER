import { z } from 'zod';
import * as display from './displayService';
import * as timer from './timerService';
import { emitToDisplays } from '../socket/bus';

const id = z.string().min(1).max(64);

/**
 * Every operator action is a typed command. Socket.IO ("control" event) and the
 * REST endpoint (POST /api/events/:id/control) both go through this dispatcher,
 * which makes it easy to add new controllers later (phone remote, Stream Deck, ...).
 */
export const controlCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('next') }),
  z.object({ type: z.literal('previous') }),
  z.object({ type: z.literal('show-item'), queueItemId: id }),
  z.object({ type: z.literal('show-media'), mediaId: id }),
  z.object({ type: z.literal('show-current') }),
  z.object({ type: z.literal('black') }),
  z.object({ type: z.literal('waiting') }),
  z.object({ type: z.literal('logo') }),
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
      return display.showQueueItem(eventId, command.queueItemId);
    case 'show-media':
      return display.showMedia(eventId, command.mediaId);
    case 'show-current':
      return display.showCurrent(eventId);
    case 'black':
    case 'waiting':
    case 'logo':
      return display.setMode(eventId, command.type);
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
