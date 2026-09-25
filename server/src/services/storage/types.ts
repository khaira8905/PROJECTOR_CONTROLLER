/**
 * A remote object store for uploaded files. EventControl always keeps a local
 * working copy (so shows keep running without internet); the remote store is the
 * durable cloud copy. Implementations are swappable (Supabase today; S3, Firebase
 * Storage, ... later) without touching the rest of the app.
 */
export interface CloudStorage {
  readonly name: string;
  upload(key: string, absPath: string, contentType: string): Promise<void>;
  download(key: string, destAbsPath: string): Promise<void>;
  remove(keys: string[]): Promise<void>;
  health(): Promise<{ ok: boolean; message: string }>;
}
