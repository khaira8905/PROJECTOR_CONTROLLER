import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import { createApp } from './app';
import { config } from './config';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { createSocketServer } from './socket';
import { seedDemoIfEmpty } from './services/demoSeed';
import { restoreRunningTimers } from './services/timerService';
import { tmpUploadDir } from './services/mediaStorage';

function lanAddresses(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a): a is os.NetworkInterfaceInfo => !!a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

async function main() {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
  // Leftovers from interrupted uploads.
  fs.rmSync(tmpUploadDir(), { recursive: true, force: true });

  if (config.seedDemo) await seedDemoIfEmpty();
  await restoreRunningTimers();

  const app = createApp();
  const server = http.createServer(app);
  createSocketServer(server);

  server.listen(config.port, config.host, () => {
    logger.info(`EventControl server listening on http://localhost:${config.port}`);
    for (const ip of lanAddresses()) logger.info(`  on your network: http://${ip}:${config.port}`);
  });

  const shutdown = async () => {
    logger.info('Shutting down…');
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
