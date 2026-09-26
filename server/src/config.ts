import fs from 'node:fs';
import path from 'node:path';

// server/src (tsx) and server/dist (compiled) are both two levels below the repo root.
export const ROOT_DIR = path.resolve(__dirname, '..', '..');

// Optional settings file (cloud storage, sign-in...). See .env.example.
const envFile = path.join(ROOT_DIR, '.env');
if (process.env.NODE_ENV !== 'test' && typeof process.loadEnvFile === 'function' && fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

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

  auth: {
    // "local": operator password stored (hashed) in the database, created on first run.
    // "supabase": operators sign in with a Supabase Auth email + password.
    // "none": no sign-in at all (only for trusted, isolated setups).
    provider: (process.env.AUTH_PROVIDER ?? 'local') as 'local' | 'supabase' | 'none',
    sessionHours: Number(process.env.SESSION_HOURS ?? 24 * 7),
  },

  // Cloud storage for uploaded files. Leave SUPABASE_URL empty to keep files local only.
  supabase: {
    url: (process.env.SUPABASE_URL ?? '').replace(/\/+$/, ''),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    anonKey: process.env.SUPABASE_ANON_KEY ?? '',
    bucket: process.env.SUPABASE_BUCKET ?? 'eventcontrol',
  },

  // Google account connection (Drive import) and optional "Sign in with Google".
  // Create an OAuth client (type "Web application") in Google Cloud Console; see README.
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    // Leave empty to derive it from the address the app is opened at.
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? '',
    // Comma-separated Google accounts allowed to sign in as operator (empty = sign-in off).
    allowedEmails: (process.env.GOOGLE_ALLOWED_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    // Overridable for tests.
    authUrl: process.env.GOOGLE_AUTH_URL ?? 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: process.env.GOOGLE_TOKEN_URL ?? 'https://oauth2.googleapis.com/token',
    revokeUrl: process.env.GOOGLE_REVOKE_URL ?? 'https://oauth2.googleapis.com/revoke',
    apiUrl: (process.env.GOOGLE_API_URL ?? 'https://www.googleapis.com').replace(/\/+$/, ''),
  },

  // LibreOffice binary used to convert PPT/PPTX to PDF. Auto-detected when empty.
  sofficePath: process.env.SOFFICE_PATH ?? '',
  conversionTimeoutMs: Number(process.env.CONVERSION_TIMEOUT_SECONDS ?? 180) * 1000,
};

export const cloudStorageEnabled = () => !!(config.supabase.url && config.supabase.serviceKey);

export const googleConfigured = () => !!(config.google.clientId && config.google.clientSecret);
