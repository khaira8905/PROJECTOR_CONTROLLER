/**
 * End-to-end check of the critical MVP flow in a real browser:
 *   operator dashboard → server → projector display.
 *
 * Usage (with the app running via `npm run dev`):
 *   npx playwright install chromium   # once, if you have no Chromium for Playwright
 *   npm run e2e                       # or: BASE_URL=http://localhost:4000 npm run e2e
 *
 * The script creates its own temporary event and deletes it afterwards.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'server', 'demo-assets');
const ok = (msg) => console.log(`  ✔ ${msg}`);

async function api(method, url, body) {
  const res = await fetch(BASE + url, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body && JSON.stringify(body) });
  if (!res.ok && res.status !== 204) throw new Error(`${method} ${url} → ${res.status}`);
  return res.status === 204 ? null : res.json();
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const event = await api('POST', '/api/events', { name: `E2E Check ${Date.now()}`, date: '2026-09-24', waitingMessage: 'E2E waiting' });
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const op = await ctx.newPage();
  op.on('pageerror', (e) => errors.push(e.message));

  console.log(`Event ${event.id}`);
  await op.goto(`${BASE}/events/${event.id}`);
  await op.getByText('Current display').waitFor();
  ok('1-2. dashboard opened');

  await op.locator('input[type=file]').setInputFiles([path.join(assets, 'Welcome.png'), path.join(assets, 'Speaker Presentation.pdf')]);
  await op.getByText('Uploaded 2 files.').waitFor();
  ok('3. uploaded image + PDF');

  for (const name of ['Welcome.png', 'Speaker Presentation.pdf']) {
    await op.locator('li', { hasText: name }).last().getByRole('button', { name: 'Queue' }).click();
    await op.getByText(`Added "${name}" to the queue.`).waitFor();
  }
  ok('4. added both to the queue');

  const display = await ctx.newPage();
  display.on('pageerror', (e) => errors.push(e.message));
  await display.goto(`${BASE}/display/${event.id}`);
  await display.getByText('E2E waiting').waitFor();
  await op.getByText(/Live · 1 display/).waitFor();
  ok('5. display connected (dashboard shows LIVE)');

  await op.locator('li', { hasText: 'Welcome.png' }).first().hover();
  await op.getByRole('button', { name: 'Show Welcome.png on display' }).click();
  await display.locator('img[alt="Welcome.png"]').waitFor();
  ok('6-7. selected item appears on the display');

  await op.mouse.click(700, 880);
  await op.keyboard.press('ArrowRight');
  await display.locator('canvas:not(.invisible)').waitFor();
  ok('8-9. NEXT shows the PDF on the display');

  const t0 = Date.now();
  await op.keyboard.press('b');
  await display.waitForFunction(() => !document.querySelector('canvas, img, h1'));
  ok(`10-11. BLACK SCREEN (${Date.now() - t0} ms)`);

  await op.keyboard.press(' ');
  await op.waitForTimeout(2200);
  const value = await op.locator('.text-6xl').innerText();
  if (!/^09:5[6-8]$/.test(value)) throw new Error(`Unexpected timer value ${value}`);
  ok(`12-13. timer running (${value})`);

  await display.reload();
  await display.waitForTimeout(1500);
  const state = await api('GET', `/api/events/${event.id}/state`);
  if (state.display.mode !== 'black' || state.presence.displays !== 1) throw new Error('Display did not restore state');
  await op.keyboard.press('s');
  await display.locator('canvas:not(.invisible)').waitFor();
  ok('14. refreshed display reconnected and restored state');

  if (errors.length) throw new Error(`Page errors: ${errors.join('; ')}`);
  console.log('\nAll checks passed.');
} finally {
  await api('DELETE', `/api/events/${event.id}`).catch(() => {});
  await browser.close();
}
