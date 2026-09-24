import fsp from 'node:fs/promises';
import { spawn } from 'node:child_process';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError, badRequest, notFound } from '../lib/errors';
import { logger } from '../lib/logger';
import { toMediaDto } from '../lib/dto';
import { idParam } from '../lib/validation';
import { config } from '../config';
import {
  getFileType,
  displayNameFrom,
  hashFile,
  readFileHead,
  removeStoredFile,
  resolveStoragePath,
  storeFile,
  storedFileExists,
} from '../services/mediaStorage';
import * as display from '../services/displayService';
import { emitToOperators } from '../socket/bus';
import { findEventOr404 } from './eventsController';

async function findMediaOr404(id: string) {
  const media = await prisma.media.findUnique({ where: { id: idParam.parse(id) } });
  if (!media) throw notFound('Media not found.');
  return media;
}

async function notifyMediaChanged(eventId: string) {
  emitToOperators(eventId, 'media:changed', { eventId });
  emitToOperators(eventId, 'queue:changed', { eventId });
  await display.refresh(eventId);
}

export async function listMedia(req: Request<{ id: string }>, res: Response) {
  const event = await findEventOr404(req.params.id);
  const media = await prisma.media.findMany({ where: { eventId: event.id }, orderBy: { createdAt: 'asc' } });
  res.json(media.map(toMediaDto));
}

interface RejectedFile {
  name: string;
  error: string;
}

/**
 * Handles files already written to the temp directory by multer:
 * verify signature -> hash -> skip duplicates -> move into uploads/<event>/<type>/.
 */
export async function uploadMedia(req: Request<{ id: string }>, res: Response) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const rejected: RejectedFile[] = [...((req as any).rejectedFiles ?? [])];
  const cleanup = () => Promise.all(files.map((f) => fsp.rm(f.path, { force: true })));

  let event;
  try {
    event = await findEventOr404(req.params.id);
  } catch (err) {
    await cleanup();
    throw err;
  }
  if (files.length === 0 && rejected.length === 0) {
    throw badRequest('No files were uploaded.');
  }

  const uploaded = [];
  const duplicates = [];
  const seenHashes = new Set<string>();

  for (const file of files) {
    const name = displayNameFrom(file.originalname);
    try {
      const type = getFileType(file.originalname);
      if (!type) {
        rejected.push({ name, error: 'File type not supported.' });
        continue;
      }
      if (file.size === 0) {
        rejected.push({ name, error: 'File is empty.' });
        continue;
      }
      const head = await readFileHead(file.path);
      if (!type.signature(head)) {
        rejected.push({ name, error: 'File contents do not match its extension.' });
        continue;
      }
      const hash = await hashFile(file.path);
      const existing = await prisma.media.findUnique({ where: { eventId_hash: { eventId: event.id, hash } } });
      if (existing || seenHashes.has(hash)) {
        if (existing) duplicates.push(toMediaDto(existing));
        continue;
      }
      seenHashes.add(hash);
      const storagePath = await storeFile(file.path, event.id, file.originalname);
      const media = await prisma.media.create({
        data: {
          eventId: event.id,
          name,
          originalName: name,
          storagePath,
          kind: type.kind,
          mimeType: type.mimeType,
          size: file.size,
          hash,
        },
      });
      uploaded.push(toMediaDto(media));
      logger.info(`Uploaded "${name}" (${type.kind}, ${file.size} bytes) to event ${event.id}`);
    } catch (err) {
      logger.error(`Upload of "${name}" failed:`, err);
      rejected.push({ name, error: 'Unable to upload file.' });
    }
  }
  await cleanup();

  if (uploaded.length > 0) emitToOperators(event.id, 'media:changed', { eventId: event.id });

  const status = uploaded.length > 0 ? 201 : duplicates.length > 0 ? 200 : 400;
  res.status(status).json({
    uploaded,
    duplicates,
    rejected,
    ...(status === 400 ? { error: rejected[0]?.error ?? 'Unable to upload file.' } : {}),
  });
}

const renameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(200)
    .transform((v) => v.replace(/[\u0000-\u001f\u007f/\\]/g, '')),
});

export async function renameMedia(req: Request<{ mediaId: string }>, res: Response) {
  const media = await findMediaOr404(req.params.mediaId);
  const { name } = renameSchema.parse(req.body);
  if (!name) throw badRequest('Name is required.');
  const updated = await prisma.media.update({ where: { id: media.id }, data: { name } });
  await notifyMediaChanged(media.eventId);
  res.json(toMediaDto(updated));
}

export async function deleteMedia(req: Request<{ mediaId: string }>, res: Response) {
  const media = await findMediaOr404(req.params.mediaId);
  const queueItems = await prisma.queueItem.findMany({ where: { mediaId: media.id }, select: { id: true } });
  await display.handleRemoval(media.eventId, { mediaId: media.id, queueItemIds: queueItems.map((q) => q.id) });

  // Queue items referencing this media are removed by the cascading foreign key.
  await prisma.media.delete({ where: { id: media.id } });
  await prisma.event.updateMany({ where: { id: media.eventId, logoMediaId: media.id }, data: { logoMediaId: null } });
  try {
    await removeStoredFile(media.storagePath);
  } catch (err) {
    logger.warn('Could not remove media file from disk', media.id, err);
  }
  await notifyMediaChanged(media.eventId);
  logger.info(`Deleted media "${media.name}" (${media.id})`);
  res.status(204).end();
}

/** Streams a media file (with HTTP range support for video seeking). */
export async function serveMediaFile(req: Request<{ mediaId: string }>, res: Response) {
  const media = await findMediaOr404(req.params.mediaId);
  if (!storedFileExists(media.storagePath)) {
    throw new HttpError(404, 'Media file no longer exists.', 'MEDIA_MISSING');
  }
  const download = req.query.download === '1';
  res.setHeader('Content-Type', media.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const fileName = encodeURIComponent(media.name);
  res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${fileName}`);
  res.sendFile(resolveStoragePath(media.storagePath), { cacheControl: true, maxAge: '1h', dotfiles: 'deny' }, (err) => {
    if (err && !res.headersSent) {
      logger.error('Failed to send media file', media.id, err);
      res.status(404).json({ error: 'Media file no longer exists.' });
    }
  });
}

function openerFor(file: string): { cmd: string; args: string[] } {
  switch (process.platform) {
    case 'darwin':
      return { cmd: 'open', args: [file] };
    case 'win32':
      // explorer.exe opens a file with its associated app (PowerPoint) without a shell.
      return { cmd: 'explorer.exe', args: [file] };
    default:
      return { cmd: 'xdg-open', args: [file] };
  }
}

/**
 * Opens a stored presentation in its native application (e.g. PowerPoint) on the
 * machine running the server. Only files tracked in the database can be opened,
 * the command is fixed, and no shell is involved.
 */
export async function openMediaExternally(req: Request<{ mediaId: string }>, res: Response) {
  const media = await findMediaOr404(req.params.mediaId);
  if (!config.allowExternalOpen) {
    throw new HttpError(403, 'Opening files on the server machine is disabled.', 'OPEN_DISABLED');
  }
  if (!storedFileExists(media.storagePath)) {
    throw new HttpError(404, 'Media file no longer exists.', 'MEDIA_MISSING');
  }
  const file = resolveStoragePath(media.storagePath);
  const { cmd, args } = openerFor(file);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore', shell: false });
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      err ? reject(err) : resolve();
    };
    child.once('error', (err) => finish(err));
    child.once('exit', (code) => {
      // explorer.exe returns 1 even on success.
      if (code && code !== 0 && process.platform !== 'win32') finish(new Error(`${cmd} exited with ${code}`));
      else finish();
    });
    // Openers that keep running (or return later) are considered successful.
    setTimeout(() => finish(), 1500).unref();
    child.unref();
  }).catch((err) => {
    logger.error(`Unable to open "${media.name}" externally:`, err.message);
    throw new HttpError(500, 'Unable to start presentation. Download the file and open it manually.', 'OPEN_FAILED');
  });

  logger.info(`Opened "${media.name}" externally`);
  res.json({ ok: true });
}
