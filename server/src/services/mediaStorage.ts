import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config';
import { badRequest } from '../lib/errors';

export type MediaKind = 'image' | 'video' | 'pdf' | 'presentation';

interface FileTypeInfo {
  kind: MediaKind;
  mimeType: string;
  folder: 'images' | 'videos' | 'documents' | 'presentations';
  /** Returns true when the first bytes of the file look like this type. */
  signature: (head: Buffer) => boolean;
}

const startsWith = (head: Buffer, bytes: number[], offset = 0) =>
  bytes.every((b, i) => head[offset + i] === b);
const ascii = (head: Buffer, text: string, offset = 0) =>
  head.subarray(offset, offset + text.length).toString('latin1') === text;
const isZip = (h: Buffer) => startsWith(h, [0x50, 0x4b, 0x03, 0x04]);
const isOle = (h: Buffer) => startsWith(h, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const isIsoMedia = (h: Buffer) =>
  ['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].some((box) => ascii(h, box, 4));

/** The allowlist of accepted uploads. The extension decides the type; the signature confirms it. */
export const FILE_TYPES: Record<string, FileTypeInfo> = {
  '.png': { kind: 'image', mimeType: 'image/png', folder: 'images', signature: (h) => startsWith(h, [0x89, 0x50, 0x4e, 0x47]) },
  '.jpg': { kind: 'image', mimeType: 'image/jpeg', folder: 'images', signature: (h) => startsWith(h, [0xff, 0xd8, 0xff]) },
  '.jpeg': { kind: 'image', mimeType: 'image/jpeg', folder: 'images', signature: (h) => startsWith(h, [0xff, 0xd8, 0xff]) },
  '.webp': { kind: 'image', mimeType: 'image/webp', folder: 'images', signature: (h) => ascii(h, 'RIFF') && ascii(h, 'WEBP', 8) },
  '.mp4': { kind: 'video', mimeType: 'video/mp4', folder: 'videos', signature: isIsoMedia },
  '.mov': { kind: 'video', mimeType: 'video/quicktime', folder: 'videos', signature: isIsoMedia },
  '.webm': { kind: 'video', mimeType: 'video/webm', folder: 'videos', signature: (h) => startsWith(h, [0x1a, 0x45, 0xdf, 0xa3]) },
  '.pdf': { kind: 'pdf', mimeType: 'application/pdf', folder: 'documents', signature: (h) => ascii(h, '%PDF') },
  '.pptx': {
    kind: 'presentation',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    folder: 'presentations',
    signature: isZip,
  },
  '.ppt': { kind: 'presentation', mimeType: 'application/vnd.ms-powerpoint', folder: 'presentations', signature: isOle },
};

export const ACCEPTED_EXTENSIONS = Object.keys(FILE_TYPES);

export function getFileType(filename: string): FileTypeInfo | undefined {
  return FILE_TYPES[path.extname(filename).toLowerCase()];
}

/**
 * Produces a filesystem-safe name: no directories, no control characters, ASCII only.
 * "../../My Talk (final).PPTX" -> "My-Talk-final.pptx"
 */
export function sanitizeFilename(original: string): string {
  const base = path.basename(original.replace(/\\/g, '/'));
  const ext = path.extname(base).toLowerCase();
  const stem = base
    .slice(0, base.length - ext.length)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/\.+/g, '.')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  return `${stem || 'file'}${ext.replace(/[^a-z0-9.]/g, '')}`;
}

/** A user-facing display name derived from the upload's original filename. */
export function displayNameFrom(original: string): string {
  const cleaned = path
    .basename(original.replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return cleaned.slice(0, 200) || 'Untitled';
}

/** Resolves a stored relative path, refusing anything that escapes the uploads directory. */
export function resolveStoragePath(relativePath: string): string {
  const root = config.uploadsDir;
  const abs = path.resolve(root, relativePath);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw badRequest('Invalid file path.');
  }
  return abs;
}

export function eventUploadDir(eventId: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(eventId)) throw badRequest('Invalid event id.');
  return resolveStoragePath(eventId);
}

export async function readFileHead(file: string, length = 16): Promise<Buffer> {
  const handle = await fsp.open(file, 'r');
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buf, 0, length, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export function hashFile(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

/**
 * Moves a file into uploads/<eventId>/<folder>/ with a unique, sanitized name.
 * Returns the storage path relative to the uploads root.
 */
export async function storeFile(source: string, eventId: string, originalName: string): Promise<string> {
  const type = getFileType(originalName);
  if (!type) throw badRequest('File type not supported.');
  const dir = path.join(eventUploadDir(eventId), type.folder);
  await fsp.mkdir(dir, { recursive: true });
  const fileName = `${crypto.randomBytes(4).toString('hex')}-${sanitizeFilename(originalName)}`;
  const dest = path.join(dir, fileName);
  try {
    await fsp.rename(source, dest);
  } catch (err: any) {
    // Different device (e.g. custom UPLOADS_DIR): fall back to copy + delete.
    if (err?.code !== 'EXDEV') throw err;
    await fsp.copyFile(source, dest);
    await fsp.rm(source, { force: true });
  }
  return path.relative(config.uploadsDir, dest).split(path.sep).join('/');
}

export async function removeStoredFile(relativePath: string): Promise<void> {
  await fsp.rm(resolveStoragePath(relativePath), { force: true });
}

export function storedFileExists(relativePath: string): boolean {
  try {
    return fs.statSync(resolveStoragePath(relativePath)).isFile();
  } catch {
    return false;
  }
}

export async function removeEventUploads(eventId: string): Promise<void> {
  await fsp.rm(eventUploadDir(eventId), { recursive: true, force: true });
}

export const tmpUploadDir = () => path.join(config.uploadsDir, '.tmp');
