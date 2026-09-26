/**
 * Runs the Prisma CLI for the configured database:
 *  - no DATABASE_URL           → SQLite at prisma/eventcontrol.db (local installs, zero config)
 *  - DATABASE_URL=file:…       → SQLite at that path (e.g. a persistent volume)
 *  - DATABASE_URL=postgres(ql)://… → PostgreSQL (e.g. Supabase, for free cloud hosting)
 *
 * prisma/schema.prisma is written for SQLite; for Postgres a copy with the provider
 * switched is generated (the models are identical).
 * Usage: node scripts/prisma.mjs <prisma args…>
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Same optional settings file the server reads (real environment variables win).
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.join(root, 'prisma', 'eventcontrol.db').split(path.sep).join('/')}`;
}

// Catch the usual copy-paste mistakes with a message that says what to do (shown in Render's log).
const db = process.env.DATABASE_URL;
if (/\[YOUR-PASSWORD\]|YOUR-PASSWORD/i.test(db)) {
  console.error('\nDATABASE_URL still contains [YOUR-PASSWORD]. Replace it (brackets included) with your Supabase database password.\n');
  process.exit(1);
}
if (/^postgres(ql)?:\/\/[^@]*@db\.[a-z0-9]+\.supabase\.co/i.test(db)) {
  console.error('\nDATABASE_URL is Supabase\'s "Direct connection", which hosts like Render cannot reach.\nIn Supabase click Connect → "Session pooler" and use that address instead (it contains "pooler.supabase.com").\n');
  process.exit(1);
}
if (/^postgres(ql)?:\/\//.test(db)) {
  try {
    new URL(db);
  } catch {
    console.error('\nDATABASE_URL is not a valid address. If your database password contains symbols such as @ # / ? :, reset it in Supabase (Project Settings → Database) to one with only letters and numbers.\n');
    process.exit(1);
  }
}

let schema = path.join(root, 'prisma', 'schema.prisma');
if (/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL)) {
  const source = fs.readFileSync(schema, 'utf8');
  const pg = source.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
  if (pg === source) throw new Error('Could not switch the Prisma provider to postgresql.');
  const dir = path.join(root, 'prisma', 'postgres');
  fs.mkdirSync(dir, { recursive: true });
  schema = path.join(dir, 'schema.prisma');
  fs.writeFileSync(schema, `// GENERATED from prisma/schema.prisma by scripts/prisma.mjs — do not edit.\n${pg}`);
}

const cli = createRequire(import.meta.url).resolve('prisma/build/index.js');
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2), '--schema', schema], { stdio: 'inherit', cwd: root, env: process.env });
process.exit(result.status ?? 1);
