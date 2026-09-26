#!/usr/bin/env node
/**
 * npm run share — give people a public https link to EventControl running on this computer.
 *
 * 1. Builds the app (if needed) and starts it in production mode on one port (UI + API +
 *    live updates together, so the link needs nothing else).
 * 2. Opens a Cloudflare quick tunnel to that port and prints the public address.
 *
 * Nothing on this computer is opened to the internet except EventControl itself: the tunnel
 * is an outgoing connection, no router or firewall change is needed. The link works while
 * this window stays open. For a permanent address, deploy it instead (README → Hosting).
 * Needs "cloudflared": https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT ?? '4000';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function hasCloudflared() {
  return spawnSync('cloudflared', ['--version'], { stdio: 'ignore', shell: process.platform === 'win32' }).status === 0;
}

if (!hasCloudflared()) {
  console.log(`
  To share a public link, install Cloudflare's free "cloudflared" once:
    Windows:  winget install --id Cloudflare.cloudflared
    macOS:    brew install cloudflared
    Linux:    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  Then run  npm run share  again. (No Cloudflare account needed.)
`);
  process.exit(1);
}

const built = fs.existsSync(path.join(root, 'client', 'dist', 'index.html')) && fs.existsSync(path.join(root, 'server', 'dist', 'server.js'));
if (!built || process.argv.includes('--build')) {
  console.log('Building EventControl (first time only, about a minute)…');
  if (spawnSync(npm, ['run', 'build'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }).status !== 0) process.exit(1);
}

const server = spawn(npm, ['start'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  // Behind the tunnel: trust its X-Forwarded-* headers (https, visitor address). PowerPoint
  // is never launched for visitors: the server only does that for requests from this machine.
  env: { ...process.env, NODE_ENV: 'production', PORT, TRUST_PROXY: process.env.TRUST_PROXY ?? '1' },
});

// Wait for the server, then open the tunnel.
const ready = async () => {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};

if (!(await ready())) {
  console.error('EventControl did not start. See the messages above.');
  server.kill();
  process.exit(1);
}

const tunnel = spawn('cloudflared', ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${PORT}`], { shell: process.platform === 'win32' });
let announced = false;
const watch = (chunk) => {
  const url = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  if (url && !announced) {
    announced = true;
    console.log(`
  ┌────────────────────────────────────────────────────────────┐
    EventControl is online:  ${url}
    Anyone with this link can open it — no password needed.
    Projector: open the link, pick the event, then "Open display".
    Keep this window open; Ctrl+C stops sharing.
  └────────────────────────────────────────────────────────────┘
`);
  }
};
tunnel.stdout.on('data', watch);
tunnel.stderr.on('data', watch);
tunnel.on('exit', (code) => {
  console.error(`The tunnel closed (${code}). Run npm run share again for a new link.`);
  server.kill();
  process.exit(code ?? 1);
});

const stop = () => {
  tunnel.kill();
  server.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
