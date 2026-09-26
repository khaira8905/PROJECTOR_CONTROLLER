import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Every test run gets its own throwaway SQLite database and uploads directory,
 * so tests never touch the real event data.
 */
const root = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eventcontrol-test-'));
// TEST_DATABASE_URL=postgresql://… runs the suite against an EMPTY Postgres database (the client must be
// generated for Postgres first: DATABASE_URL=… node scripts/prisma.mjs generate).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || `file:${path.join(tmp, 'test.db')}`;
execFileSync(process.execPath, [path.join(root, 'scripts', 'prisma.mjs'), 'db', 'push', '--skip-generate'], {
  stdio: 'ignore',
  env: process.env,
});
process.env.UPLOADS_DIR = path.join(tmp, 'uploads');
process.env.ALLOW_EXTERNAL_OPEN = 'false';
process.env.MAX_UPLOAD_MB = '5';
process.env.AUTH_PROVIDER = 'local'; // most suites exercise the private (sign-in) mode; public-access.test.ts switches it off
