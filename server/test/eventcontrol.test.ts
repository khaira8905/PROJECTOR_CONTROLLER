import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import request from 'supertest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createSocketServer } from '../src/socket';
import { prisma } from '../src/lib/prisma';
import { config } from '../src/config';
import { stopAll } from '../src/services/timerService';

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0f01f0005000201e2213fbc0000000049454e44ae426082',
  'hex',
);
const PNG_2 = Buffer.concat([PNG, Buffer.from('extra')]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

const app = createApp();
const server = http.createServer(app);
createSocketServer(server);
let baseUrl = '';
const sockets: Socket[] = [];

function connect(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, { transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function emit<T = any>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

function nextEvent<T = any>(socket: Socket, event: string, predicate: (p: T) => boolean = () => true): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 3000);
    const handler = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timeout);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

async function createEvent(name = 'Test Event') {
  const res = await request(app).post('/api/events').send({ name, date: '2026-09-24', description: 'd' });
  expect(res.status).toBe(201);
  return res.body as { id: string; name: string };
}

async function upload(eventId: string, files: [Buffer, string][]) {
  let req = request(app).post(`/api/events/${eventId}/media`);
  for (const [buf, name] of files) req = req.attach('files', buf, name);
  return req;
}

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  sockets.forEach((s) => s.disconnect());
  stopAll();
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

describe('events API', () => {
  it('validates input', async () => {
    const res = await request(app).post('/api/events').send({ date: '2026-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
    expect(res.body.stack).toBeUndefined();
  });

  it('creates, reads, updates and lists events', async () => {
    const event = await createEvent('ACM Tech Fest 2026');
    const got = await request(app).get(`/api/events/${event.id}`);
    expect(got.status).toBe(200);
    expect(got.body.date).toBe('2026-09-24');

    const updated = await request(app).put(`/api/events/${event.id}`).send({ name: 'Renamed', waitingMessage: 'Back soon' });
    expect(updated.body.name).toBe('Renamed');

    const list = await request(app).get('/api/events');
    expect(list.body.some((e: any) => e.id === event.id)).toBe(true);
  });

  it('returns 404 for unknown events and API routes', async () => {
    expect((await request(app).get('/api/events/doesnotexist')).status).toBe(404);
    expect((await request(app).get('/api/nope')).status).toBe(404);
  });
});

describe('media uploads', () => {
  it('stores valid files in typed folders and rejects bad ones', async () => {
    const event = await createEvent();
    const res = await upload(event.id, [
      [PNG, '../../../etc/Logo Final!.png'],
      [PDF, 'Schedule.pdf'],
      [Buffer.from('hello'), 'notes.txt'],
      [Buffer.from('not an image'), 'fake.jpg'],
    ]);
    expect(res.status).toBe(201);
    expect(res.body.uploaded.map((m: any) => m.kind).sort()).toEqual(['image', 'pdf']);
    expect(res.body.rejected).toHaveLength(2);
    expect(res.body.rejected.map((r: any) => r.error).join(' ')).toMatch(/not supported/);
    expect(res.body.rejected.map((r: any) => r.error).join(' ')).toMatch(/do not match/);
    // Paths are never exposed to clients.
    expect(JSON.stringify(res.body)).not.toContain('storagePath');

    const rows = await prisma.media.findMany({ where: { eventId: event.id } });
    for (const row of rows) {
      expect(row.storagePath).not.toContain('..');
      expect(row.storagePath.startsWith(`${event.id}/`)).toBe(true);
      expect(fs.existsSync(path.join(config.uploadsDir, row.storagePath))).toBe(true);
    }
    expect(rows.find((r) => r.kind === 'image')!.storagePath).toMatch(/^[^/]+\/images\/[0-9a-f]{8}-Logo-Final\.png$/);
  });

  it('skips duplicate uploads', async () => {
    const event = await createEvent();
    await upload(event.id, [[PNG, 'a.png']]);
    const dup = await upload(event.id, [[PNG, 'copy-of-a.png']]);
    expect(dup.status).toBe(200);
    expect(dup.body.uploaded).toHaveLength(0);
    expect(dup.body.duplicates).toHaveLength(1);
  });

  it('serves files, renames, and reports missing files gracefully', async () => {
    const event = await createEvent();
    const res = await upload(event.id, [[PNG, 'pic.png']]);
    const media = res.body.uploaded[0];
    const file = await request(app).get(media.url);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');

    const renamed = await request(app).patch(`/api/media/${media.id}`).send({ name: 'Sponsor/Logo' });
    expect(renamed.body.name).toBe('SponsorLogo');

    const row = await prisma.media.findUniqueOrThrow({ where: { id: media.id } });
    fs.rmSync(path.join(config.uploadsDir, row.storagePath));
    const missing = await request(app).get(media.url);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('Media file no longer exists.');
    const list = await request(app).get(`/api/events/${event.id}/media`);
    expect(list.body[0].missing).toBe(true);
  });
});

describe('queue', () => {
  it('adds, reorders, edits and removes items', async () => {
    const event = await createEvent();
    const up = await upload(event.id, [
      [PNG, 'one.png'],
      [PNG_2, 'two.png'],
    ]);
    const [a, b] = up.body.uploaded;
    const qa = (await request(app).post(`/api/events/${event.id}/queue`).send({ mediaId: a.id, notes: 'secret' })).body;
    const qb = (await request(app).post(`/api/events/${event.id}/queue`).send({ mediaId: b.id })).body;
    expect([qa.position, qb.position]).toEqual([0, 1]);

    const bad = await request(app).put(`/api/events/${event.id}/queue`).send({ order: [qa.id] });
    expect(bad.status).toBe(400);

    const reordered = await request(app).put(`/api/events/${event.id}/queue`).send({ order: [qb.id, qa.id] });
    expect(reordered.body.map((q: any) => q.id)).toEqual([qb.id, qa.id]);

    const patched = await request(app).patch(`/api/queue/${qa.id}`).send({ title: 'Director Speech', durationSeconds: 300 });
    expect(patched.body.title).toBe('Director Speech');

    expect((await request(app).delete(`/api/queue/${qb.id}`)).status).toBe(204);
    const queue = await request(app).get(`/api/events/${event.id}/queue`);
    expect(queue.body).toHaveLength(1);
    expect(queue.body[0].position).toBe(0);
  });

  it('removes queue items when their media is deleted', async () => {
    const event = await createEvent();
    const media = (await upload(event.id, [[PNG, 'x.png']])).body.uploaded[0];
    await request(app).post(`/api/events/${event.id}/queue`).send({ mediaId: media.id });
    expect((await request(app).delete(`/api/media/${media.id}`)).status).toBe(204);
    expect((await request(app).get(`/api/events/${event.id}/queue`)).body).toHaveLength(0);
  });
});

describe('schedule', () => {
  it('validates and stores schedule items', async () => {
    const event = await createEvent();
    expect((await request(app).post(`/api/events/${event.id}/schedule`).send({ time: '25:00', title: 'x' })).status).toBe(400);
    await request(app).post(`/api/events/${event.id}/schedule`).send({ time: '10:15', title: 'Director Speech' });
    await request(app).post(`/api/events/${event.id}/schedule`).send({ time: '10:00', title: 'Opening' });
    const list = await request(app).get(`/api/events/${event.id}/schedule`);
    expect(list.body.map((s: any) => s.title)).toEqual(['Opening', 'Director Speech']);
  });
});

describe('real-time control (Socket.IO)', () => {
  it('drives the display: show, next, black, and restores state on rejoin', async () => {
    const event = await createEvent('Live Event');
    const up = await upload(event.id, [
      [PNG, 'welcome.png'],
      [PDF, 'talk.pdf'],
    ]);
    const [img, pdf] = up.body.uploaded;
    const q1 = (await request(app).post(`/api/events/${event.id}/queue`).send({ mediaId: img.id, notes: 'TOP SECRET NOTE' })).body;
    const q2 = (await request(app).post(`/api/events/${event.id}/queue`).send({ mediaId: pdf.id, title: 'The Talk' })).body;

    const operator = await connect();
    const display = await connect();
    const seen: string[] = [];
    display.onAny((_name, payload) => seen.push(JSON.stringify(payload)));

    const opJoin = await emit(operator, 'event:join', { eventId: event.id, role: 'operator' });
    expect(opJoin.ok).toBe(true);
    const presence = nextEvent(operator, 'presence:update', (p: any) => p.displays === 1);
    const join = await emit(display, 'event:join', { eventId: event.id, role: 'display' });
    expect(join.ok).toBe(true);
    expect(join.data.display.mode).toBe('waiting');
    await presence;

    // Displays may not issue commands.
    const denied = await emit(display, 'control', { type: 'black' });
    expect(denied.ok).toBe(false);

    let update = nextEvent(display, 'display:update', (s: any) => s.queueItemId === q1.id);
    expect((await emit(operator, 'control', { type: 'show-item', queueItemId: q1.id })).ok).toBe(true);
    let snap = await update;
    expect(snap.mode).toBe('media');
    expect(snap.media.kind).toBe('image');

    update = nextEvent(display, 'display:update', (s: any) => s.queueItemId === q2.id);
    await emit(operator, 'control', { type: 'next' });
    snap = await update;
    expect(snap.title).toBe('The Talk');
    expect(snap.media.kind).toBe('pdf');

    const end = await emit(operator, 'control', { type: 'next' });
    expect(end.ok).toBe(false);
    expect(end.error).toMatch(/last item/);

    update = nextEvent(display, 'display:update', (s: any) => s.page === 2);
    await emit(operator, 'control', { type: 'page', delta: 1 });
    await update;

    update = nextEvent(display, 'display:update', (s: any) => s.mode === 'black');
    await emit(operator, 'control', { type: 'black' });
    await update;

    // A refreshed display (new connection) gets the current state immediately.
    display.disconnect();
    const display2 = await connect();
    const rejoin = await emit(display2, 'event:join', { eventId: event.id, role: 'display' });
    expect(rejoin.data.display.mode).toBe('black');
    expect(rejoin.data.display.queueItemId).toBe(q2.id);
    expect(rejoin.data.display.page).toBe(2);

    update = nextEvent(display2, 'display:update', (s: any) => s.mode === 'media');
    await emit(operator, 'control', { type: 'show-current' });
    snap = await update;
    expect(snap.media.id).toBe(pdf.id);

    // Speaker notes never reach display clients.
    expect(seen.join('\n')).not.toContain('TOP SECRET NOTE');
    expect(JSON.stringify(rejoin)).not.toContain('TOP SECRET NOTE');
  });

  it('keeps an authoritative, synchronized timer', async () => {
    const event = await createEvent('Timer Event');
    const operator = await connect();
    await emit(operator, 'event:join', { eventId: event.id, role: 'operator' });

    const configured = await emit(operator, 'control', { type: 'timer-configure', durationMs: 60_000, warningMs: 10_000 });
    expect(configured.data.remainingMs).toBe(60_000);

    const started = await emit(operator, 'control', { type: 'timer-start' });
    expect(started.data.status).toBe('running');
    expect(started.data.startedAt).toBeGreaterThan(0);

    await new Promise((r) => setTimeout(r, 300));
    const paused = await emit(operator, 'control', { type: 'timer-pause' });
    expect(paused.data.status).toBe('paused');
    expect(paused.data.remainingMs).toBeLessThanOrEqual(59_750);
    expect(paused.data.remainingMs).toBeGreaterThan(58_000);

    // A second client sees exactly the same state.
    const other = await connect();
    const join = await emit(other, 'event:join', { eventId: event.id, role: 'display' });
    expect(join.data.timer.remainingMs).toBe(paused.data.remainingMs);

    const adjusted = await emit(operator, 'control', { type: 'timer-adjust', deltaMs: 60_000 });
    expect(adjusted.data.remainingMs).toBe(paused.data.remainingMs + 60_000);

    const reset = await emit(operator, 'control', { type: 'timer-reset' });
    expect(reset.data).toMatchObject({ status: 'idle', remainingMs: 60_000 });

    // The server finishes the countdown on its own.
    await emit(operator, 'control', { type: 'timer-configure', durationMs: 1000 });
    const finished = nextEvent(operator, 'timer:update', (t: any) => t.status === 'finished');
    await emit(operator, 'control', { type: 'timer-start' });
    expect((await finished).remainingMs).toBe(0);
  });

  it('exposes the same commands over REST', async () => {
    const event = await createEvent();
    const res = await request(app).post(`/api/events/${event.id}/control`).send({ type: 'waiting' });
    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBe('waiting');
    expect((await request(app).post(`/api/events/${event.id}/control`).send({ type: 'rm -rf' })).status).toBe(400);
    expect((await request(app).post(`/api/events/${event.id}/control`).send({ type: 'next' })).body.error).toMatch(/queue is empty/i);
  });
});

describe('event deletion', () => {
  it('cascades to media and removes uploaded files', async () => {
    const event = await createEvent();
    await upload(event.id, [[PNG, 'bye.png']]);
    const dir = path.join(config.uploadsDir, event.id);
    expect(fs.existsSync(dir)).toBe(true);
    expect((await request(app).delete(`/api/events/${event.id}`)).status).toBe(204);
    expect(fs.existsSync(dir)).toBe(false);
    expect(await prisma.media.count({ where: { eventId: event.id } })).toBe(0);
  });
});
