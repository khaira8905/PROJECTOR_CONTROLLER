import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { getFileType, hashFile, storeFile } from './mediaStorage';

interface DemoItem {
  file: string;
  title?: string;
  notes?: string;
  durationSeconds?: number;
}

const QUEUE: DemoItem[] = [
  { file: 'Welcome.png', title: 'Welcome Screen', notes: 'Hold on this until the auditorium is seated. Cue the MC.' },
  {
    file: 'ACM Introduction.pptx',
    title: 'ACM Introduction',
    notes: 'Open in PowerPoint on the projector laptop (Open Externally). Introduce the ACM student chapter before slide 3.',
    durationSeconds: 600,
  },
  {
    file: 'Speaker Presentation.pdf',
    title: 'Guest Speaker — Building for the Web',
    notes: 'Speaker asked for a 2-minute warning. Start the 20:00 timer when they begin.',
    durationSeconds: 1200,
  },
  { file: 'Break.webm', title: 'Break Video', notes: 'Loop during the 10-minute break. Lights up.', durationSeconds: 600 },
  { file: 'Closing.png', title: 'Closing & Thank You', notes: 'Thank sponsors and volunteers. Announce the group photo.' },
];

const SCHEDULE = [
  { time: '10:00', title: 'Opening', description: 'Doors open, welcome screen' },
  { time: '10:05', title: 'Welcome Address', description: 'MC opens the event' },
  { time: '10:15', title: 'ACM Introduction', description: 'Chapter chair' },
  { time: '10:30', title: 'Guest Presentation', description: 'Building for the Web' },
  { time: '10:50', title: 'Break', description: 'Refreshments in the lobby' },
  { time: '11:00', title: 'Technical Session', description: 'Hands-on workshop' },
  { time: '12:00', title: 'Closing Ceremony', description: 'Prizes and group photo' },
];

/** Creates demo events the first time the app starts, so it is demonstrable immediately. */
export async function seedDemoIfEmpty() {
  const count = await prisma.event.count();
  if (count > 0) return;

  logger.info('Empty database: creating demo events…');
  const event = await prisma.event.create({
    data: {
      name: 'ACM Tech Fest 2026',
      date: new Date('2026-09-24T00:00:00.000Z'),
      venue: 'Main Auditorium',
      description: 'Annual technical festival of the ACM student chapter — talks, workshops and demos.',
      waitingMessage: 'The session will begin shortly',
      timerState: { create: { durationMs: 10 * 60_000, remainingMs: 10 * 60_000, warningMs: 2 * 60_000 } },
      displayState: { create: { mode: 'waiting' } },
      scheduleItems: { create: SCHEDULE },
    },
  });

  const files = [...QUEUE.map((q) => q.file), 'ACM Logo.png'];
  const mediaIds = new Map<string, string>();
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'eventcontrol-demo-'));
  try {
    for (const file of files) {
      const source = path.join(config.demoAssetsDir, file);
      const type = getFileType(file);
      if (!type || !fs.existsSync(source)) {
        logger.warn(`Demo asset missing, skipping: ${file}`);
        continue;
      }
      // storeFile moves its input, so work on a copy of the bundled asset.
      const copy = path.join(tmpDir, path.basename(file));
      await fsp.copyFile(source, copy);
      const [hash, stat] = await Promise.all([hashFile(copy), fsp.stat(copy)]);
      const storagePath = await storeFile(copy, event.id, file);
      const media = await prisma.media.create({
        data: { eventId: event.id, name: file, originalName: file, storagePath, kind: type.kind, mimeType: type.mimeType, size: stat.size, hash },
      });
      mediaIds.set(file, media.id);
    }
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }

  let position = 0;
  for (const item of QUEUE) {
    const mediaId = mediaIds.get(item.file);
    if (!mediaId) continue;
    await prisma.queueItem.create({
      data: {
        eventId: event.id,
        mediaId,
        position: position++,
        title: item.title,
        notes: item.notes ?? '',
        durationSeconds: item.durationSeconds ?? null,
      },
    });
  }
  const logoId = mediaIds.get('ACM Logo.png');
  if (logoId) await prisma.event.update({ where: { id: event.id }, data: { logoMediaId: logoId } });

  await prisma.event.create({
    data: {
      name: 'ACM Recruitment 2026',
      date: new Date('2026-10-05T00:00:00.000Z'),
      venue: 'Seminar Hall B',
      description: 'Orientation and recruitment drive for new chapter members.',
      timerState: { create: {} },
      displayState: { create: {} },
    },
  });

  logger.info(`Demo event "${event.name}" created with ${mediaIds.size} media files.`);
}
