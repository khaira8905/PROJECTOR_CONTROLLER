/**
 * End-to-end check of the critical MVP flow in a real browser:
 *   operator dashboard → server → projector display.
 *
 * Usage (with the app running via `npm run dev`):
 *   npx playwright install chromium   # once, if you have no Chromium for Playwright
 *   E2E_PASSWORD=<operator password> npm run e2e
 *   (BASE_URL=http://localhost:4000 for the production build)
 *
 * On a fresh install the script sets E2E_PASSWORD as the operator password.
 * It creates its own temporary event and deletes it afterwards.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const PASSWORD = process.env.E2E_PASSWORD ?? '';
let cookie = '';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'server', 'demo-assets');
const ok = (msg) => console.log(`  ✔ ${msg}`);

async function api(method, url, body) {
  const headers = { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) };
  const res = await fetch(BASE + url, { method, headers, body: body && JSON.stringify(body) });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  if (!res.ok && res.status !== 204) throw new Error(`${method} ${url} → ${res.status}`);
  return res.status === 204 ? null : res.json();
}

// Sign in (or create the password on a fresh install).
const auth = await api('GET', '/api/auth/status');
if (auth.enabled) {
  if (!PASSWORD) throw new Error('Set E2E_PASSWORD to the operator password.');
  await api('POST', auth.configured ? '/api/auth/login' : '/api/auth/setup', { password: PASSWORD });
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const event = await api('POST', '/api/events', { name: `E2E Check ${Date.now()}`, date: '2026-09-24' });
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (cookie) {
    const [name, value] = cookie.split('=');
    await ctx.addCookies([{ name, value, url: BASE }]);
  }
  const op = await ctx.newPage();
  op.on('pageerror', (e) => errors.push(e.message));

  console.log(`Event ${event.id}`);
  await op.goto(`${BASE}/events/${event.id}`);
  await op.getByText('Live Preview').waitFor();
  ok('1-2. dashboard opened');

  await op.locator('input[type=file]').setInputFiles([path.join(assets, 'Welcome.png'), path.join(assets, 'Speaker Presentation.pdf')]);
  await op.getByText('Uploaded 2 files.').waitFor();
  ok('3. uploaded image + PDF');

  for (const name of ['Welcome.png', 'Speaker Presentation.pdf']) {
    await op.getByPlaceholder('Search files…').fill(name);
    await op.getByRole('button', { name: `Add ${name} to the show flow` }).click();
    await op.getByText(`Added "${name}" to the show flow.`).waitFor();
  }
  ok('4. added both to the show flow');

  const display = await ctx.newPage();
  display.on('pageerror', (e) => errors.push(e.message));
  await display.goto(`${BASE}/display/${event.id}`);
  await display.getByRole('heading', { name: 'Please Wait' }).waitFor();
  await op.getByText('Display Connected', { exact: true }).waitFor();
  ok('5. display connected (top bar shows Display Connected)');

  await op.locator('ol li', { hasText: 'Welcome.png' }).hover();
  await op.getByRole('button', { name: 'Show Welcome.png on display' }).click();
  await display.locator('img[alt="Welcome.png"]').waitFor();
  ok('6-7. selected item appears on the display');

  await op.mouse.move(700, 12);
  await op.mouse.click(700, 12);
  await op.keyboard.press('ArrowRight');
  await display.locator('canvas:not(.invisible)').waitFor();
  await op.keyboard.press('ArrowRight');
  await op.getByText(/Page 2 of 4/).waitFor();
  ok('8-9. NEXT shows the PDF, then its next page');

  const t0 = Date.now();
  await op.keyboard.press('b');
  await display.waitForFunction(() => !document.querySelector('canvas, img, h1'));
  ok(`10-11. BLACK SCREEN (${Date.now() - t0} ms)`);

  await op.keyboard.press('p');
  await op.waitForTimeout(2200);
  // Background tabs only repaint about once a second, so give the readout a moment to catch up.
  let value = '';
  for (let i = 0; i < 20 && !/^09:5[6-8]$/.test(value); i++) {
    value = await op.locator('.ec-timer-readout').innerText();
    if (!/^09:5[6-8]$/.test(value)) await op.waitForTimeout(100);
  }
  if (!/^09:5[6-8]$/.test(value)) throw new Error(`Unexpected timer value ${value}`);
  ok(`12-13. timer running (${value})`);

  await display.reload();
  await display.waitForTimeout(1500);
  const state = await api('GET', `/api/events/${event.id}/state`);
  if (state.display.mode !== 'black' || state.presence.displays !== 1) throw new Error('Display did not restore state');
  await op.keyboard.press('Escape');
  await display.locator('canvas:not(.invisible)').waitFor();
  if ((await api('GET', `/api/events/${event.id}/state`)).display.page !== 2) throw new Error('Did not resume on page 2');
  ok('14. refreshed display reconnected and restored state; Esc resumed page 2');

  if (errors.length) throw new Error(`Page errors: ${errors.join('; ')}`);
  console.log('\nAll checks passed.');
} finally {
  await api('DELETE', `/api/events/${event.id}`).catch(() => {});
  await browser.close();
}
