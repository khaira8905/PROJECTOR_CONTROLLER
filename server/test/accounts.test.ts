import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createSocketServer } from '../src/socket';
import { config } from '../src/config';
import { prisma } from '../src/lib/prisma';
import { stopAll } from '../src/services/timerService';

/**
 * Accounts (AUTH_PROVIDER=supabase) against a fake Supabase Auth: people sign in with the
 * credentials the administrator created, and each person only ever sees their own events.
 */

const USERS: Record<string, { id: string; password: string; name: string }> = {
  'alice@example.com': { id: 'uuid-alice', password: 'alice-pass-1', name: 'Alice' },
  'bob@example.com': { id: 'uuid-bob', password: 'bob-pass-1', name: 'Bob' },
};

const app = createApp();
let server: http.Server;
let baseUrl = '';
let fake: http.Server;
const sockets: Socket[] = [];

beforeAll(async () => {
  fake = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const json = (status: number, data: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };
    if (req.url?.startsWith('/auth/v1/token') && req.headers.apikey === 'anon-key') {
      const { email, password } = JSON.parse(body || '{}');
      const u = USERS[email];
      if (email === 'pending@example.com') return json(400, { error: 'invalid_grant', error_description: 'Email not confirmed' });
      if (!u || u.password !== password) return json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      return json(200, { access_token: 'x', user: { id: u.id, email, user_metadata: { full_name: u.name } } });
    }
    json(404, {});
  });
  await new Promise<void>((resolve) => fake.listen(0, '127.0.0.1', resolve));
  config.auth.provider = 'supabase';
  config.supabase.url = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
  config.supabase.anonKey = 'anon-key';

  server = http.createServer(app);
  createSocketServer(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  sockets.forEach((s) => s.close());
  stopAll();
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => fake.close(resolve));
  config.supabase.url = '';
  await prisma.$disconnect();
});

async function signIn(email: string, password = USERS[email]?.password) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  return { agent, res, cookie: String(res.headers['set-cookie'] ?? '').split(';')[0] };
}

function join(eventId: string, role: 'operator' | 'display', cookie?: string) {
  const socket = connect(baseUrl, { transports: ['websocket'], extraHeaders: cookie ? { cookie } : {} });
  sockets.push(socket);
  return new Promise<{ ok: boolean; status?: number }>((resolve) => socket.emit('event:join', { eventId, role }, resolve));
}

describe('accounts', () => {
  let legacyId = '';
  let alice: Awaited<ReturnType<typeof signIn>>;
  let bob: Awaited<ReturnType<typeof signIn>>;
  let aliceEvent = '';

  it('requires signing in; wrong or unconfirmed credentials are refused', async () => {
    legacyId = (await prisma.event.create({ data: { name: 'Before accounts', date: new Date('2026-10-01') } })).id;
    expect((await request(app).get('/api/events')).status).toBe(401);
    expect((await request(app).get('/api/auth/status')).body).toMatchObject({ provider: 'supabase', enabled: true, authenticated: false });
    expect((await signIn('alice@example.com', 'wrong')).res.status).toBe(401);
    const pending = await signIn('pending@example.com', 'x');
    expect(pending.res.status).toBe(401);
    expect(pending.res.body.error).toMatch(/confirm/);
  });

  it('signs people in with the credentials created in Supabase', async () => {
    alice = await signIn('alice@example.com');
    expect(alice.res.status).toBe(200);
    const status = (await alice.agent.get('/api/auth/status')).body;
    expect(status).toMatchObject({ authenticated: true, account: { email: 'alice@example.com', name: 'Alice', plan: 'free' } });
    bob = await signIn('bob@example.com');
    expect(bob.res.status).toBe(200);
  });

  it('gives events from before accounts to the first account', async () => {
    const list = (await alice.agent.get('/api/events')).body;
    expect(list.map((e: any) => e.id)).toContain(legacyId);
    expect((await bob.agent.get('/api/events')).body.map((e: any) => e.id)).not.toContain(legacyId);
  });

  it('keeps each person’s events private', async () => {
    aliceEvent = (await alice.agent.post('/api/events').send({ name: 'Alice Show', date: '2026-10-02' })).body.id;
    const screens = (await alice.agent.get(`/api/events/${aliceEvent}/screens`)).body;
    const item = (await alice.agent.post(`/api/events/${aliceEvent}/queue`).send({ kind: 'screen', screenId: screens[0].id, script: 'Good evening everyone…' })).body;
    expect(item.script).toBe('Good evening everyone…');

    // Bob can't list, read, change, control or delete Alice's event, or anything in it.
    expect((await bob.agent.get('/api/events')).body.map((e: any) => e.id)).not.toContain(aliceEvent);
    expect((await bob.agent.get(`/api/events/${aliceEvent}`)).status).toBe(404);
    expect((await bob.agent.put(`/api/events/${aliceEvent}`).send({ name: 'Hijacked' })).status).toBe(404);
    expect((await bob.agent.get(`/api/events/${aliceEvent}/queue`)).status).toBe(404);
    expect((await bob.agent.patch(`/api/queue/${item.id}`).send({ title: 'x' })).status).toBe(404);
    expect((await bob.agent.delete(`/api/queue/${item.id}`)).status).toBe(404);
    expect((await bob.agent.patch(`/api/screens/${screens[0].id}`).send({ title: 'x' })).status).toBe(404);
    expect((await bob.agent.post(`/api/events/${aliceEvent}/control`).send({ type: 'black' })).status).toBe(404);
    expect((await bob.agent.delete(`/api/events/${aliceEvent}`)).status).toBe(404);
    expect((await alice.agent.get(`/api/events/${aliceEvent}`)).body.name).toBe('Alice Show');
  });

  it('lets only the owner control an event live; the projector link stays open', async () => {
    expect(await join(aliceEvent, 'operator', alice.cookie)).toMatchObject({ ok: true });
    expect(await join(aliceEvent, 'operator', bob.cookie)).toMatchObject({ ok: false, status: 404 });
    expect(await join(aliceEvent, 'operator')).toMatchObject({ ok: false, status: 401 });
    expect(await join(aliceEvent, 'display')).toMatchObject({ ok: true });
  });

  it('saves console settings to the account, separately per person', async () => {
    const prefs = { theme: 'blue', ui: { controlLayout: 'script', shortcuts: { next: ['N'] } } };
    expect((await alice.agent.put('/api/account/preferences').send({ preferences: prefs })).status).toBe(200);
    expect((await alice.agent.get('/api/account')).body).toMatchObject({ email: 'alice@example.com', preferences: prefs });
    expect((await bob.agent.get('/api/account')).body.preferences).toEqual({});
    // Signing in again (another computer) brings the same settings back.
    const again = await signIn('alice@example.com');
    expect((await again.agent.get('/api/account')).body.preferences).toEqual(prefs);
    const tooBig = { blob: 'x'.repeat(25_000) };
    expect((await alice.agent.put('/api/account/preferences').send({ preferences: tooBig })).status).toBe(400);
  });
});
