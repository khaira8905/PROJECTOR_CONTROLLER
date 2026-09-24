import type { Request, Response } from 'express';
import { controlCommandSchema, execute } from '../services/controlService';
import * as display from '../services/displayService';
import * as timer from '../services/timerService';
import { getIo } from '../socket/bus';
import { presenceFor } from '../socket';
import { findEventOr404 } from './eventsController';

/** Current display + timer state. Useful for debugging and non-socket clients. */
export async function getState(req: Request<{ id: string }>, res: Response) {
  const event = await findEventOr404(req.params.id);
  const io = getIo();
  const [displayState, timerState, presence] = await Promise.all([
    display.getSnapshot(event.id),
    timer.getTimer(event.id),
    io ? presenceFor(io, event.id) : Promise.resolve({ displays: 0, operators: 0 }),
  ]);
  res.json({ display: displayState, timer: timerState, presence: { eventId: event.id, ...presence } });
}

/** REST equivalent of the socket "control" event, e.g. { "type": "black" }. */
export async function control(req: Request<{ id: string }>, res: Response) {
  const event = await findEventOr404(req.params.id);
  const command = controlCommandSchema.parse(req.body);
  const data = await execute(event.id, command);
  res.json({ ok: true, data });
}
