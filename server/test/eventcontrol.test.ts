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
import { PDFDocument } from 'pdf-lib';
import { findSoffice } from '../src/services/processingService';
import { resetCloudStorage } from '../src/services/storage';

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0f01f0005000201e2213fbc0000000049454e44ae426082',
  'hex',
);
const PNG_2 = Buffer.concat([PNG, Buffer.from('extra')]);
let PDF: Buffer; // a real 4-page PDF, generated in beforeAll

async function makePdf(pages: number) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([640, 360]);
  return Buffer.from(await doc.save());
}

const app = createApp();
const server = http.createServer(app);
createSocketServer(server);
let baseUrl = '';
const sockets: Socket[] = [];
/** A supertest agent that keeps the operator's session cookie. */
const api = request.agent(app);
let sessionCookie = '';

/** Connects a Socket.IO client; operators send the session cookie like a browser would. */
function connect(signedIn = true): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(baseUrl, {
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: signedIn && sessionCookie ? { cookie: sessionCookie } : {},
    });
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
  const res = await api.post('/api/events').send({ name, date: '2026-09-24', description: 'd' });
  expect(res.status).toBe(201);
  return res.body as { id: string; name: string };
}

async function upload(eventId: string, files: [Buffer, string][]) {
  let req = api.post(`/api/events/${eventId}/media`);
  for (const [buf, name] of files) req = req.attach('files', buf, name);
  return req;
}

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  PDF = await makePdf(4);

  // First run: the operator chooses a password, which also signs them in.
  const status = await request(app).get('/api/auth/status');
  expect(status.body).toMatchObject({ configured: false, authenticated: false });
  const setup = await api.post('/api/auth/setup').send({ password: 'stage-door-42' });
  expect(setup.status).toBe(201);
  sessionCookie = String(setup.headers['set-cookie']).split(';')[0];
});

afterAll(async () => {
  sockets.forEach((s) => s.disconnect());
  stopAll();
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

describe('events API', () => {
  it('validates input', async () => {
    const res = await api.post('/api/events').send({ date: '2026-01-01' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
    expect(res.body.stack).toBeUndefined();
  });

  it('creates, reads, updates and lists events', async () => {
    const event = await createEvent('ACM Tech Fest 2026');
    const got = await api.get(`/api/events/${event.id}`);
    expect(got.status).toBe(200);
    expect(got.body.date).toBe('2026-09-24');

    const updated = await api.put(`/api/events/${event.id}`).send({ name: 'Renamed', waitingMessage: 'Back soon' });
    expect(updated.body.name).toBe('Renamed');

    const list = await api.get('/api/events');
    expect(list.body.some((e: any) => e.id === event.id)).toBe(true);
  });

  it('returns 404 for unknown events and API routes', async () => {
    expect((await api.get('/api/events/doesnotexist')).status).toBe(404);
    expect((await api.get('/api/nope')).status).toBe(404);
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
    const file = await api.get(media.url);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toBe('image/png');

    const renamed = await api.patch(`/api/media/${media.id}`).send({ name: 'Sponsor/Logo' });
    expect(renamed.body.name).toBe('SponsorLogo');

    const row = await prisma.media.findUniqueOrThrow({ where: { id: media.id } });
    fs.rmSync(path.join(config.uploadsDir, row.storagePath));
    const missing = await api.get(media.url);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBe('Media file no longer exists.');
    const list = await api.get(`/api/events/${event.id}/media`);
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
    const qa = (await api.post(`/api/events/${event.id}/queue`).send({ mediaId: a.id, notes: 'secret' })).body;
    const qb = (await api.post(`/api/events/${event.id}/queue`).send({ mediaId: b.id })).body;
    expect([qa.position, qb.position]).toEqual([0, 1]);

    const bad = await api.put(`/api/events/${event.id}/queue`).send({ order: [qa.id] });
    expect(bad.status).toBe(400);

    const reordered = await api.put(`/api/events/${event.id}/queue`).send({ order: [qb.id, qa.id] });
    expect(reordered.body.map((q: any) => q.id)).toEqual([qb.id, qa.id]);

    const patched = await api.patch(`/api/queue/${qa.id}`).send({ title: 'Director Speech', durationSeconds: 300 });
    expect(patched.body.title).toBe('Director Speech');

    expect((await api.delete(`/api/queue/${qb.id}`)).status).toBe(204);
    const queue = await api.get(`/api/events/${event.id}/queue`);
    expect(queue.body).toHaveLength(1);
    expect(queue.body[0].position).toBe(0);
  });

  it('removes queue items when their media is deleted', async () => {
    const event = await createEvent();
    const media = (await upload(event.id, [[PNG, 'x.png']])).body.uploaded[0];
    await api.post(`/api/events/${event.id}/queue`).send({ mediaId: media.id });
    expect((await api.delete(`/api/media/${media.id}`)).status).toBe(204);
    expect((await api.get(`/api/events/${event.id}/queue`)).body).toHaveLength(0);
  });
});

describe('schedule', () => {
  it('validates and stores schedule items', async () => {
    const event = await createEvent();
    expect((await api.post(`/api/events/${event.id}/schedule`).send({ time: '25:00', title: 'x' })).status).toBe(400);
    await api.post(`/api/events/${event.id}/schedule`).send({ time: '10:15', title: 'Director Speech' });
    await api.post(`/api/events/${event.id}/schedule`).send({ time: '10:00', title: 'Opening' });
    const list = await api.get(`/api/events/${event.id}/schedule`);
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
    const q1 = (await api.post(`/api/events/${event.id}/queue`).send({ mediaId: img.id, notes: 'TOP SECRET NOTE' })).body;
    const q2 = (await api.post(`/api/events/${event.id}/queue`).send({ mediaId: pdf.id, title: 'The Talk' })).body;

    const operator = await connect();
    const display = await connect(false);
    const seen: string[] = [];
    display.onAny((_name, payload) => seen.push(JSON.stringify(payload)));

    const opJoin = await emit(operator, 'event:join', { eventId: event.id, role: 'operator' });
    expect(opJoin.ok).toBe(true);
    const presence = nextEvent(operator, 'presence:update', (p: any) => p.displays === 1);
    const join = await emit(display, 'event:join', { eventId: event.id, role: 'display' });
    expect(join.ok).toBe(true);
    expect(join.data.display.mode).toBe('screen');
    expect(join.data.display.screen.key).toBe('please-wait');
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
    expect(snap.media.pageCount).toBe(4);
    expect(snap.page).toBe(1);

    // NEXT walks through the PDF's pages before running off the end of the flow.
    for (const page of [2, 3, 4]) {
      update = nextEvent(display, 'display:update', (s: any) => s.page === page);
      await emit(operator, 'control', { type: 'next' });
      await update;
    }
    const end = await emit(operator, 'control', { type: 'next' });
    expect(end.ok).toBe(false);
    expect(end.error).toMatch(/last item/);

    // Jump straight to a slide.
    update = nextEvent(display, 'display:update', (s: any) => s.page === 2);
    await emit(operator, 'control', { type: 'page', page: 2 });
    await update;

    update = nextEvent(display, 'display:update', (s: any) => s.mode === 'black');
    await emit(operator, 'control', { type: 'black' });
    await update;

    // A refreshed display (new connection) gets the current state immediately.
    display.disconnect();
    const display2 = await connect(false);
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
    const startedAt = Date.now();
    await emit(operator, 'control', { type: 'timer-start' });
    const done = await finished;
    expect(done.remainingMs).toBe(0);
    // It records when it hit zero, so operators can count the overtime; a reset clears it.
    expect(done.finishedAt).toBeGreaterThanOrEqual(startedAt + 900);
    const cleared = await emit(operator, 'control', { type: 'timer-reset' });
    expect(cleared.data.finishedAt).toBeNull();
  });

  it('exposes the same commands over REST', async () => {
    const event = await createEvent();
    const res = await api.post(`/api/events/${event.id}/control`).send({ type: 'waiting' });
    expect(res.status).toBe(200);
    // The legacy "waiting" command now shows the Please Wait screen.
    expect(res.body.data.mode).toBe('screen');
    expect(res.body.data.screen.key).toBe('please-wait');
    expect((await api.post(`/api/events/${event.id}/control`).send({ type: 'rm -rf' })).status).toBe(400);
    expect((await api.post(`/api/events/${event.id}/control`).send({ type: 'next' })).body.error).toMatch(/show flow is empty/i);
  });
});

describe('event deletion', () => {
  it('cascades to media and removes uploaded files', async () => {
    const event = await createEvent();
    await upload(event.id, [[PNG, 'bye.png']]);
    const dir = path.join(config.uploadsDir, event.id);
    expect(fs.existsSync(dir)).toBe(true);
    expect((await api.delete(`/api/events/${event.id}`)).status).toBe(204);
    expect(fs.existsSync(dir)).toBe(false);
    expect(await prisma.media.count({ where: { eventId: event.id } })).toBe(0);
  });
});

describe('authentication', () => {
  it('protects operator APIs and control, but lets displays connect', async () => {
    const anon = request(app);
    expect((await anon.get('/api/events')).status).toBe(401);
    expect((await anon.post('/api/events').send({ name: 'x', date: '2026-01-01' })).status).toBe(401);
    expect((await anon.get('/api/health')).status).toBe(200);
    expect((await anon.post('/api/auth/setup').send({ password: 'another-one' })).status).toBe(409);
    expect((await anon.post('/api/auth/login').send({ password: 'wrong' })).status).toBe(401);

    const login = await anon.post('/api/auth/login').send({ password: 'stage-door-42' });
    expect(login.status).toBe(200);
    expect(String(login.headers['set-cookie'])).toMatch(/ec_session=.*HttpOnly/i);

    const event = await createEvent('Auth Event');
    const stranger = await connect(false);
    const asOperator = await emit(stranger, 'event:join', { eventId: event.id, role: 'operator' });
    expect(asOperator.ok).toBe(false);
    expect(asOperator.error).toMatch(/sign in/i);
    const asDisplay = await emit(stranger, 'event:join', { eventId: event.id, role: 'display' });
    expect(asDisplay.ok).toBe(true);
  });
});

describe('show flow across independent files', () => {
  it('steps through slide ranges, screens and separate files in order', async () => {
    const event = await createEvent('Flow Event');
    const opening = (await upload(event.id, [[await makePdf(5), 'Opening.pdf']])).body.uploaded[0];
    const speaker = (await upload(event.id, [[await makePdf(3), 'Speaker-1.pdf']])).body.uploaded[0];
    expect(opening.pageCount).toBe(5);
    const screens = (await api.get(`/api/events/${event.id}/screens`)).body;
    expect(screens.map((s: any) => s.key)).toEqual(expect.arrayContaining(['please-wait', 'technical', 'break', 'starting', 'coming-up', 'thanks']));
    const pleaseWait = screens.find((s: any) => s.key === 'please-wait');

    const add = (body: object) => api.post(`/api/events/${event.id}/queue`).send(body);
    expect((await add({ mediaId: opening.id, startPage: 4, endPage: 2 })).status).toBe(400);
    const a = (await add({ mediaId: opening.id, startPage: 2, endPage: 3 })).body;
    const b = (await add({ kind: 'screen', screenId: pleaseWait.id, durationSeconds: 30 })).body;
    const c = (await add({ mediaId: speaker.id })).body;
    expect(b.screen.title).toBe('Please Wait');

    const op = await connect();
    await emit(op, 'event:join', { eventId: event.id, role: 'operator' });
    const next = async () => (await emit(op, 'control', { type: 'next' })).data;
    const prev = async () => (await emit(op, 'control', { type: 'previous' })).data;

    const trail: string[] = [];
    const where = (s: any) => (s.mode === 'screen' ? `screen:${s.screen.key}` : `${s.media.name}#${s.page}`);
    let snap = await next();
    trail.push(where(snap));
    while (true) {
      const res = await emit(op, 'control', { type: 'next' });
      if (!res.ok) break;
      trail.push(where(res.data));
    }
    expect(trail).toEqual(['Opening.pdf#2', 'Opening.pdf#3', 'screen:please-wait', 'Speaker-1.pdf#1', 'Speaker-1.pdf#2', 'Speaker-1.pdf#3']);
    expect(snap.range).toEqual({ start: 2, end: 3 });

    // PREVIOUS goes back through the screen to the LAST slide of the previous file's range.
    snap = await prev(); // Speaker-1 #2
    snap = await prev(); // #1
    snap = await prev();
    expect(snap.mode).toBe('screen');
    snap = await prev();
    expect(where(snap)).toBe('Opening.pdf#3');

    // Emergency screen, then Esc/resume returns to the same slide.
    snap = (await emit(op, 'control', { type: 'show-screen', key: 'technical' })).data;
    expect(snap.screen.title).toBe('Technical Difficulty');
    snap = (await emit(op, 'control', { type: 'show-current' })).data;
    expect(where(snap)).toBe('Opening.pdf#3');

    // Please Wait with a 5-minute countdown — replacing a countdown that is already running.
    await emit(op, 'control', { type: 'timer-configure', durationMs: 60_000 });
    await emit(op, 'control', { type: 'timer-start' });
    const withTimer = await emit(op, 'control', { type: 'show-screen', key: 'please-wait', timerMs: 300_000 });
    expect(withTimer.ok).toBe(true);
    const state = (await api.get(`/api/events/${event.id}/state`)).body;
    expect(state.timer).toMatchObject({ status: 'running', durationMs: 300_000, showOnDisplay: true });
    expect(state.timer.remainingMs).toBeGreaterThan(290_000);
    await emit(op, 'control', { type: 'timer-reset' });

    // Show a specific slide of another file directly from the library.
    snap = (await emit(op, 'control', { type: 'show-media', mediaId: speaker.id, page: 3 })).data;
    expect(where(snap)).toBe('Speaker-1.pdf#3');
    expect(c.id).toBeTruthy();
    expect(a.startPage).toBe(2);
  });

  it('manages custom screens and the branding overlay', async () => {
    const event = await createEvent('Brand Event');
    const logo = (await upload(event.id, [[PNG, 'uni-logo.png']])).body.uploaded[0];
    const custom = await api.post(`/api/events/${event.id}/screens`).send({
      title: 'Faculty Interaction Session',
      subtitle: 'Starting in 5 minutes',
      backgroundMediaId: logo.id,
      showTimer: true,
    });
    expect(custom.status).toBe(201);
    expect(custom.body.background.id).toBe(logo.id);
    const builtin = (await api.get(`/api/events/${event.id}/screens`)).body.find((s: any) => s.key === 'thanks');
    expect((await api.delete(`/api/screens/${builtin.id}`)).status).toBe(400);
    expect((await api.patch(`/api/screens/${builtin.id}`).send({ subtitle: 'See you next year!' })).body.subtitle).toBe('See you next year!');

    const op = await connect();
    await emit(op, 'event:join', { eventId: event.id, role: 'operator' });
    let snap = (await emit(op, 'control', { type: 'show-screen', screenId: custom.body.id })).data;
    expect(snap.screen).toMatchObject({ title: 'Faculty Interaction Session', showTimer: true });

    const bad = await emit(op, 'control', { type: 'overlay', position: 'middle' });
    expect(bad.ok).toBe(false);
    snap = (await emit(op, 'control', { type: 'overlay', mediaId: logo.id, position: 'bottom-left', size: 10, opacity: 70, visible: true })).data;
    expect(snap.overlay).toMatchObject({ position: 'bottom-left', size: 10, opacity: 70, visible: true });
    expect(snap.overlay.media.id).toBe(logo.id);

    // Deleting the logo hides the overlay cleanly.
    await api.delete(`/api/media/${logo.id}`);
    const state = (await api.get(`/api/events/${event.id}/state`)).body;
    expect(state.display.overlay.visible).toBe(false);
  });

  it('keeps library folders', async () => {
    const event = await createEvent();
    const up = await api.post(`/api/events/${event.id}/media?folder=Sponsors`).attach('files', PNG, 'acme.png');
    expect(up.body.uploaded[0].folder).toBe('Sponsors');
    const moved = await api.patch(`/api/media/${up.body.uploaded[0].id}`).send({ folder: 'Logos' });
    expect(moved.body.folder).toBe('Logos');
  });
});

describe('PowerPoint conversion', () => {
  const soffice = findSoffice();
  it.skipIf(!soffice)('converts PPTX to slides that can be navigated', async () => {
    const event = await createEvent('Deck Event');
    const deck = fs.readFileSync(path.join(config.demoAssetsDir, 'ACM Introduction.pptx'));
    const up = await upload(event.id, [[deck, 'Opening.pptx']]);
    expect(up.body.uploaded[0].conversionStatus).toBe('pending');
    const id = up.body.uploaded[0].id;

    let media: any;
    for (let i = 0; i < 120; i++) {
      media = (await api.get(`/api/events/${event.id}/media`)).body.find((m: any) => m.id === id);
      if (media.conversionStatus !== 'pending') break;
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(media.conversionStatus).toBe('ready');
    expect(media.pageCount).toBe(4);
    expect(media.pdfUrl).toBe(`/api/media/${id}/render`);
    const pdf = await request(app).get(media.pdfUrl);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    // The original file is kept untouched.
    expect(Number((await request(app).get(media.url)).headers['content-length'])).toBe(deck.length);

    await api.post(`/api/events/${event.id}/queue`).send({ mediaId: id, startPage: 2 });
    const op = await connect();
    await emit(op, 'event:join', { eventId: event.id, role: 'operator' });
    const first = (await emit(op, 'control', { type: 'next' })).data;
    expect(first).toMatchObject({ page: 2, range: { start: 2, end: 4 } });
    expect(first.media.pdfUrl).toBe(media.pdfUrl);
  }, 90_000);
});

describe('cloud storage (Supabase Storage API)', () => {
  const objects = new Map<string, Buffer>();
  const deleted: string[] = [];
  let mock: http.Server;

  beforeAll(async () => {
    // A minimal stand-in for Supabase Storage's REST API.
    mock = http.createServer((req, res) => {
      const auth = req.headers.authorization;
      if (auth !== 'Bearer test-service-key') return res.writeHead(401).end();
      const url = decodeURIComponent(req.url ?? '');
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        if (req.method === 'GET' && url === '/storage/v1/bucket/eventcontrol') return res.writeHead(200).end('{}');
        const m = url.match(/^\/storage\/v1\/object\/eventcontrol(?:\/(.+))?$/);
        if (!m) return res.writeHead(404).end();
        if (req.method === 'POST' && m[1]) {
          objects.set(m[1], Buffer.concat(chunks));
          return res.writeHead(200).end('{}');
        }
        if (req.method === 'GET' && m[1]) {
          const obj = objects.get(m[1]);
          return obj ? res.writeHead(200).end(obj) : res.writeHead(404).end();
        }
        if (req.method === 'DELETE' && !m[1]) {
          for (const key of JSON.parse(Buffer.concat(chunks).toString()).prefixes) {
            deleted.push(key);
            objects.delete(key);
          }
          return res.writeHead(200).end('[]');
        }
        res.writeHead(400).end();
      });
    });
    await new Promise<void>((resolve) => mock.listen(0, '127.0.0.1', resolve));
    config.supabase.url = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;
    config.supabase.serviceKey = 'test-service-key';
    resetCloudStorage();
  });

  afterAll(async () => {
    config.supabase.url = '';
    config.supabase.serviceKey = '';
    resetCloudStorage();
    await new Promise((resolve) => mock.close(resolve));
  });

  it('uploads to the cloud, restores missing local files, and deletes remotely', async () => {
    const event = await createEvent('Cloud Event');
    const media = (await upload(event.id, [[PNG_2, 'sponsor.png']])).body.uploaded[0];
    let row: any;
    for (let i = 0; i < 40; i++) {
      row = await prisma.media.findUniqueOrThrow({ where: { id: media.id } });
      if (row.cloudStatus === 'synced') break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(row.cloudStatus).toBe('synced');
    expect(objects.get(row.storagePath)?.equals(PNG_2)).toBe(true);

    const status = (await api.get('/api/status')).body;
    expect(status.storage).toMatchObject({ provider: 'supabase', ok: true });

    // The local copy disappears (cleaned disk, new install): it is restored from the cloud.
    fs.rmSync(path.join(config.uploadsDir, row.storagePath));
    const file = await request(app).get(media.url);
    expect(file.status).toBe(200);
    expect(Buffer.from(file.body).equals(PNG_2)).toBe(true);

    await api.delete(`/api/media/${media.id}`);
    await new Promise((r) => setTimeout(r, 200));
    expect(deleted).toContain(row.storagePath);
  });
});
