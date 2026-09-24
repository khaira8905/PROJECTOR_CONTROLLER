import { PrismaClient } from '@prisma/client';

// DATABASE_URL optionally overrides the database location (used by the test suite).
export const prisma = new PrismaClient(process.env.DATABASE_URL ? { datasourceUrl: process.env.DATABASE_URL } : undefined);
