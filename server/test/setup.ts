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
const schema = fs
  .readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8')
  .replace(/url\s*=\s*"file:[^"]*"/, `url = "file:${path.join(tmp, 'test.db')}"`);
const schemaPath = path.join(tmp, 'schema.prisma');
fs.writeFileSync(schemaPath, schema);
execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'db', 'push', '--schema', schemaPath, '--skip-generate'], {
  stdio: 'ignore',
});

process.env.DATABASE_URL = `file:${path.join(tmp, 'test.db')}`;
process.env.UPLOADS_DIR = path.join(tmp, 'uploads');
process.env.ALLOW_EXTERNAL_OPEN = 'false';
process.env.MAX_UPLOAD_MB = '5';
