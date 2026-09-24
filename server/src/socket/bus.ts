import type { Server } from 'socket.io';

/**
 * Room layout per event:
 *   event:<id>            every client of the event (operators + displays)
 *   event:<id>:operators  operator dashboards (may receive operator-only data such as notes)
 *   event:<id>:displays   audience displays (must never receive notes)
 */
export const rooms = {
  all: (eventId: string) => `event:${eventId}`,
  operators: (eventId: string) => `event:${eventId}:operators`,
  displays: (eventId: string) => `event:${eventId}:displays`,
};

let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}

export function getIo(): Server | null {
  return io;
}

export function emitToEvent(eventId: string, name: string, payload: unknown) {
  io?.to(rooms.all(eventId)).emit(name, payload);
}

export function emitToOperators(eventId: string, name: string, payload: unknown) {
  io?.to(rooms.operators(eventId)).emit(name, payload);
}

export function emitToDisplays(eventId: string, name: string, payload: unknown) {
  io?.to(rooms.displays(eventId)).emit(name, payload);
}
