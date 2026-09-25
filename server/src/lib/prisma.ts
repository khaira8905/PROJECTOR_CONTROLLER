import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ROOT_DIR } from '../config';

// Same default as scripts/prisma.mjs: prisma/eventcontrol.db. Hosted deployments set
// DATABASE_URL to a file on a persistent volume (e.g. file:/data/eventcontrol.db).
const url = process.env.DATABASE_URL || `file:${path.join(ROOT_DIR, 'prisma', 'eventcontrol.db').split(path.sep).join('/')}`;

export const prisma = new PrismaClient({ datasourceUrl: url });
