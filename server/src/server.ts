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
import { resumeProcessing } from './services/processingService';
import { resumePendingUploads } from './services/cloudSync';

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
  // Background work interrupted by a restart: PowerPoint conversions and cloud uploads.
  void resumeProcessing().catch((err) => logger.error('Resuming file processing failed:', err));
  void resumePendingUploads().catch((err) => logger.error('Resuming cloud uploads failed:', err));

  const app = createApp();
  const server = http.createServer(app);
  createSocketServer(server);

  server.listen(config.port, config.host, () => {
    logger.info(`EventControl server listening on http://localhost:${config.port}`);
    for (const ip of lanAddresses()) logger.info(`  on your network: http://${ip}:${config.port}`);
    if (process.env.RENDER && !config.supabase.url) {
      logger.warn('Running on Render without SUPABASE_URL: uploaded files will be lost when the instance restarts.');
    }
    logger.info(`Sign-in: ${config.auth.provider} · Cloud storage: ${config.supabase.url ? `Supabase (${config.supabase.bucket})` : 'off (local files only)'}`);
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
