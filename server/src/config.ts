import path from 'node:path';

// server/src (tsx) and server/dist (compiled) are both two levels below the repo root.
export const ROOT_DIR = path.resolve(__dirname, '..', '..');

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  uploadsDir: path.resolve(process.env.UPLOADS_DIR ?? path.join(ROOT_DIR, 'uploads')),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 1024) * 1024 * 1024,
  maxFilesPerUpload: 20,
  clientDistDir: path.join(ROOT_DIR, 'client', 'dist'),
  demoAssetsDir: path.join(ROOT_DIR, 'server', 'demo-assets'),
  // Launching PowerPoint etc. on the host machine. Disable on shared/remote servers.
  allowExternalOpen: process.env.ALLOW_EXTERNAL_OPEN !== 'false',
  seedDemo: process.env.SEED_DEMO !== 'false',
};
