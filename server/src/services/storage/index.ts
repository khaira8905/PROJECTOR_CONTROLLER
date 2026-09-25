import { config, cloudStorageEnabled } from '../../config';
import { SupabaseStorage } from './supabaseStorage';
import type { CloudStorage } from './types';

let instance: CloudStorage | null | undefined;

/** The configured cloud store, or null when files are kept locally only. */
export function cloudStorage(): CloudStorage | null {
  if (instance === undefined) {
    instance = cloudStorageEnabled() ? new SupabaseStorage(config.supabase.url, config.supabase.serviceKey, config.supabase.bucket) : null;
  }
  return instance;
}

/** For tests. */
export function resetCloudStorage() {
  instance = undefined;
}

export type { CloudStorage };
